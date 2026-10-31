package service

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// 支付宝开放平台（官方）的下单与验签。
//
// 只用官方 v2 接口：page/wap 两个产品把用户带到收银台，qr 走当面付、服务端先
// 下单一笔再拿二维码。密钥格式与控制台给的一致：应用私钥（PKCS8 或 PKCS1）、
// 支付宝公钥（X.509），两者都允许是裸 base64，粘贴时多几个换行也不该失败。

const (
	AlipayProductPage = "page"
	AlipayProductWap  = "wap"
	AlipayProductQr   = "qr"

	AlipayGatewayProduction = "https://openapi.alipay.com/gateway.do"
	AlipayGatewaySandbox    = "https://openapi-sandbox.dl.alipaydev.com/gateway.do"

	alipaySignType    = "RSA2"
	alipayTimeLayout  = "2006-01-02 15:04:05"
	alipaySuccessCode = "10000"
)

// alipayTimeZone 是网关要求的时间基准（北京时间），不能跟着服务器时区走。
var alipayTimeZone = time.FixedZone("CST", 8*60*60)

// 产品到开放平台接口名的映射；只有 qr 需要服务端真正发一次请求。
var alipayProductMethods = map[string]string{
	AlipayProductPage: "alipay.trade.page.pay",
	AlipayProductWap:  "alipay.trade.wap.pay",
	AlipayProductQr:   "alipay.trade.precreate",
}

var alipayProductCodes = map[string]string{
	AlipayProductPage: "FAST_INSTANT_TRADE_PAY",
	AlipayProductWap:  "QUICK_WAP_WAY",
}

type AlipayConfig struct {
	AppId      string
	PrivateKey string
	PublicKey  string
	// Gateway 留空时按 Sandbox 选生产或沙箱网关。
	Gateway string
	Sandbox bool
}

type AlipayOrder struct {
	OutTradeNo  string
	Subject     string
	TotalAmount string
	NotifyUrl   string
	ReturnUrl   string
	Product     string
}

func AlipayGateway(cfg AlipayConfig) string {
	if gateway := strings.TrimSpace(cfg.Gateway); gateway != "" {
		return gateway
	}
	if cfg.Sandbox {
		return AlipayGatewaySandbox
	}
	return AlipayGatewayProduction
}

// AlipayAmount 把金额规范成支付宝要求的两位小数字符串。
func AlipayAmount(amount float64) string {
	return strconv.FormatFloat(amount, 'f', 2, 64)
}

