package setting

// 微信支付（官方 APIv3 / Native 扫码）配置。
//
// Native 下单只返回一个 weixin:// 链接：电脑上渲染成二维码，手机上点一下就能
// 唤起微信付款页。回调报文是加密的，所以 ApiV3Key 和微信支付公钥都必须填，
// 少了任何一项这个通道就不会上线。
var (
	WechatPayEnabled           = false
	WechatPayAppId             = ""
	WechatPayMchId             = ""
	WechatPayMchSerialNo       = ""
	WechatPayPrivateKey        = ""
	WechatPayApiV3Key          = ""
	WechatPayPlatformPublicKey = ""
	WechatPayGateway           = ""
	WechatPayMinTopUp          = 1
	// WechatPayNotifyUrl 留空时用「回调地址 + /api/user/wechat/notify」。
	WechatPayNotifyUrl = ""
)
