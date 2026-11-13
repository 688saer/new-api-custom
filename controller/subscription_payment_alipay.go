package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/shopspring/decimal"

	"github.com/gin-gonic/gin"
)

// 订阅套餐走支付宝官方通道：下单、异步通知、同步回跳、订单查询。
//
// 与钱包充值同源（同一套凭据、同一套服务层），但商品是套餐本身：充值用的
// notify/return 地址不能复用到订阅上，否则通知会打到充值链路，所以回调地址
// 由接口地址现算，不读 setting.AlipayNotifyUrl。

type SubscriptionAlipayPayRequest struct {
	PlanId int `json:"plan_id"`
	// RenewMode 记录老用户结账时的选择：顺延有效期，或吃掉一天立刻重置。
	RenewMode string `json:"renew_mode"`
}

func SubscriptionRequestAlipay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	var req SubscriptionAlipayPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorT(c, "Subscription plan is not enabled")
		return
	}
	if plan.PriceAmount < 0.01 {
		common.ApiErrorT(c, "Plan amount is too low")
		return
	}
	if !isAlipayTopUpEnabled() {
		common.ApiErrorT(c, "Payment information has not been configured by administrator")
		return
	}

	userId := c.GetInt("id")
	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorT(c, "Purchase limit for this plan has been reached")
			return
		}
	}

	tradeNo := fmt.Sprintf("SUBUSR%dNO%s%d", userId, common.GetRandomString(6), time.Now().Unix())
	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipayOfficial,
		PaymentProvider: model.PaymentProviderAlipay,
		RenewMode:       model.NormalizeSubscriptionRenewMode(req.RenewMode),
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("subscription alipay failed to create order user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
		common.ApiErrorT(c, "Failed to create order")
		return
	}

	alipayOrder := service.AlipayOrder{
		OutTradeNo: tradeNo,
		// 支付宝对 biz_content 里的中文会按 charset 重新解码，实测中文 subject
		// 会让网关回 isv.invalid-signature，所以商品名保持 ASCII。
		Subject:     fmt.Sprintf("Subscription %s", tradeNo),
		TotalAmount: service.AlipayAmount(plan.PriceAmount),
		NotifyUrl:   service.GetCallbackAddress() + "/api/subscription/alipay/notify",
		ReturnUrl:   service.GetCallbackAddress() + "/api/subscription/alipay/return",
		Product:     getAlipayProduct(),
	}

	if alipayOrder.Product == service.AlipayProductQr {
		qrCode, err := service.CreateAlipayPrecreate(getAlipayConfig(), alipayOrder)
		if err != nil {
			logger.LogError(c.Request.Context(), common.LogText("subscription alipay precreate failed user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
			_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderAlipay)
			common.ApiErrorT(c, "Failed to start payment")
			return
		}
		logger.LogInfo(c.Request.Context(), common.LogText("subscription alipay qr order created user_id=%d trade_no=%s plan_id=%d money=%.2f", userId, tradeNo, plan.Id, plan.PriceAmount))
		c.JSON(http.StatusOK, gin.H{"message": "success", "qr_code": qrCode, "trade_no": tradeNo})
		return
	}

	payUrl, err := service.BuildAlipayPaymentURL(getAlipayConfig(), alipayOrder)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("subscription alipay failed to build payment url user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
		_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderAlipay)
		common.ApiErrorT(c, "Failed to start payment")
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("subscription alipay order created user_id=%d trade_no=%s plan_id=%d money=%.2f product=%s", userId, tradeNo, plan.Id, plan.PriceAmount, alipayOrder.Product))
	c.JSON(http.StatusOK, gin.H{"message": "success", "url": payUrl, "trade_no": tradeNo})
}

