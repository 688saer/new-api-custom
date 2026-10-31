package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

// 支付宝官方通道：下单、异步通知、同步回跳。
//
// 只有异步通知会加额度，而且必须验签通过；同步回跳纯粹是给用户一个回到钱包页的
// 出口，任何人手工访问都不会触发充值。

type AlipayRequest struct {
	Amount int64 `json:"amount"`
}

func getAlipayConfig() service.AlipayConfig {
	return service.AlipayConfig{
		AppId:      strings.TrimSpace(setting.AlipayAppId),
		PrivateKey: setting.AlipayPrivateKey,
		PublicKey:  setting.AlipayPublicKey,
		Gateway:    strings.TrimSpace(setting.AlipayGateway),
		Sandbox:    setting.AlipaySandbox,
	}
}

func getAlipayProduct() string {
	product := strings.TrimSpace(setting.AlipayProductType)
	switch product {
	case service.AlipayProductPage, service.AlipayProductWap, service.AlipayProductQr:
		return product
	default:
		return service.AlipayProductPage
	}
}

// getAlipayMinTopup 与其它通道保持一致：展示 tokens 时最低额也要换算。
func getAlipayMinTopup() int64 {
	minTopUp := setting.AlipayMinTopUp
	if minTopUp <= 0 {
		minTopUp = 1
	}
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dMinTopUp := decimal.NewFromInt(int64(minTopUp))
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		quota, err := common.WalletQuotaFromDecimalStrict(dMinTopUp.Mul(dQuotaPerUnit))
		if err != nil {
			return common.MaxWalletQuota
		}
		return int64(quota)
	}
	return int64(minTopUp)
}

func alipayNotifyUrl() string {
	if notifyUrl := strings.TrimSpace(setting.AlipayNotifyUrl); notifyUrl != "" {
		return notifyUrl
	}
	return service.GetCallbackAddress() + "/api/user/alipay/notify"
}

func alipayReturnUrl() string {
	if returnUrl := strings.TrimSpace(setting.AlipayReturnUrl); returnUrl != "" {
		return returnUrl
	}
	// payment_return=alipay 让钱包页在被带回后补几次额度刷新。
	return paymentReturnPath("/wallet") + "?payment_return=alipay"
}

