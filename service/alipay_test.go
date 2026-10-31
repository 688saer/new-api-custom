package service

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 支付宝这套东西的正确性全压在签名上：签名错了，用户付了钱也到不了账；
// 验签松了，任何人都能伪造一条通知白拿额度。下面每个用例都对着这个风险。

type alipayTestKeys struct {
	privateKey string
	publicKey  string
}

func newAlipayTestKeys(t *testing.T) alipayTestKeys {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	privatePEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: mustPKCS8(t, key)})
	publicDER, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	require.NoError(t, err)
	publicPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicDER})
	return alipayTestKeys{privateKey: string(privatePEM), publicKey: string(publicPEM)}
}

func mustPKCS8(t *testing.T, key *rsa.PrivateKey) []byte {
	t.Helper()
	encoded, err := x509.MarshalPKCS8PrivateKey(key)
	require.NoError(t, err)
	return encoded
}

func verifyWithPublicKey(t *testing.T, content string, signature string, publicKey string) error {
	t.Helper()
	block, _ := pem.Decode([]byte(publicKey))
	require.NotNil(t, block)
	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	require.NoError(t, err)
	key, ok := parsed.(*rsa.PublicKey)
	require.True(t, ok)
	decoded, err := base64.StdEncoding.DecodeString(signature)
	require.NoError(t, err)
	digest := sha256.Sum256([]byte(content))
	return rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], decoded)
}

func TestAlipaySignContentKeepsOnlySortedNonEmptyParams(t *testing.T) {
	params := map[string]string{
		"b":    "2",
		"a":    "1",
		"sign": "ignored",
		"c":    "",
	}

	assert.Equal(t, "a=1&b=2", AlipaySignContent(params))
}

func TestAlipaySignatureRoundTripsAndRejectsTampering(t *testing.T) {
	keys := newAlipayTestKeys(t)
	content := "app_id=2021000000000000&method=alipay.trade.page.pay&total_amount=10.00"

	signature, err := AlipayRSASign(content, keys.privateKey)
	require.NoError(t, err)
	require.NoError(t, verifyWithPublicKey(t, content, signature, keys.publicKey))

	// 内容被改一个字符就必须验不过，否则金额可以被中间人改写。
	require.Error(t, verifyWithPublicKey(t, strings.Replace(content, "10.00", "0.01", 1), signature, keys.publicKey))
}

func TestAlipayKeysMayBePastedAsBareBase64(t *testing.T) {
	keys := newAlipayTestKeys(t)
	pasted := alipayTestKeys{
		privateKey: strings.Join(strings.Fields(strings.NewReplacer(
			"-----BEGIN PRIVATE KEY-----", "",
			"-----END PRIVATE KEY-----", "",
		).Replace(keys.privateKey)), "\n"),
		publicKey: strings.Join(strings.Fields(strings.NewReplacer(
			"-----BEGIN PUBLIC KEY-----", "",
			"-----END PUBLIC KEY-----", "",
		).Replace(keys.publicKey)), "\n"),
	}

	// 裸 base64 也要能直接开工：签名走一遍，再用公钥验回来。
	signed := map[string]string{"app_id": "2021000000000000"}
	require.NoError(t, SignAlipayParams(AlipayConfig{PrivateKey: pasted.privateKey}, signed))
	require.NoError(t, VerifyAlipayNotifySign(signed, pasted.publicKey))
}

func TestBuildAlipayPaymentURLSignsTheCheckoutRequest(t *testing.T) {
	keys := newAlipayTestKeys(t)
	cfg := AlipayConfig{AppId: "2021000000000000", PrivateKey: keys.privateKey, PublicKey: keys.publicKey}
	order := AlipayOrder{
		OutTradeNo:  "USR1NOABC123",
		Subject:     "账户充值 10",
		TotalAmount: "10.00",
		NotifyUrl:   "https://example.com/api/user/alipay/notify",
		ReturnUrl:   "https://example.com/wallet",
	}

	for product, expectedMethod := range map[string]string{
		AlipayProductPage: "alipay.trade.page.pay",
		AlipayProductWap:  "alipay.trade.wap.pay",
	} {
		order.Product = product
		payURL, err := BuildAlipayPaymentURL(cfg, order)
		require.NoError(t, err)
		require.True(t, strings.HasPrefix(payURL, AlipayGatewayProduction+"?"), payURL)

		parsed, err := url.Parse(payURL)
		require.NoError(t, err)
		query := parsed.Query()
		assert.Equal(t, expectedMethod, query.Get("method"))
		assert.Equal(t, "RSA2", query.Get("sign_type"))
		assert.Contains(t, query.Get("biz_content"), `"out_trade_no":"USR1NOABC123"`)
		assert.Equal(t, order.ReturnUrl, query.Get("return_url"))

		// 用我们自己的公钥能验回来，说明发出去的这串确实被私钥签过。
		params := make(map[string]string, len(query))
		for key := range query {
			params[key] = query.Get(key)
		}
		require.NoError(t, verifyWithPublicKey(t, AlipaySignContent(params), params["sign"], keys.publicKey))
	}
}

