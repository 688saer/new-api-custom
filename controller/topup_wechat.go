package controller

import (
	"errors"
	"fmt"
	"io"
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

// 微信支付官方通道（Native 扫码）。
//
// Native 下单只返回一个 weixin:// 链接：电脑上渲染成二维码给手机扫；手机浏览器
// 没法扫自己的屏幕，所以同一个链接也做成「在微信中打开」按钮，点一下直接唤起
// 微信付款页。回调报文是加密的，验签 + 解密之后才入账。

type WechatRequest struct {
	Amount int64 `json:"amount"`
}

func getWechatPayConfig() service.WechatPayConfig {
	return service.WechatPayConfig{
		AppId:             strings.TrimSpace(setting.WechatPayAppId),
		MchId:             strings.TrimSpace(setting.WechatPayMchId),
		MchSerialNo:       strings.TrimSpace(setting.WechatPayMchSerialNo),
		PrivateKey:        setting.WechatPayPrivateKey,
		ApiV3Key:          setting.WechatPayApiV3Key,
		PlatformPublicKey: setting.WechatPayPlatformPublicKey,
		Gateway:           strings.TrimSpace(setting.WechatPayGateway),
	}
}

// getWechatMinTopup 与其它通道保持一致：展示 tokens 时最低额也要换算。
func getWechatMinTopup() int64 {
	minTopUp := setting.WechatPayMinTopUp
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

func wechatNotifyUrl() string {
	if notifyUrl := strings.TrimSpace(setting.WechatPayNotifyUrl); notifyUrl != "" {
		return notifyUrl
	}
	return service.GetCallbackAddress() + "/api/user/wechat/notify"
}

func RequestWechat(c *gin.Context) {
	var req WechatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		paymentError(c, common.NewMessage("Invalid parameters"))
		return
	}
	if !isWechatTopUpEnabled() {
		paymentError(c, common.NewMessage("Payment information has not been configured by administrator"))
		return
	}
	if req.Amount < getWechatMinTopup() {
		paymentError(c, common.NewMessage("Top-up amount cannot be less than {{min}}", map[string]any{"min": getWechatMinTopup()}))
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
	// 微信支付按分计价，费率换算出来的钱要落成整数分。
	totalFen := decimal.NewFromFloat(payMoney).Shift(2).Round(0).IntPart()
	if totalFen < 1 {
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
		PaymentMethod:   model.PaymentMethodWechatOfficial,
		PaymentProvider: model.PaymentProviderWechat,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := topUp.Insert(); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("wechat failed to create top-up order user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	codeUrl, err := service.CreateWechatNativeOrder(getWechatPayConfig(), service.WechatPayOrder{
		OutTradeNo:  tradeNo,
		Description: fmt.Sprintf("Top-up %s", tradeNo),
		TotalFen:    totalFen,
		NotifyUrl:   wechatNotifyUrl(),
	})
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("wechat native order failed user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("wechat native order created user_id=%d trade_no=%s amount=%d money=%.2f fen=%d", id, tradeNo, req.Amount, payMoney, totalFen))
	c.JSON(http.StatusOK, gin.H{"message": "success", "code_url": codeUrl, "trade_no": tradeNo})
}

// WechatNotify 处理微信支付回调：先验签，再 AES-256-GCM 解密，成功才入账。
func WechatNotify(c *gin.Context) {
	if !isWechatWebhookEnabled() {
		logger.LogWarn(c.Request.Context(), common.LogText("wechat notification rejected reason=disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "channel disabled"})
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("wechat notification unreadable path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "invalid notification"})
		return
	}
	notification, err := service.DecryptWechatPayNotification(getWechatPayConfig(), c.Request.Header, body)
	if err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText("wechat notification verification failed path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "invalid notification"})
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("wechat notification received trade_no=%s trade_state=%s client_ip=%s", notification.OutTradeNo, notification.TradeState, c.ClientIP()))
	if notification.TradeState != "SUCCESS" {
		// 非成功状态先确认掉，真正到账等成功通知。
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
		return
	}

	// 进程内锁只是优化；重复/并发通知的正确性由 RechargeWechat 的行锁和事务内
	// 状态校验保证（多实例部署下同样安全）。
	LockOrder(notification.OutTradeNo)
	defer UnlockOrder(notification.OutTradeNo)
	alreadyDone, err := model.RechargeWechat(notification.OutTradeNo, notification.TotalFen, c.ClientIP())
	if err != nil {
		switch {
		case errors.Is(err, model.ErrTopUpNotFound):
			logger.LogWarn(c.Request.Context(), common.LogText("wechat notification order not found trade_no=%s client_ip=%s", notification.OutTradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrPaymentMethodMismatch):
			logger.LogWarn(c.Request.Context(), common.LogText("wechat notification provider mismatch trade_no=%s client_ip=%s", notification.OutTradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrTopUpStatusInvalid):
			logger.LogWarn(c.Request.Context(), common.LogText("wechat notification order status invalid trade_no=%s client_ip=%s", notification.OutTradeNo, c.ClientIP()))
		case errors.Is(err, model.ErrTopUpMoneyMismatch):
			logger.LogError(c.Request.Context(), common.LogText("wechat notification amount mismatch trade_no=%s fen=%d client_ip=%s", notification.OutTradeNo, notification.TotalFen, c.ClientIP()))
		default:
			logger.LogError(c.Request.Context(), common.LogText("wechat top-up failed trade_no=%s client_ip=%s error=%q", notification.OutTradeNo, c.ClientIP(), err.Error()))
		}
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "top-up failed"})
		return
	}
	if alreadyDone {
		logger.LogInfo(c.Request.Context(), common.LogText("wechat notification already processed trade_no=%s client_ip=%s", notification.OutTradeNo, c.ClientIP()))
	}
	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": "成功"})
}

// WechatOrderStatus 让用户主动核对一笔扫码订单：先看本地，再问微信支付。
//
// 和支付宝那个接口一样，「检测余额」靠它把异步通知延迟或丢包的订单补记回来，
// 入账走同一条幂等路径，重复点击不会多给额度。
func WechatOrderStatus(c *gin.Context) {
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

	tradeState, totalFen, err := service.QueryWechatOrder(getWechatPayConfig(), tradeNo)
	if err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText("wechat query failed trade_no=%s error=%q", tradeNo, err.Error()))
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

	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)
	if _, err := model.RechargeWechat(tradeNo, totalFen, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), common.LogText("wechat query credit failed trade_no=%s user_id=%d error=%q", tradeNo, id, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "success", "status": "pending"})
		return
	}
	logger.LogInfo(c.Request.Context(), common.LogText("wechat order settled by user query trade_no=%s user_id=%d", tradeNo, id))
	c.JSON(http.StatusOK, gin.H{"message": "success", "status": "success"})
}
