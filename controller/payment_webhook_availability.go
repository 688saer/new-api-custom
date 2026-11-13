package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func isPaymentComplianceConfirmed() bool {
	return operation_setting.IsPaymentComplianceConfirmed()
}

func isStripeTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	return strings.TrimSpace(setting.StripeApiSecret) != "" &&
		strings.TrimSpace(setting.StripeWebhookSecret) != "" &&
		strings.TrimSpace(setting.StripePriceId) != ""
}

func isStripeWebhookConfigured() bool {
	return strings.TrimSpace(setting.StripeWebhookSecret) != ""
}

func isStripeWebhookEnabled() bool {
	return isStripeTopUpEnabled()
}

func isCreemTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	products := strings.TrimSpace(setting.CreemProducts)
	return strings.TrimSpace(setting.CreemApiKey) != "" &&
		products != "" &&
		products != "[]"
}

// 订阅套餐走官方支付时，商品由套餐自己的 price id 决定，与钱包充值的固定商品无关，
// 因此这里只校验凭据，不要求配置充值用的 StripePriceId / CreemProducts。
func isStripeSubscriptionPayAvailable() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	secret := strings.TrimSpace(setting.StripeApiSecret)
	return (strings.HasPrefix(secret, "sk_") || strings.HasPrefix(secret, "rk_")) &&
		strings.TrimSpace(setting.StripeWebhookSecret) != ""
}

func isCreemSubscriptionPayAvailable() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	return strings.TrimSpace(setting.CreemApiKey) != ""
}

func isWaffoPancakeSubscriptionPayAvailable() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	return strings.TrimSpace(setting.WaffoPancakeMerchantID) != "" &&
		strings.TrimSpace(setting.WaffoPancakePrivateKey) != ""
}

// 支付宝官方与微信支付官方没有「充值商品」这一层：套餐金额直接用于下单，所以
// 订阅结账与钱包充值使用同一套凭据判定，不存在套餐被充值配置卡住的情况。
func isAlipaySubscriptionPayAvailable() bool {
	return isAlipayTopUpEnabled()
}

func isWechatSubscriptionPayAvailable() bool {
	return isWechatTopUpEnabled()
}

func isCreemWebhookConfigured() bool {
	return strings.TrimSpace(setting.CreemWebhookSecret) != ""
}

func isCreemWebhookEnabled() bool {
	return isCreemTopUpEnabled() && isCreemWebhookConfigured()
}

func isWaffoTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	if !setting.WaffoEnabled {
		return false
	}

	return isWaffoWebhookConfigured()
}

func isWaffoWebhookConfigured() bool {
	if setting.WaffoSandbox {
		return strings.TrimSpace(setting.WaffoSandboxApiKey) != "" &&
			strings.TrimSpace(setting.WaffoSandboxPrivateKey) != "" &&
			strings.TrimSpace(setting.WaffoSandboxPublicCert) != ""
	}

	return strings.TrimSpace(setting.WaffoApiKey) != "" &&
		strings.TrimSpace(setting.WaffoPrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPublicCert) != ""
}

func isWaffoWebhookEnabled() bool {
	return isWaffoTopUpEnabled()
}

func isWaffoPancakeTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	// Presence-of-credentials = enabled. Webhook public keys ship inside
	// the SDK; mode (test/prod) is read from each event.
	return strings.TrimSpace(setting.WaffoPancakeMerchantID) != "" &&
		strings.TrimSpace(setting.WaffoPancakePrivateKey) != "" &&
		strings.TrimSpace(setting.WaffoPancakeProductID) != ""
}

func isWaffoPancakeWebhookConfigured() bool {
	return isWaffoPancakeTopUpEnabled()
}

func isWaffoPancakeWebhookEnabled() bool {
	return isWaffoPancakeTopUpEnabled()
}

// 支付宝官方通道：开关 + 三个必要凭据都齐了才算可用，缺一个就别让用户点进去。
func isAlipayTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	if !setting.AlipayEnabled {
		return false
	}
	return isAlipayWebhookConfigured()
}

func isAlipayWebhookConfigured() bool {
	return strings.TrimSpace(setting.AlipayAppId) != "" &&
		strings.TrimSpace(setting.AlipayPrivateKey) != "" &&
		strings.TrimSpace(setting.AlipayPublicKey) != ""
}

func isAlipayWebhookEnabled() bool {
	return isAlipayTopUpEnabled()
}

func isWechatTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	if !setting.WechatPayEnabled {
		return false
	}
	return isWechatWebhookConfigured()
}

func isWechatWebhookConfigured() bool {
	return strings.TrimSpace(setting.WechatPayAppId) != "" &&
		strings.TrimSpace(setting.WechatPayMchId) != "" &&
		strings.TrimSpace(setting.WechatPayMchSerialNo) != "" &&
		strings.TrimSpace(setting.WechatPayPrivateKey) != "" &&
		strings.TrimSpace(setting.WechatPayApiV3Key) != "" &&
		strings.TrimSpace(setting.WechatPayPlatformPublicKey) != ""
}

func isWechatWebhookEnabled() bool {
	return isWechatTopUpEnabled()
}
func isEpayTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		return false
	}
	return isEpayWebhookConfigured() && len(operation_setting.PayMethods) > 0
}

func isEpayWebhookConfigured() bool {
	return strings.TrimSpace(operation_setting.PayAddress) != "" &&
		strings.TrimSpace(operation_setting.EpayId) != "" &&
		strings.TrimSpace(operation_setting.EpayKey) != ""
}

func isEpayWebhookEnabled() bool {
	return isEpayTopUpEnabled()
}
