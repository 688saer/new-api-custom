package controller

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func confirmPaymentComplianceForTest(t *testing.T) {
	t.Helper()
	paymentSetting := operation_setting.GetPaymentSetting()
	originalConfirmed := paymentSetting.ComplianceConfirmed
	originalTermsVersion := paymentSetting.ComplianceTermsVersion
	t.Cleanup(func() {
		paymentSetting.ComplianceConfirmed = originalConfirmed
		paymentSetting.ComplianceTermsVersion = originalTermsVersion
	})
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
}

func TestStripeWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPISecret := setting.StripeApiSecret
	originalWebhookSecret := setting.StripeWebhookSecret
	originalPriceID := setting.StripePriceId
	t.Cleanup(func() {
		setting.StripeApiSecret = originalAPISecret
		setting.StripeWebhookSecret = originalWebhookSecret
		setting.StripePriceId = originalPriceID
	})

	setting.StripeWebhookSecret = ""
	setting.StripeApiSecret = "sk_test_123"
	setting.StripePriceId = "price_123"
	require.False(t, isStripeWebhookEnabled())

	setting.StripeWebhookSecret = "whsec_test"
	require.True(t, isStripeWebhookEnabled())

	setting.StripePriceId = ""
	require.False(t, isStripeWebhookEnabled())
}

func TestCreemWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalAPIKey := setting.CreemApiKey
	originalProducts := setting.CreemProducts
	originalWebhookSecret := setting.CreemWebhookSecret
	t.Cleanup(func() {
		setting.CreemApiKey = originalAPIKey
		setting.CreemProducts = originalProducts
		setting.CreemWebhookSecret = originalWebhookSecret
	})

	setting.CreemWebhookSecret = ""
	setting.CreemApiKey = "creem_api_key"
	setting.CreemProducts = `[{"productId":"prod_123"}]`
	require.False(t, isCreemWebhookEnabled())

	setting.CreemWebhookSecret = "creem_secret"
	require.True(t, isCreemWebhookEnabled())

	setting.CreemProducts = "[]"
	require.False(t, isCreemWebhookEnabled())
}

func TestWaffoWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalEnabled := setting.WaffoEnabled
	originalSandbox := setting.WaffoSandbox
	originalAPIKey := setting.WaffoApiKey
	originalPrivateKey := setting.WaffoPrivateKey
	originalPublicCert := setting.WaffoPublicCert
	originalSandboxAPIKey := setting.WaffoSandboxApiKey
	originalSandboxPrivateKey := setting.WaffoSandboxPrivateKey
	originalSandboxPublicCert := setting.WaffoSandboxPublicCert
	t.Cleanup(func() {
		setting.WaffoEnabled = originalEnabled
		setting.WaffoSandbox = originalSandbox
		setting.WaffoApiKey = originalAPIKey
		setting.WaffoPrivateKey = originalPrivateKey
		setting.WaffoPublicCert = originalPublicCert
		setting.WaffoSandboxApiKey = originalSandboxAPIKey
		setting.WaffoSandboxPrivateKey = originalSandboxPrivateKey
		setting.WaffoSandboxPublicCert = originalSandboxPublicCert
	})

	setting.WaffoEnabled = true
	setting.WaffoSandbox = false
	setting.WaffoApiKey = ""
	setting.WaffoPrivateKey = "private"
	setting.WaffoPublicCert = "public"
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoApiKey = "api"
	require.True(t, isWaffoWebhookEnabled())

	setting.WaffoEnabled = false
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoEnabled = true
	setting.WaffoSandbox = true
	setting.WaffoSandboxApiKey = ""
	setting.WaffoSandboxPrivateKey = "sandbox_private"
	setting.WaffoSandboxPublicCert = "sandbox_public"
	require.False(t, isWaffoWebhookEnabled())

	setting.WaffoSandboxApiKey = "sandbox_api"
	require.True(t, isWaffoWebhookEnabled())
}

func TestWaffoPancakeWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalMerchantID := setting.WaffoPancakeMerchantID
	originalPrivateKey := setting.WaffoPancakePrivateKey
	originalProductID := setting.WaffoPancakeProductID
	t.Cleanup(func() {
		setting.WaffoPancakeMerchantID = originalMerchantID
		setting.WaffoPancakePrivateKey = originalPrivateKey
		setting.WaffoPancakeProductID = originalProductID
	})

	// Presence of all three credentials enables the gateway. Webhook public
	// keys are bundled in the SDK and there is no separate Enabled toggle —
	// clear any of the three fields to disable.
	setting.WaffoPancakeMerchantID = ""
	setting.WaffoPancakePrivateKey = "private"
	setting.WaffoPancakeProductID = "product"
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeMerchantID = "merchant"
	require.True(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeProductID = ""
	require.False(t, isWaffoPancakeWebhookEnabled())

	setting.WaffoPancakeProductID = "product"
	setting.WaffoPancakePrivateKey = ""
	require.False(t, isWaffoPancakeWebhookEnabled())
}

func TestEpayWebhookEnabledRequiresTopUpAndWebhookConfig(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
	})

	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "epay_id"
	operation_setting.EpayKey = ""
	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	require.False(t, isEpayWebhookEnabled())

	operation_setting.EpayKey = "epay_key"
	require.True(t, isEpayWebhookEnabled())

	operation_setting.PayMethods = nil
	require.False(t, isEpayWebhookEnabled())
}

func TestEpayCallbacksVerifyBeforeSettlement(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	originalServerAddress := system_setting.ServerAddress
	originalDB := model.DB
	t.Cleanup(func() {
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
		system_setting.ServerAddress = originalServerAddress
		model.DB = originalDB
	})
	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "epay_id"
	operation_setting.EpayKey = "test-key"
	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	system_setting.ServerAddress = "https://dashboard.example.com"
	// Rejected callbacks and valid non-success events must never reach settlement.
	// A nil database makes an accidental attempt to settle fail the test.
	model.DB = nil
	require.True(t, isEpayWebhookEnabled())

	// Both ambiguous maps below had this same valid signing string in v0.0.4.
	// This must fail because of parameter ambiguity, not a mismatched signature.
	ambiguousSign := epay.MD5String("money=1.00&name=item&out_trade_no=other&out_trade_no=order&pid=epay_id&trade_status=TRADE_SUCCESS&type=alipay", "test-key")
	pendingSign := epay.MD5String("money=1.00&name=item%26other&out_trade_no=order&pid=epay_id&trade_status=WAIT_BUYER_PAY&type=alipay", "test-key")
	cases := []struct {
		name         string
		productName  string
		tradeNo      string
		status       string
		sign         string
		validPending bool
	}{
		{"separator in product name", "item&out_trade_no=other", "order", epay.StatusTradeSuccess, ambiguousSign, false},
		{"separator in order number", "item", "other&out_trade_no=order", epay.StatusTradeSuccess, ambiguousSign, false},
		{"invalid signature", "item", "order", epay.StatusTradeSuccess, "invalid", false},
		{"missing signature", "item", "order", epay.StatusTradeSuccess, "", false},
		{"valid pending with literal percent escape", "item%26other", "order", "WAIT_BUYER_PAY", pendingSign, true},
	}
	endpoints := []struct {
		name             string
		path             string
		handler          gin.HandlerFunc
		status           int
		rejectedBody     string
		pendingBody      string
		rejectedLocation string
		pendingLocation  string
	}{
		{
			name: "topup notify", path: "/api/user/epay/notify", handler: EpayNotify,
			status: http.StatusOK, rejectedBody: "fail", pendingBody: "success",
		},
		{
			name: "subscription notify", path: "/api/subscription/epay/notify", handler: SubscriptionEpayNotify,
			status: http.StatusOK, rejectedBody: "fail", pendingBody: "fail",
		},
		{
			name: "subscription return", path: "/api/subscription/epay/return", handler: SubscriptionEpayReturn,
			status:           http.StatusFound,
			rejectedLocation: "https://dashboard.example.com/wallet?pay=fail",
			pendingLocation:  "https://dashboard.example.com/wallet?pay=pending",
		},
	}
	router := gin.New()
	for _, endpoint := range endpoints {
		router.Any(endpoint.path, endpoint.handler)
	}
	for _, endpoint := range endpoints {
		for _, method := range []string{http.MethodGet, http.MethodPost} {
			for _, tc := range cases {
				t.Run(endpoint.name+"/"+method+"/"+tc.name, func(t *testing.T) {
					params := url.Values{
						"pid": {"epay_id"}, "type": {"alipay"}, "money": {"1.00"},
						"name": {tc.productName}, "out_trade_no": {tc.tradeNo},
						"trade_status": {tc.status}, "sign_type": {"MD5"},
					}
					if tc.sign != "" {
						params.Set("sign", tc.sign)
					}
					request := httptest.NewRequest(method, endpoint.path+"?"+params.Encode(), nil)
					if method == http.MethodPost {
						request = httptest.NewRequest(method, endpoint.path, strings.NewReader(params.Encode()))
						request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
					}
					recorder := httptest.NewRecorder()
					require.NotPanics(t, func() { router.ServeHTTP(recorder, request) })
					assert.Equal(t, endpoint.status, recorder.Code)
					wantBody, wantLocation := endpoint.rejectedBody, endpoint.rejectedLocation
					if tc.validPending {
						wantBody, wantLocation = endpoint.pendingBody, endpoint.pendingLocation
					}
					if wantBody != "" {
						assert.Equal(t, wantBody, recorder.Body.String())
					}
					assert.Equal(t, wantLocation, recorder.Header().Get("Location"))
				})
			}
		}
	}
}

