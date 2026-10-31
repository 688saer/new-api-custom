package service

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 微信支付的钱同样压在签名和解密上：签名错了付了钱不到账，验签松了谁都能伪造
// 通知白拿额度，解密错了则永远拿不到订单号。下面每个用例对着其中一个风险。

const wechatTestApiV3Key = "0123456789abcdef0123456789abcdef"

func newWechatTestConfig(t *testing.T, gateway string, keys alipayTestKeys) WechatPayConfig {
	t.Helper()
	return WechatPayConfig{
		AppId:             "wx1234567890abcdef",
		MchId:             "1900000001",
		MchSerialNo:       "5157F09EFDC096DE15EBE81A47057A7232F1B8E1",
		PrivateKey:        keys.privateKey,
		ApiV3Key:          wechatTestApiV3Key,
		PlatformPublicKey: keys.publicKey,
		Gateway:           gateway,
	}
}

// wechatAuthField 从 Authorization 头里取一个字段，用来还原签名串。
func wechatAuthField(authorization string, name string) string {
	marker := name + `="`
	start := strings.Index(authorization, marker)
	if start < 0 {
		return ""
	}
	rest := authorization[start+len(marker):]
	end := strings.Index(rest, `"`)
	if end < 0 {
		return ""
	}
	return rest[:end]
}

func encryptWechatTestResource(t *testing.T, apiV3Key string, nonce string, associatedData string, plaintext string) string {
	t.Helper()
	block, err := aes.NewCipher([]byte(apiV3Key))
	require.NoError(t, err)
	gcm, err := cipher.NewGCM(block)
	require.NoError(t, err)
	sealed := gcm.Seal(nil, []byte(nonce), []byte(plaintext), []byte(associatedData))
	return base64.StdEncoding.EncodeToString(sealed)
}

func TestCreateWechatNativeOrderSignsRequestAndReturnsCodeUrl(t *testing.T) {
	InitHttpClient()

	var received http.Header
	var receivedBody string
	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/v3/pay/transactions/native", r.URL.Path)
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		received = r.Header.Clone()
		receivedBody = string(body)
		_, _ = w.Write([]byte(`{"code_url":"weixin://wxpay/bizpayurl?pr=test123"}`))
	}))
	defer gateway.Close()

	keys := newTestRSAKeys(t)
	cfg := newWechatTestConfig(t, gateway.URL, keys)
	codeUrl, err := CreateWechatNativeOrder(cfg, WechatPayOrder{
		OutTradeNo:  "USR1NOABC123",
		Description: "Top-up USR1NOABC123",
		TotalFen:    100,
		NotifyUrl:   "https://example.com/api/user/wechat/notify",
	})
	require.NoError(t, err)
	assert.Equal(t, "weixin://wxpay/bizpayurl?pr=test123", codeUrl)
	assert.Contains(t, receivedBody, `"out_trade_no":"USR1NOABC123"`)
	assert.Contains(t, receivedBody, `"total":100`)

	// 微信只认 SHA256-RSA2048 签名：任何字段对不上都会被拒。
	authorization := received.Get("Authorization")
	require.True(t, strings.HasPrefix(authorization, wechatPayAuthType+" "))
	timestamp := wechatAuthField(authorization, "timestamp")
	nonce := wechatAuthField(authorization, "nonce_str")
	signature := wechatAuthField(authorization, "signature")
	require.NotEmpty(t, timestamp)
	require.NotEmpty(t, nonce)
	require.NotEmpty(t, signature)
	message := http.MethodPost + "\n/v3/pay/transactions/native\n" + timestamp + "\n" + nonce + "\n" + receivedBody + "\n"
	require.NoError(t, verifyWithPublicKey(t, message, signature, cfg.PlatformPublicKey))
}

