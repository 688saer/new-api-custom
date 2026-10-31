package service

import (
	"bytes"
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// 微信支付 APIv3（Native 扫码）本地实现。
//
// 和支付宝一样，签名全在本地做：商户私钥签请求，微信支付公钥验回调。回调报文
// 是加密的，必须用 APIv3 密钥做 AES-256-GCM 解密，解出来的才是真正的订单数据。

const (
	// WechatPayDefaultGateway 可被后台的网关覆盖，联调时可以指向假网关。
	WechatPayDefaultGateway = "https://api.mch.weixin.qq.com"
	wechatNativePath        = "/v3/pay/transactions/native"
	wechatQueryPath         = "/v3/pay/transactions/out-trade-no/"
	wechatPayAuthType       = "WECHATPAY2-SHA256-RSA2048"
	// wechatPayNotifyTolerance 回调时间戳的容忍窗口，用来挡重放。
	wechatPayNotifyTolerance = 5 * time.Minute
)

type WechatPayConfig struct {
	AppId             string
	MchId             string
	MchSerialNo       string
	PrivateKey        string
	ApiV3Key          string
	PlatformPublicKey string
	Gateway           string
}

type WechatPayOrder struct {
	OutTradeNo  string
	Description string
	TotalFen    int64
	NotifyUrl   string
}

// WechatPayNotification 是解密之后的交易通知，只保留入账需要的字段。
type WechatPayNotification struct {
	OutTradeNo    string
	TransactionId string
	TradeState    string
	TotalFen      int64
	MchId         string
	AppId         string
}

func WechatPayGateway(cfg WechatPayConfig) string {
	gateway := strings.TrimSpace(cfg.Gateway)
	if gateway == "" {
		return WechatPayDefaultGateway
	}
	return strings.TrimRight(gateway, "/")
}

// CreateWechatNativeOrder 下单并返回 weixin:// 支付链接，前端据此画二维码，
// 手机浏览器则直接用它唤起微信。
func CreateWechatNativeOrder(cfg WechatPayConfig, order WechatPayOrder) (string, error) {
	if strings.TrimSpace(cfg.MchId) == "" {
		return "", errors.New("wechat pay merchant id is not configured")
	}
	if order.TotalFen <= 0 {
		return "", errors.New("wechat pay amount must be positive")
	}
	payload, err := common.Marshal(map[string]any{
		"appid":        strings.TrimSpace(cfg.AppId),
		"mchid":        strings.TrimSpace(cfg.MchId),
		"description":  order.Description,
		"out_trade_no": order.OutTradeNo,
		"notify_url":   order.NotifyUrl,
		"amount": map[string]any{
			"total":    order.TotalFen,
			"currency": "CNY",
		},
	})
	if err != nil {
		return "", err
	}
	body, status, err := wechatPayRequest(cfg, http.MethodPost, wechatNativePath, payload)
	if err != nil {
		return "", err
	}
	if status != http.StatusOK {
		return "", fmt.Errorf("wechat pay native order rejected status=%d body=%s", status, compactBody(body))
	}
	var response struct {
		CodeUrl string `json:"code_url"`
	}
	if err := common.Unmarshal(body, &response); err != nil {
		return "", fmt.Errorf("wechat pay native response is not readable: %w", err)
	}
	if strings.TrimSpace(response.CodeUrl) == "" {
		return "", errors.New("wechat pay native order returned no code url")
	}
	return response.CodeUrl, nil
}

// QueryWechatOrder 主动查单。微信侧没有这笔交易时回 404，这里按「还没付款」处理。
func QueryWechatOrder(cfg WechatPayConfig, outTradeNo string) (string, int64, error) {
	outTradeNo = strings.TrimSpace(outTradeNo)
	if outTradeNo == "" {
		return "", 0, errors.New("wechat pay trade no is required")
	}
	path := wechatQueryPath + url.PathEscape(outTradeNo) + "?mchid=" + url.QueryEscape(strings.TrimSpace(cfg.MchId))
	body, status, err := wechatPayRequest(cfg, http.MethodGet, path, nil)
	if err != nil {
		return "", 0, err
	}
	if status == http.StatusNotFound {
		return "", 0, nil
	}
	if status != http.StatusOK {
		return "", 0, fmt.Errorf("wechat pay query rejected status=%d body=%s", status, compactBody(body))
	}
	var response struct {
		TradeState string `json:"trade_state"`
		Amount     struct {
			Total int64 `json:"total"`
		} `json:"amount"`
	}
	if err := common.Unmarshal(body, &response); err != nil {
		return "", 0, fmt.Errorf("wechat pay query response is not readable: %w", err)
	}
	return strings.TrimSpace(response.TradeState), response.Amount.Total, nil
}

// DecryptWechatPayNotification 先验签再解密，任何一步不过都当伪造处理。
func DecryptWechatPayNotification(cfg WechatPayConfig, header http.Header, body []byte) (*WechatPayNotification, error) {
	if err := VerifyWechatPaySignature(cfg.PlatformPublicKey,
		header.Get("Wechatpay-Timestamp"),
		header.Get("Wechatpay-Nonce"),
		string(body),
		header.Get("Wechatpay-Signature"),
	); err != nil {
		return nil, err
	}

	var envelope struct {
		EventType string `json:"event_type"`
		Resource  struct {
			Algorithm      string `json:"algorithm"`
			Ciphertext     string `json:"ciphertext"`
			Nonce          string `json:"nonce"`
			AssociatedData string `json:"associated_data"`
		} `json:"resource"`
	}
	if err := common.Unmarshal(body, &envelope); err != nil {
		return nil, fmt.Errorf("wechat pay notification is not readable: %w", err)
	}
	plain, err := decryptWechatPayResource(cfg.ApiV3Key, envelope.Resource.Nonce, envelope.Resource.AssociatedData, envelope.Resource.Ciphertext)
	if err != nil {
		return nil, err
	}

	var transaction struct {
		AppId         string `json:"appid"`
		MchId         string `json:"mchid"`
		OutTradeNo    string `json:"out_trade_no"`
		TransactionId string `json:"transaction_id"`
		TradeState    string `json:"trade_state"`
		Amount        struct {
			Total int64 `json:"total"`
		} `json:"amount"`
	}
	if err := common.Unmarshal(plain, &transaction); err != nil {
		return nil, fmt.Errorf("wechat pay notification payload is not readable: %w", err)
	}
	return &WechatPayNotification{
		OutTradeNo:    strings.TrimSpace(transaction.OutTradeNo),
		TransactionId: strings.TrimSpace(transaction.TransactionId),
		TradeState:    strings.TrimSpace(transaction.TradeState),
		TotalFen:      transaction.Amount.Total,
		MchId:         strings.TrimSpace(transaction.MchId),
		AppId:         strings.TrimSpace(transaction.AppId),
	}, nil
}

// VerifyWechatPaySignature 用微信支付公钥校验回调，时间戳超出窗口直接拒。
func VerifyWechatPaySignature(publicKey string, timestamp string, nonce string, body string, signature string) error {
	if strings.TrimSpace(signature) == "" {
		return errors.New("wechat pay signature is missing")
	}
	seconds, err := strconv.ParseInt(strings.TrimSpace(timestamp), 10, 64)
	if err != nil {
		return errors.New("wechat pay signature timestamp is invalid")
	}
	drift := time.Since(time.Unix(seconds, 0))
	if drift > wechatPayNotifyTolerance || drift < -wechatPayNotifyTolerance {
		return errors.New("wechat pay signature timestamp is out of range")
	}
	key, err := parseRSAPublicKey(publicKey)
	if err != nil {
		return err
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(signature))
	if err != nil {
		return errors.New("wechat pay signature is not base64")
	}
	message := strings.TrimSpace(timestamp) + "\n" + nonce + "\n" + body + "\n"
	digest := sha256.Sum256([]byte(message))
	return rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], decoded)
}