func RequestAlipay(c *gin.Context) {
	var req AlipayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	if !isAlipayTopUpEnabled() {
		paymentError(c, common.NewMessage("Payment information has not been configured by administrator"))
		return
	}
	if req.Amount < getAlipayMinTopup() {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": getAlipayMinTopup()}))
		return
	}
	id := c.GetInt("id")
	if rejectInvalidTopUpQuota(c, id, req.Amount) {
		return
	}
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		paymentError(c, common.NewMessage("Failed to get the user group"))
		return
	}
	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		paymentError(c, common.NewMessage("Payment amount is too low"))
		return
	}

	tradeNo := fmt.Sprintf("USR%dNO%s%d", id, common.GetRandomString(6), time.Now().Unix())
	amount := req.Amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		dAmount := decimal.NewFromInt(req.Amount)
		dQuotaPerUnit := decimal.NewFromFloat(common.QuotaPerUnit)
		amount = dAmount.Div(dQuotaPerUnit).IntPart()
	}
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipayOfficial,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("alipay failed to create top-up order user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	product := getAlipayProduct()
	order := service.AlipayOrder{
		OutTradeNo: tradeNo,
		// 支付宝对 biz_content 里的中文会按 charset 重新解码，实测中文 subject
		// 会让网关回 isv.invalid-signature，所以商品名保持 ASCII 并带上订单号。
		Subject:     fmt.Sprintf("Top-up %s", tradeNo),
		TotalAmount: service.AlipayAmount(payMoney),
		NotifyUrl:   alipayNotifyUrl(),
		ReturnUrl:   alipayReturnUrl(),
		Product:     product,
	}
	if product == service.AlipayProductQr {
		qrCode, err := service.CreateAlipayPrecreate(getAlipayConfig(), order)
		if err != nil {
			logger.LogError(c.Request.Context(), common.LogText("alipay precreate failed user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
			paymentError(c, common.NewMessage("Failed to start payment"))
			return
		}
		logger.LogInfo(c.Request.Context(), common.LogText("alipay qr order created user_id=%d trade_no=%s amount=%d money=%.2f", id, tradeNo, req.Amount, payMoney))
		c.JSON(http.StatusOK, gin.H{"message": "success", "qr_code": qrCode, "trade_no": tradeNo})
		return
	}

	payUrl, err := service.BuildAlipayPaymentURL(getAlipayConfig(), order)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("alipay failed to build payment url user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("alipay order created user_id=%d trade_no=%s amount=%d money=%.2f product=%s", id, tradeNo, req.Amount, payMoney, product))
	c.JSON(http.StatusOK, gin.H{"message": "success", "url": payUrl, "trade_no": tradeNo})
}

// AlipayNotify 处理支付宝异步通知。响应体必须是纯文本 success，否则支付宝会重试。
func AlipayNotify(c *gin.Context) {
	if !isAlipayWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), common.LogText("alipay notification rejected reason=disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}
	if err := c.Request.ParseForm(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("alipay notification failed to parse form path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.String(http.StatusOK, "failure")
		return
	}
	params := make(map[string]string, len(c.Request.PostForm))
	for key := range c.Request.PostForm {
		params[key] = c.Request.PostForm.Get(key)
	}
	if len(params) == 0 {
		logger.LogWarn(c.Request.Context(), common.LogText("alipay notification is empty path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.String(http.StatusOK, "failure")
		return
	}

	config := getAlipayConfig()
	if err := service.VerifyAlipayNotifySign(params, config.PublicKey); err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText("alipay notification signature verification failed path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.String(http.StatusOK, "failure")
		return
	}
	// 验签通过只证明这段内容来自支付宝，还要确认是发给我们的应用。
	if appId := strings.TrimSpace(params["app_id"]); appId != "" && appId != config.AppId {
		logger.LogWarn(c.Request.Context(), common.LogText("alipay notification app id mismatch path=%q client_ip=%s app_id=%s", c.Request.RequestURI, c.ClientIP(), appId))
		c.String(http.StatusOK, "failure")
		return
	}

	tradeNo := strings.TrimSpace(params["out_trade_no"])
	tradeStatus := strings.TrimSpace(params["trade_status"])
	logger.LogInfo(c.Request.Context(), common.LogText("alipay notification received trade_no=%s trade_status=%s app_id=%s client_ip=%s", tradeNo, tradeStatus, params["app_id"], c.ClientIP()))
	if tradeStatus != "TRADE_SUCCESS" && tradeStatus != "TRADE_FINISHED" {
		// 未付款状态先确认掉，真正的到账结果等成功通知。
		c.String(http.StatusOK, "success")
		return
	}

	// 进程内锁只是优化；重复/并发通知的正确性由 RechargeAlipay 的行锁和
	// 事务内状态校验保证（多实例部署下同样安全）。
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	alreadyDone, err := model.RechargeAlipay(tradeNo, params["total_amount"], c.ClientIP())
	if err != nil {
		switch {
		case errors.Is(err, model.ErrTopUpNotFound):
			logger.LogWarn(c.Request.Context(), common.LogText("alipay notification order not found trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrPaymentMethodMismatch):
			logger.LogWarn(c.Request.Context(), common.LogText("alipay notification provider mismatch trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrTopUpStatusInvalid):
			logger.LogWarn(c.Request.Context(), common.LogText("alipay notification order status invalid trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrTopUpMoneyMismatch):
			logger.LogError(c.Request.Context(), common.LogText("alipay notification amount mismatch trade_no=%s paid=%q client_ip=%s", tradeNo, params["total_amount"], c.ClientIP()))
		default:
			logger.LogError(c.Request.Context(), common.LogText("alipay top-up failed trade_no=%s client_ip=%s error=%q", tradeNo, c.ClientIP(), err.Error()))
		}
		c.String(http.StatusOK, "failure")
		return
	}
	if alreadyDone {
		logger.LogInfo(c.Request.Context(), common.LogText("alipay notification already processed trade_no=%s client_ip=%s", tradeNo, c.ClientIP()))
	}
	c.String(http.StatusOK, "success")
}

// AlipayReturn 是用户付完款被带回站点的入口，只做跳转，不入账。
func AlipayReturn(c *gin.Context) {
	c.Redirect(http.StatusFound, alipayReturnUrl())
}

// AlipayOrderStatus 让用户主动核对一笔扫码订单：先看本地，再问支付宝。
//
// 异步通知仍是自动入账的主路径，但它可能延迟或丢包，用户付完款看到余额没变
// 就以为白付了。这里在用户点「检测余额」时补一次主动查询，支付宝确认已付款
// 就走通知那条幂等路径入账（行锁 + 状态校验，重复调用不会多给额度）。
func AlipayOrderStatus(c *gin.Context) {
	tradeNo := strings.TrimSpace(c.Query("trade_no"))
	if tradeNo == "" {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	id := c.GetInt("id")
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.UserId != id {
		paymentError(c, common.NewMessage("Order not found"))
		return
	}
	if topUp.Status == common.TopUpStatusSuccess {
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "success"})
		return
	}
	if topUp.Status != common.TopUpStatusPending {
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "closed"})
		return
	}

	tradeStatus, paidAmount, err := service.QueryAlipayTrade(getAlipayConfig(), tradeNo)
	if err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText("alipay query failed trade_no=%s error=%q", tradeNo, err.Error()))
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

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if _, err := model.RechargeAlipay(tradeNo, paidAmount, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("alipay query credit failed trade_no=%s user_id=%d error=%q", tradeNo, id, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "pending"})
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("alipay order settled by user query trade_no=%s user_id=%d", tradeNo, id))
	c.JSON(http.StatusOK, gin.H{"message": "success", "status": "success"})
}