func TestDecryptWechatPayNotificationVerifiesAndDecrypts(t *testing.T) {
	keys := newTestRSAKeys(t)
	transaction := `{"appid":"wx1234567890abcdef","mchid":"1900000001","out_trade_no":"USR1NOABC123","transaction_id":"4200001234202610311234567890","trade_state":"SUCCESS","amount":{"total":100,"currency":"CNY"}}`
	ciphertext := encryptWechatTestResource(t, wechatTestApiV3Key, "abcdefghijkl", "transaction", transaction)
	body := `{"id":"evt-1","event_type":"TRANSACTION.SUCCESS","resource":{"algorithm":"AEAD_AES_256_GCM","ciphertext":"` + ciphertext + `","nonce":"abcdefghijkl","associated_data":"transaction"}}`
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	headerNonce := "noncefromheader"
	signature, err := signWechatPayMessage(timestamp+"\n"+headerNonce+"\n"+body+"\n", keys.privateKey)
	require.NoError(t, err)

	header := http.Header{}
	header.Set("Wechatpay-Timestamp", timestamp)
	header.Set("Wechatpay-Nonce", headerNonce)
	header.Set("Wechatpay-Signature", signature)

	cfg := WechatPayConfig{ApiV3Key: wechatTestApiV3Key, PlatformPublicKey: keys.publicKey}
	notification, err := DecryptWechatPayNotification(cfg, header, []byte(body))
	require.NoError(t, err)
	assert.Equal(t, "USR1NOABC123", notification.OutTradeNo)
	assert.Equal(t, "SUCCESS", notification.TradeState)
	assert.Equal(t, int64(100), notification.TotalFen)
	assert.Equal(t, "1900000001", notification.MchId)
}

func TestDecryptWechatPayNotificationRejectsTamperedBody(t *testing.T) {
	keys := newTestRSAKeys(t)
	transaction := `{"mchid":"1900000001","out_trade_no":"USR1NOABC123","trade_state":"SUCCESS","amount":{"total":100}}`
	ciphertext := encryptWechatTestResource(t, wechatTestApiV3Key, "abcdefghijkl", "transaction", transaction)
	body := `{"resource":{"algorithm":"AEAD_AES_256_GCM","ciphertext":"` + ciphertext + `","nonce":"abcdefghijkl","associated_data":"transaction"}}`
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	headerNonce := "noncefromheader"
	signature, err := signWechatPayMessage(timestamp+"\n"+headerNonce+"\n"+body+"\n", keys.privateKey)
	require.NoError(t, err)

	header := http.Header{}
	header.Set("Wechatpay-Timestamp", timestamp)
	header.Set("Wechatpay-Nonce", headerNonce)
	header.Set("Wechatpay-Signature", signature)

	// 报文被改一个字节，签名就不成立；时间戳过期同样必须拒。
	tampered := strings.Replace(body, "AEAD_AES_256_GCM", "AEAD_AES_256_GCM ", 1)
	cfg := WechatPayConfig{ApiV3Key: wechatTestApiV3Key, PlatformPublicKey: keys.publicKey}
	_, err = DecryptWechatPayNotification(cfg, header, []byte(tampered))
	require.Error(t, err)

	header.Set("Wechatpay-Timestamp", strconv.FormatInt(time.Now().Add(-10*time.Minute).Unix(), 10))
	_, err = DecryptWechatPayNotification(cfg, header, []byte(body))
	require.Error(t, err)
}

func TestQueryWechatOrderReadsTradeState(t *testing.T) {
	InitHttpClient()

	var receivedPath string
	var receivedQuery string
	var receivedAuthorization string
	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedPath = r.URL.Path
		receivedQuery = r.URL.RawQuery
		receivedAuthorization = r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"trade_state":"SUCCESS","amount":{"total":100,"currency":"CNY"}}`))
	}))
	defer gateway.Close()

	keys := newTestRSAKeys(t)
	cfg := newWechatTestConfig(t, gateway.URL, keys)
	tradeState, totalFen, err := QueryWechatOrder(cfg, "USR1NOABC123")
	require.NoError(t, err)
	assert.Equal(t, "SUCCESS", tradeState)
	assert.Equal(t, int64(100), totalFen)
	assert.Equal(t, "/v3/pay/transactions/out-trade-no/USR1NOABC123", receivedPath)
	assert.Equal(t, "mchid=1900000001", receivedQuery)

	timestamp := wechatAuthField(receivedAuthorization, "timestamp")
	nonce := wechatAuthField(receivedAuthorization, "nonce_str")
	signature := wechatAuthField(receivedAuthorization, "signature")
	message := http.MethodGet + "\n" + receivedPath + "?" + receivedQuery + "\n" + timestamp + "\n" + nonce + "\n\n"
	require.NoError(t, verifyWithPublicKey(t, message, signature, cfg.PlatformPublicKey))
}

func TestQueryWechatOrderTreatsMissingOrderAsUnpaid(t *testing.T) {
	InitHttpClient()

	gateway := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"code":"ORDER_NOT_EXIST","message":"订单不存在"}`))
	}))
	defer gateway.Close()

	keys := newTestRSAKeys(t)
	cfg := newWechatTestConfig(t, gateway.URL, keys)
	tradeState, totalFen, err := QueryWechatOrder(cfg, "USR1NOABC123")
	require.NoError(t, err)
	assert.Empty(t, tradeState)
	assert.Zero(t, totalFen)
}