// AlipaySignContent 拼出待签名串：跳过 sign 与空值，按参数名升序，k=v 用 & 连接。
// 值在这里不编码——URL 编码只发生在真正拼查询串的时候。
func AlipaySignContent(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for key, value := range params {
		if key == "sign" || value == "" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var builder strings.Builder
	for index, key := range keys {
		if index > 0 {
			builder.WriteByte('&')
		}
		builder.WriteString(key)
		builder.WriteByte('=')
		builder.WriteString(params[key])
	}
	return builder.String()
}

// SignAlipayParams 用应用私钥对参数签名，并把 sign 写回同一个 map。
func SignAlipayParams(cfg AlipayConfig, params map[string]string) error {
	signature, err := AlipayRSASign(AlipaySignContent(params), cfg.PrivateKey)
	if err != nil {
		return err
	}
	params["sign"] = signature
	return nil
}

// AlipayRSASign 用 RSA2（SHA256withRSA）签名，返回 base64。
func AlipayRSASign(content string, privateKey string) (string, error) {
	key, err := parseRSAPrivateKey(privateKey)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256([]byte(content))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

// VerifyAlipayNotifySign 校验异步通知的签名。支付宝约定去掉 sign 和 sign_type 后参与验签。
func VerifyAlipayNotifySign(params map[string]string, publicKey string) error {
	signature := strings.TrimSpace(params["sign"])
	if signature == "" {
		return errors.New("alipay notification signature is missing")
	}
	unsigned := make(map[string]string, len(params))
	for key, value := range params {
		if key == "sign" || key == "sign_type" {
			continue
		}
		unsigned[key] = value
	}
	return verifyAlipayRSA2(AlipaySignContent(unsigned), signature, publicKey)
}

func verifyAlipayRSA2(content string, signature string, publicKey string) error {
	key, err := parseRSAPublicKey(publicKey)
	if err != nil {
		return err
	}
	decoded, err := base64.StdEncoding.DecodeString(signature)
	if err != nil {
		return fmt.Errorf("alipay signature is not base64: %w", err)
	}
	digest := sha256.Sum256([]byte(content))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, digest[:], decoded); err != nil {
		return errors.New("alipay signature does not match")
	}
	return nil
}

// BuildAlipayPaymentURL 拼出带签名的收银台地址，前端直接整页跳过去。
func BuildAlipayPaymentURL(cfg AlipayConfig, order AlipayOrder) (string, error) {
	params, err := alipayOrderParams(cfg, order)
	if err != nil {
		return "", err
	}
	query := url.Values{}
	for key, value := range params {
		query.Set(key, value)
	}
	gateway := AlipayGateway(cfg)
	separator := "?"
	if strings.Contains(gateway, "?") {
		separator = "&"
	}
	return gateway + separator + query.Encode(), nil
}

// CreateAlipayPrecreate 走当面付下单，返回可以画成二维码的内容。
//
// 只读 qr_code、不验响应签名：真正决定是否给用户加额度的是异步通知，
// 而那条路径是验过签的，所以这里响应即使被替换也换不到额度。
func CreateAlipayPrecreate(cfg AlipayConfig, order AlipayOrder) (string, error) {
	order.Product = AlipayProductQr
	params, err := alipayOrderParams(cfg, order)
	if err != nil {
		return "", err
	}
	body, err := alipayGatewayPost(cfg, params)
	if err != nil {
		return "", err
	}

	var payload struct {
		Response struct {
			Code   string `json:"code"`
			Msg    string `json:"msg"`
			SubMsg string `json:"sub_msg"`
			QrCode string `json:"qr_code"`
		} `json:"alipay_trade_precreate_response"`
	}
	if err := common.Unmarshal(body, &payload); err != nil {
		return "", fmt.Errorf("alipay precreate response is not readable: %w", err)
	}
	if payload.Response.Code != alipaySuccessCode {
		return "", fmt.Errorf("alipay precreate rejected code=%s msg=%s sub_msg=%s", payload.Response.Code, payload.Response.Msg, payload.Response.SubMsg)
	}
	if strings.TrimSpace(payload.Response.QrCode) == "" {
		return "", errors.New("alipay precreate returned no qr code")
	}
	return payload.Response.QrCode, nil
}

// QueryAlipayTrade 主动问一次支付宝：这笔订单到底付款了没有。
//
// 「检测余额」按钮靠它把异步通知丢失或延迟的订单补记回来。用户还没扫码时
// 支付宝侧没有这笔交易（ACQ.TRADE_NOT_EXIST），这里按未支付处理，不是错误。
func QueryAlipayTrade(cfg AlipayConfig, outTradeNo string) (tradeStatus string, paidAmount string, err error) {
	outTradeNo = strings.TrimSpace(outTradeNo)
	if outTradeNo == "" {
		return "", "", errors.New("alipay trade no is required")
	}
	appId := strings.TrimSpace(cfg.AppId)
	if appId == "" {
		return "", "", errors.New("alipay app id is not configured")
	}
	bizContent, err := common.Marshal(map[string]any{"out_trade_no": outTradeNo})
	if err != nil {
		return "", "", err
	}
	body, err := alipayGatewayPost(cfg, map[string]string{
		"app_id":      appId,
		"method":      "alipay.trade.query",
		"format":      "JSON",
		"charset":     "utf-8",
		"sign_type":   alipaySignType,
		"timestamp":   time.Now().In(alipayTimeZone).Format(alipayTimeLayout),
		"version":     "1.0",
		"biz_content": string(bizContent),
	})
	if err != nil {
		return "", "", err
	}

	var payload struct {
		Response struct {
			Code        string `json:"code"`
			Msg         string `json:"msg"`
			SubCode     string `json:"sub_code"`
			SubMsg      string `json:"sub_msg"`
			TradeStatus string `json:"trade_status"`
			TotalAmount string `json:"total_amount"`
		} `json:"alipay_trade_query_response"`
	}
	if err := common.Unmarshal(body, &payload); err != nil {
		return "", "", fmt.Errorf("alipay query response is not readable: %w", err)
	}
	if payload.Response.Code == alipaySuccessCode {
		return strings.TrimSpace(payload.Response.TradeStatus), strings.TrimSpace(payload.Response.TotalAmount), nil
	}
	if payload.Response.SubCode == "ACQ.TRADE_NOT_EXIST" {
		return "", "", nil
	}
	return "", "", fmt.Errorf("alipay query rejected code=%s msg=%s sub_msg=%s", payload.Response.Code, payload.Response.Msg, payload.Response.SubMsg)
}

// alipayGatewayPost 补上签名后把公共参数按表单发给网关，返回原始响应体。
// 网关会校验 sign，缺了直接回 40002 Invalid Arguments。
func alipayGatewayPost(cfg AlipayConfig, params map[string]string) ([]byte, error) {
	if err := SignAlipayParams(cfg, params); err != nil {
		return nil, err
	}
	form := url.Values{}
	for key, value := range params {
		form.Set(key, value)
	}
	response, err := GetHttpClient().PostForm(AlipayGateway(cfg), form)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	return io.ReadAll(io.LimitReader(response.Body, 1<<20))
}

func alipayOrderParams(cfg AlipayConfig, order AlipayOrder) (map[string]string, error) {
	appId := strings.TrimSpace(cfg.AppId)
	if appId == "" {
		return nil, errors.New("alipay app id is not configured")
	}
	product := order.Product
	if product == "" {
		product = AlipayProductPage
	}
	method, supported := alipayProductMethods[product]
	if !supported {
		return nil, fmt.Errorf("unsupported alipay product %q", product)
	}

	bizContent := map[string]any{
		"out_trade_no": order.OutTradeNo,
		"total_amount": order.TotalAmount,
		"subject":      order.Subject,
	}
	if productCode, ok := alipayProductCodes[product]; ok {
		bizContent["product_code"] = productCode
	}
	if product == AlipayProductQr {
		// 二维码过期前没付款就关单，避免用户扫到一张早就失效的码。
		bizContent["timeout_express"] = "30m"
	}
	encodedBizContent, err := common.Marshal(bizContent)
	if err != nil {
		return nil, err
	}

	params := map[string]string{
		"app_id":      appId,
		"method":      method,
		"format":      "JSON",
		"charset":     "utf-8",
		"sign_type":   alipaySignType,
		"timestamp":   time.Now().In(alipayTimeZone).Format(alipayTimeLayout),
		"version":     "1.0",
		"biz_content": string(encodedBizContent),
	}
	if order.NotifyUrl != "" {
		params["notify_url"] = order.NotifyUrl
	}
	if order.ReturnUrl != "" && product != AlipayProductQr {
		params["return_url"] = order.ReturnUrl
	}
	if err := SignAlipayParams(cfg, params); err != nil {
		return nil, err
	}
	return params, nil
}