// 订阅套餐的官方通道回调只有三道关都过才会发放：验签、app_id、金额。发放本身
// 要读套餐、写订阅卡，所以这里只播种订单——任何一次误入发放都会因为缺少套餐而
// 变成失败，从而让「拒绝发生在发放之前」这条契约在测试里可见。
func TestSubscriptionOfficialCallbacksRejectBeforeGranting(t *testing.T) {
	confirmPaymentComplianceForTest(t)

	keys := newSubscriptionCallbackKeys(t)
	originalEnabled := setting.AlipayEnabled
	originalAppID, originalPrivateKey, originalPublicKey := setting.AlipayAppId, setting.AlipayPrivateKey, setting.AlipayPublicKey
	originalWechatEnabled := setting.WechatPayEnabled
	originalMchID, originalApiV3Key, originalWechatPrivate, originalPlatformKey := setting.WechatPayMchId, setting.WechatPayApiV3Key, setting.WechatPayPrivateKey, setting.WechatPayPlatformPublicKey
	originalSerialNo, originalWechatAppID := setting.WechatPayMchSerialNo, setting.WechatPayAppId
	previousDB := model.DB
	t.Cleanup(func() {
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppId, setting.AlipayPrivateKey, setting.AlipayPublicKey = originalAppID, originalPrivateKey, originalPublicKey
		setting.WechatPayEnabled = originalWechatEnabled
		setting.WechatPayMchId, setting.WechatPayApiV3Key = originalMchID, originalApiV3Key
		setting.WechatPayPrivateKey, setting.WechatPayPlatformPublicKey = originalWechatPrivate, originalPlatformKey
		setting.WechatPayMchSerialNo, setting.WechatPayAppId = originalSerialNo, originalWechatAppID
		model.DB = previousDB
	})

	setting.AlipayEnabled = true
	setting.AlipayAppId = "2021000000000000"
	setting.AlipayPrivateKey = keys.privateKey
	setting.AlipayPublicKey = keys.publicKey
	setting.WechatPayEnabled = true
	setting.WechatPayAppId = "wx0000000000000000"
	setting.WechatPayMchId = "1900000000"
	setting.WechatPayMchSerialNo = "serial"
	setting.WechatPayPrivateKey = keys.privateKey
	setting.WechatPayApiV3Key = "0123456789abcdef0123456789abcdef"
	setting.WechatPayPlatformPublicKey = keys.publicKey

	db, _ := newAuditTestDatabase(t, "sqlite", "")
	require.NoError(t, db.AutoMigrate(&model.SubscriptionOrder{}))
	model.DB = db
	order := &model.SubscriptionOrder{
		UserId:          77,
		PlanId:          9,
		Money:           19.90,
		TradeNo:         "SUBUSR77NOALIPAY",
		PaymentMethod:   model.PaymentMethodAlipayOfficial,
		PaymentProvider: model.PaymentProviderAlipay,
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, order.Insert())

	router := gin.New()
	router.POST("/api/subscription/alipay/notify", SubscriptionAlipayNotify)
	router.POST("/api/subscription/wechat/notify", SubscriptionWechatNotify)

	alipayParams := func(mutate func(url.Values)) url.Values {
		params := url.Values{
			"app_id":       {setting.AlipayAppId},
			"out_trade_no": {order.TradeNo},
			"trade_status": {"TRADE_SUCCESS"},
			"total_amount": {"19.90"},
			"sign_type":    {"RSA2"},
		}
		mutate(params)
		unsigned := map[string]string{}
		for key := range params {
			// 支付宝约定异步通知去掉 sign 与 sign_type 后参与验签。
			if key == "sign" || key == "sign_type" {
				continue
			}
			unsigned[key] = params.Get(key)
		}
		signature, err := service.AlipayRSASign(service.AlipaySignContent(unsigned), keys.privateKey)
		require.NoError(t, err)
		params.Set("sign", signature)
		return params
	}
	post := func(path string, body string, contentType string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
		request.Header.Set("Content-Type", contentType)
		recorder := httptest.NewRecorder()
		require.NotPanics(t, func() { router.ServeHTTP(recorder, request) })
		return recorder
	}

	cases := []struct {
		name string
		form url.Values
	}{
		{"unsigned notification", url.Values{"out_trade_no": {order.TradeNo}}},
		{"tampered amount", alipayParams(func(v url.Values) { v.Set("total_amount", "0.01") })},
		{"foreign app id", alipayParams(func(v url.Values) { v.Set("app_id", "2021999999999999") })},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			recorder := post("/api/subscription/alipay/notify", tc.form.Encode(), "application/x-www-form-urlencoded")
			assert.Equal(t, http.StatusOK, recorder.Code)
			assert.Equal(t, "failure", recorder.Body.String())

			var stored model.SubscriptionOrder
			require.NoError(t, db.Where("trade_no = ?", order.TradeNo).First(&stored).Error)
			assert.Equal(t, common.TopUpStatusPending, stored.Status, "拒绝的通知不得改变订单状态")
		})
	}

	// 金额被篡改的签名通知还会在主动查单补发路径上被挡一次；这里只校验关卡函数，
	// 避免伪造一个网关。
	assert.False(t, subscriptionOrderMatchesAlipayPayment(&model.SubscriptionOrder{Money: 19.90, PaymentProvider: model.PaymentProviderAlipay}, "0.01"))
	assert.True(t, subscriptionOrderMatchesAlipayPayment(&model.SubscriptionOrder{Money: 19.90, PaymentProvider: model.PaymentProviderAlipay}, "19.900"))
	assert.False(t, subscriptionOrderMatchesAlipayPayment(&model.SubscriptionOrder{Money: 19.90, PaymentProvider: model.PaymentProviderEpay}, "19.90"))
	assert.False(t, subscriptionOrderMatchesAlipayPayment(nil, "19.90"))
	assert.False(t, subscriptionOrderMatchesWechatPayment(&model.SubscriptionOrder{Money: 19.90, PaymentProvider: model.PaymentProviderWechat}, 1890))
	assert.True(t, subscriptionOrderMatchesWechatPayment(&model.SubscriptionOrder{Money: 19.90, PaymentProvider: model.PaymentProviderWechat}, 1990))

	// 微信回调是加密报文：伪造或损坏的报文必须被拒，且不能碰订单。
	wechat := post("/api/subscription/wechat/notify", `{"id":"fake"}`, "application/json")
	assert.Equal(t, http.StatusBadRequest, wechat.Code)
	assert.Contains(t, wechat.Body.String(), "invalid notification")
}

type subscriptionCallbackKeys struct {
	privateKey string
	publicKey  string
}

func newSubscriptionCallbackKeys(t *testing.T) subscriptionCallbackKeys {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	privateDER, err := x509.MarshalPKCS8PrivateKey(key)
	require.NoError(t, err)
	publicDER, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)
	return subscriptionCallbackKeys{
		privateKey: string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privateDER})),
		publicKey:  string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicDER})),
	}
}
