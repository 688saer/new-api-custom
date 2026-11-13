package controller

import (
	"fmt"
	"io"
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

// 订阅套餐走微信支付官方通道（APIv3 Native 扫码）。
//
// 与钱包充值同一套商户凭据，但下单、通知、查询都挂在订阅自己的路径上：充值
// 用的 notify 地址不能复用，否则微信的回调会打到充值链路。

type SubscriptionWechatPayRequest struct {
	PlanId int `json:"plan_id"`
	// RenewMode 记录老用户结账时的选择：顺延有效期，或吃掉一天立刻重置。
	RenewMode string `json:"renew_mode"`
}

func SubscriptionRequestWechat(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	var req SubscriptionWechatPayRequest
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
	if !isWechatTopUpEnabled() {
		common.ApiErrorT(c, "Payment information has not been configured by administrator")
		return
	}
	// 微信按分计价，套餐金额也要落成整数分，1 分以下直接拒。
	totalFen := decimal.NewFromFloat(plan.PriceAmount).Shift(2).Round(0).IntPart()
	if totalFen < 1 {
		common.ApiErrorT(c, "Plan amount is too low")
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
		PaymentMethod:   model.PaymentMethodWechatOfficial,
		PaymentProvider: model.PaymentProviderWechat,
		RenewMode:       model.NormalizeSubscriptionRenewMode(req.RenewMode),
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("subscription wechat failed to create order user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
		common.ApiErrorT(c, "Failed to create order")
		return
	}

	codeUrl, err := service.CreateWechatNativeOrder(getWechatPayConfig(), service.WechatPayOrder{
		OutTradeNo:  tradeNo,
		Description: fmt.Sprintf("Subscription %s", tradeNo),
		TotalFen:    totalFen,
		NotifyUrl:   service.GetCallbackAddress() + "/api/subscription/wechat/notify",
	})
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("subscription wechat native order failed user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
		_ = model.ExpireSubscriptionOrder(tradeNo, model.PaymentProviderWechat)
		common.ApiErrorT(c, "Failed to start payment")
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("subscription wechat native order created user_id=%d trade_no=%s plan_id=%d money=%.2f fen=%d", userId, tradeNo, plan.Id, plan.PriceAmount, totalFen))
	c.JSON(http.StatusOK, gin.H{"message": "success", "code_url": codeUrl, "trade_no": tradeNo})
}

// SubscriptionWechatNotify 处理订阅订单的微信支付回调：先验签，再 AES-256-GCM
// 解密，成功才发放套餐。
func SubscriptionWechatNotify(c *gin.Context) {
	if !isWechatWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), common.LogText("subscription wechat notification rejected reason=disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "channel disabled"})
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("subscription wechat notification unreadable path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "invalid notification"})
		return
	}
	notification, err := service.DecryptWechatPayNotification(getWechatPayConfig(), c.Request.Header, body)
	if err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText("subscription wechat notification verification failed path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "invalid notification"})
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("subscription wechat notification received trade_no=%s trade_state=%s client_ip=%s", notification.OutTradeNo, notification.TradeState, c.ClientIP()))
	if notification.TradeState != "SUCCESS" {
		// 非成功状态先确认掉，真正的发放等成功通知。
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}
	if !subscriptionOrderMatchesWechatPayment(model.GetSubscriptionOrderByTradeNo(notification.OutTradeNo), notification.TotalFen) {
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "order or amount mismatch"})
		return
	}

	// 进程内锁只是优化；重复通知的正确性由 CompleteSubscriptionOrder 的行锁与
	// 事务内状态校验保证（多实例部署下同样安全）。
	LockOrder(notification.OutTradeNo)
	defer UnlockOrder(notification.OutTradeNo)
	if err := model.CompleteSubscriptionOrder(notification.OutTradeNo, common.GetJsonString(notification), model.PaymentProviderWechat, model.PaymentMethodWechatOfficial); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("subscription wechat completion failed trade_no=%s client_ip=%s error=%q", notification.OutTradeNo, c.ClientIP(), err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "subscription failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
}

// SubscriptionWechatOrderStatus 让用户主动核对一笔扫码订单：先看本地，再问微信支付。
// 通知延迟或丢包时靠它补发，走的仍是 CompleteSubscriptionOrder 的幂等路径。
func SubscriptionWechatOrderStatus(c *gin.Context) {
	tradeNo := strings.TrimSpace(c.Query("trade_no"))
	if tradeNo == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	userId := c.GetInt("id")
	order := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil || order.UserId != userId || order.PaymentProvider != model.PaymentProviderWechat {
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

	tradeState, totalFen, err := service.QueryWechatOrder(getWechatPayConfig(), tradeNo)
	if err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText("subscription wechat query failed trade_no=%s error=%q", tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "pending"})
		return
	}
	switch tradeState {
	case "SUCCESS":
	case "CLOSED", "REVOKED", "PAYERROR":
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "closed"})
		return
	default:
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "pending"})
		return
	}
	if !subscriptionOrderMatchesWechatPayment(order, totalFen) {
		logger.LogWarn(c.Request.Context(), common.LogText("subscription wechat query amount mismatch trade_no=%s fen=%d", tradeNo, totalFen))
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "pending"})
		return
	}

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if err := model.CompleteSubscriptionOrder(tradeNo, common.GetJsonString(map[string]string{"source": "wechat_query", "trade_state": tradeState}), model.PaymentProviderWechat, model.PaymentMethodWechatOfficial); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("subscription wechat query completion failed trade_no=%s user_id=%d error=%q", tradeNo, userId, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "pending"})
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("subscription wechat order settled by user query trade_no=%s user_id=%d", tradeNo, userId))
	c.JSON(http.StatusOK, gin.H{"message": "success", "status": "success"})
}

// subscriptionOrderMatchesWechatPayment 校验这笔订单确实是我们的微信订阅单，
// 且实付分值与下单金额一致。已完成的订单同样满足，重复通知不会被判成失败。
func subscriptionOrderMatchesWechatPayment(order *model.SubscriptionOrder, paidFen int64) bool {
	if order == nil || order.PaymentProvider != model.PaymentProviderWechat {
		return false
	}
	expectedFen := decimal.NewFromFloat(order.Money).Shift(2).Round(0).IntPart()
	return paidFen == expectedFen
}