func wechatPayRequest(cfg WechatPayConfig, method string, path string, payload []byte) ([]byte, int, error) {
	if strings.TrimSpace(cfg.MchId) == "" || strings.TrimSpace(cfg.MchSerialNo) == "" {
		return nil, 0, errors.New("wechat pay merchant credentials are not configured")
	}
	body := ""
	if payload != nil {
		body = string(payload)
	}
	authorization, err := wechatPayAuthorization(cfg, method, path, body)
	if err != nil {
		return nil, 0, err
	}

	var reader io.Reader
	if payload != nil {
		reader = bytes.NewReader(payload)
	}
	request, err := http.NewRequest(method, WechatPayGateway(cfg)+path, reader)
	if err != nil {
		return nil, 0, err
	}
	request.Header.Set("Authorization", authorization)
	request.Header.Set("Accept", "application/json")
	request.Header.Set("User-Agent", "new-api/wechatpay")
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	response, err := GetHttpClient().Do(request)
	if err != nil {
		return nil, 0, err
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return nil, 0, err
	}
	return responseBody, response.StatusCode, nil
}

func wechatPayAuthorization(cfg WechatPayConfig, method string, path string, body string) (string, error) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	nonce := strings.ToLower(common.GetRandomString(32))
	message := method + "\n" + path + "\n" + timestamp + "\n" + nonce + "\n" + body + "\n"
	signature, err := signWechatPayMessage(message, cfg.PrivateKey)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`%s mchid="%s",nonce_str="%s",signature="%s",timestamp="%s",serial_no="%s"`,
		wechatPayAuthType,
		strings.TrimSpace(cfg.MchId),
		nonce,
		signature,
		timestamp,
		strings.TrimSpace(cfg.MchSerialNo),
	), nil
}

func signWechatPayMessage(message string, privateKey string) (string, error) {
	key, err := parseRSAPrivateKey(privateKey)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256([]byte(message))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

func decryptWechatPayResource(apiV3Key string, nonce string, associatedData string, ciphertext string) ([]byte, error) {
	key := []byte(strings.TrimSpace(apiV3Key))
	if len(key) != 32 {
		return nil, errors.New("wechat pay api v3 key must be 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return nil, errors.New("wechat pay notification ciphertext is not base64")
	}
	plain, err := gcm.Open(nil, []byte(nonce), data, []byte(associatedData))
	if err != nil {
		return nil, errors.New("wechat pay notification could not be decrypted")
	}
	return plain, nil
}

func compactBody(body []byte) string {
	text := strings.TrimSpace(string(body))
	if len(text) > 200 {
		return text[:200]
	}
	return text
}
