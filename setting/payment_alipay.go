package setting

// 支付宝开放平台（官方）配置。
//
// 与易支付那种聚合网关不同，官方通道需要我们自己拼签名：应用私钥本地保存，
// 支付宝公钥用来验异步通知。两个密钥都允许直接粘贴控制台给的裸 base64。
// AlipayProductType 可选 page（电脑网站支付）、wap（手机网站支付）、
// qr（当面付扫码），具体映射见 service/alipay.go。
var (
	AlipayEnabled     = false
	AlipayAppId       = ""
	AlipayPrivateKey  = ""
	AlipayPublicKey   = ""
	AlipayGateway     = ""
	AlipayProductType = "page"
	AlipayMinTopUp    = 1
	AlipaySandbox     = false
	// AlipayNotifyUrl 留空时用「回调地址 + /api/user/alipay/notify」，
	// 反代改了域名或路径时可以在后台覆盖。
	AlipayNotifyUrl = ""
	AlipayReturnUrl = ""
)