func TestBuildAlipayPaymentURLRejectsUnsupportedProduct(t *testing.T) {
	keys := newAlipayTestKeys(t)
	cfg := AlipayConfig{AppId: "2021000000000000", PrivateKey: keys.privateKey}
	_, err := BuildAlipayPaymentURL(cfg, AlipayOrder{OutTradeNo: "X", TotalAmount: "1.00", Product: "mpm"})
	require.Error(t, err)
}

func TestAlipayNotifyVerificationAcceptsValidAndRejectsTamperedParams(t *testing.T) {
	keys := newAlipayTestKeys(t)
	params := map[string]string{
		"app_id":       "2021000000000000",
		"out_trade_no": "USR1NOABC123",
		"total_amount": "10.00",
		"trade_status": "TRADE_SUCCESS",
		"sign_type":    "RSA2",
	}
	// 通知签名覆盖除 sign / sign_type 之外的全部参数，支付宝就是这么算的。
	signature, err := AlipayRSASign(AlipaySignContent(map[string]string{
		"app_id":       params["app_id"],
		"out_trade_no": params["out_trade_no"],
		"total_amount": params["total_amount"],
		"trade_status": params["trade_status"],
	}), keys.privateKey)
	require.NoError(t, err)
	params["sign"] = signature

	require.NoError(t, VerifyAlipayNotifySign(params, keys.publicKey))

	tampered := make(map[string]string, len(params))
	for key, value := range params {
		tampered[key] = value
	}
	tampered["total_amount"] = "0.01"
	require.Error(t, VerifyAlipayNotifySign(tampered, keys.publicKey))

	unsigned := make(map[string]string, len(params))
	for key, value := range params {
		if key != "sign" {
			unsigned[key] = value
		}
	}
	require.Error(t, VerifyAlipayNotifySign(unsigned, keys.publicKey))
}

func TestCreateAlipayPrecreateReadsQrCodeFromGateway(t *testing.T) {
	keys := newAlipayTestKeys(t)
	InitHttpClient()

	var received url.Values
	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseForm())
		received = r.PostForm
		_, _ = w.Write([]byte(`{"alipay_trade_precreate_response":{"code":"10000","msg":"Success","qr_code":"https://qr.alipay.com/bax01234"}}`))
	}))
	defer gateway.Close()

	cfg := AlipayConfig{AppId: "2021000000000000", PrivateKey: keys.privateKey, PublicKey: keys.publicKey, Gateway: gateway.URL}
	qrCode, err := CreateAlipayPrecreate(cfg, AlipayOrder{OutTradeNo: "USR1NOABC123", Subject: "账户充值 10", TotalAmount: "10.00"})
	require.NoError(t, err)
	assert.Equal(t, "https://qr.alipay.com/bax01234", qrCode)
	assert.Equal(t, "alipay.trade.precreate", received.Get("method"))
	assert.Contains(t, received.Get("biz_content"), `"timeout_express":"30m"`)

	// 网关只认签过名的请求：漏签会被回 40002 Invalid Arguments。
	unsigned := make(map[string]string, len(received))
	for key := range received {
		if key == "sign" {
			continue
		}
		unsigned[key] = received.Get(key)
	}
	require.NotEmpty(t, received.Get("sign"))
	require.NoError(t, verifyWithPublicKey(t, AlipaySignContent(unsigned), received.Get("sign"), keys.publicKey))
}

func TestCreateAlipayPrecreateReportsGatewayRejection(t *testing.T) {
	keys := newAlipayTestKeys(t)
	InitHttpClient()

	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"alipay_trade_precreate_response":{"code":"40004","msg":"Business Failed","sub_msg":"商户状态不正确"}}`))
	}))
	defer gateway.Close()

	cfg := AlipayConfig{AppId: "2021000000000000", PrivateKey: keys.privateKey, PublicKey: keys.publicKey, Gateway: gateway.URL}
	_, err := CreateAlipayPrecreate(cfg, AlipayOrder{OutTradeNo: "USR1NOABC123", TotalAmount: "10.00"})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "40004")
}

func TestAlipayAmountRendersTwoDecimals(t *testing.T) {
	assert.Equal(t, "10.00", AlipayAmount(10))
	assert.Equal(t, "9.90", AlipayAmount(9.9))
}