// SubscriptionAlipayNotify 处理订阅订单的支付宝异步通知。响应体必须是纯文本
// success，否则支付宝会一直重试。
func SubscriptionAlipayNotify(c *gin.Context) {
	if !isAlipayWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), common.LogText("subscription alipay notification rejected reason=disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}
	if err := c.Request.ParseForm(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("subscription alipay notification failed to parse form path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.String(http.StatusOK, "failure")
		return
	}
	params := make(map[string]string, len(c.Request.PostForm))
	for key := range c.Request.PostForm {
		params[key] = c.Request.PostForm.Get(key)
	}
	if len(params) == 0 {
		logger.LogWarn(c.Request.Context(), common.LogText("subscription alipay notification is empty path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}

	config := getAlipayConfig()
	if err := service.VerifyAlipayNotifySign(params, config.PublicKey); err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText("subscription alipay notification signature verification failed path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.String(http.StatusOK, "failure")
		return
	}
	if appId := strings.TrimSpace(params["app_id"]); appId != "" && appId != config.AppId {
		logger.LogWarn(c.Request.Context(), common.LogText("subscription alipay notification app id mismatch path=%q client_ip=%s app_id=%s", c.Request.RequestURI, c.ClientIP(), appId))
		c.String(http.StatusOK, "failure")
		return
	}

	tradeNo := strings.TrimSpace(params["out_trade_no"])
	tradeStatus := strings.TrimSpace(params["trade_status"])
	logger.LogInfo(c.Request.Context(), common.LogText("subscription alipay notification received trade_no=%s trade_status=%s client_ip=%s", tradeNo, tradeStatus, c.ClientIP()))
	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		// 未付款状态先确认掉，真正的发放等成功通知。
		c.String(http.StatusOK, "success")
		return
	}
	if !subscriptionOrderMatchesAlipayPayment(model.GetSubscriptionOrderByTradeNo(tradeNo), params["total_amount"]) {
		logger.LogWarn(c.Request.Context(), common.LogText("subscription alipay notification order or amount mismatch trade_no=%s paid=%q client_ip=%s", tradeNo, params["total_amount"], c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}

	// 进程内锁只是优化；重复通知的正确性由 CompleteSubscriptionOrder 的行锁与
	// 事务内状态校验保证（多实例部署下同样安全）。
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(params), model.PaymentProviderAlipay, model.PaymentMethodAlipayOfficial); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("subscription alipay completion failed trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		c.String(http.StatusOK, "failure")
		return
	}
	c.String(http.StatusOK, "success")
}

// SubscriptionAlipayReturn 是用户付完款被带回站点的入口；发放只认异步通知。
func SubscriptionAlipayReturn(c *gin.Context) {
	c.Redirect(http.StatusFound, alipayReturnUrl())
}

// SubscriptionAlipayOrderStatus 让用户主动核对一笔扫码订单：先看本地，再问支付宝。
// 通知延迟或丢包时靠它补发，走的仍是 CompleteSubscriptionOrder 的幂等路径。
func SubscriptionAlipayOrderStatus(c *gin.Context) {
	tradeNo := strings.TrimSpace(c.Query("trade_no"))
	if tradeNo == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	userId := c.GetInt("id")
	order := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil || order.UserId != userId || order.PaymentProvider != model.PaymentProviderAlipay {
		common.ApiErrorT(c, "Order not found")
		return
	}
	if order.Status == common.TopUpStatusSuccess {
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "success"})
		return
	}
	if order.Status != common.TopUpStatusPending {
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "closed"})
		return
	}

	tradeStatus, paidAmount, err := service.QueryAlipayTrade(getAlipayConfig(), tradeNo)
	if err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText("subscription alipay query failed trade_no=%s error=%q", tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "pending"})
		return
	}
	switch tradeStatus {
	case "TRADE_SUCCESS", "TRADE_FINISHED":
	case "TRADE_CLOSED":
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "closed"})
		return
	default:
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "pending"})
		return
	}
	if !subscriptionOrderMatchesAlipayPayment(order, paidAmount) {
		logger.LogWarn(c.Request.Context(), common.LogText("subscription alipay query amount mismatch trade_no=%s paid=%q", tradeNo, paidAmount))
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "pending"})
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(map[string]string{"source": "alipay_query", "trade_status": tradeStatus}), model.PaymentProviderAlipay, model.PaymentMethodAlipayOfficial); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("subscription alipay query completion failed trade_no=%s user_id=%d error=%q", tradeNo, userId, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "pending"})
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("subscription alipay order settled by user query trade_no=%s user_id=%d", tradeNo, userId))
	c.JSON(http.StatusOK, gin.H{"message": "success", "status": "success"})
}

// subscriptionOrderMatchesAlipayPayment 校验这笔订单确实是我们的支付宝订阅单，
// 且实付金额与下单金额一致——少付不能多拿。已完成的通知也满足条件，重复通知
// 因此不会被判成失败（否则支付宝会无限重试）。
func subscriptionOrderMatchesAlipayPayment(order *model.SubscriptionOrder, paidAmount string) bool {
	if order == nil || order.PaymentProvider != model.PaymentProviderAlipay {
		return false
	}
	paid, err := decimal.NewFromString(strings.TrimSpace(paidAmount))
	if err != nil {
		return false
	}
	return paid.Round(2).Equal(decimal.NewFromFloat(order.Money).Round(2))
}
