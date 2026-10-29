package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// PurchaseAgreementSetting 购买协议配置。
//
// 协议正文由管理员在后台维护；用户每次购买前必须勾选同意，签署记录带版本号，
// 管理员修改文案后把 Version 改掉，旧签署即失效，用户会被要求重新签署。
type PurchaseAgreementSetting struct {
	// Enabled 关闭后不再拦截任何购买动作，也不展示协议
	Enabled bool `json:"enabled"`

	// Title 协议标题，展示在阅读弹窗与页脚链接上
	Title string `json:"title"`

	// Version 协议版本号，变更正文时递增
	Version string `json:"version"`

	// Content 协议正文（纯文本，换行分段）
	Content string `json:"content"`

	// RequireForRedemption 兑换码兑换前是否必须签署
	RequireForRedemption bool `json:"require_for_redemption"`

	// RequireForTopup 在线充值前是否必须签署
	RequireForTopup bool `json:"require_for_topup"`

	// RequireForSubscription 订阅套餐购买前是否必须签署
	RequireForSubscription bool `json:"require_for_subscription"`
}

const defaultPurchaseAgreementContent = `一、协议主体
本协议由本站运营方（以下称"本站"）与购买本站充值、兑换码或订阅套餐的用户（以下称"用户"）订立。用户勾选同意并完成支付，即表示已阅读、理解并接受本协议全部条款。

二、服务内容
1. 本站提供 AI 模型调用额度的充值、兑换码兑换及订阅套餐购买服务，额度仅可用于本站开放的模型与接口。
2. 充值余额、兑换码与订阅套餐属于虚拟商品，一经售出即为用户账户专属权益，不支持转让、转售、租赁或用于任何形式的二次销售。

三、支付与生效
1. 支付成功后，额度或权益自动计入用户账户；到账延迟时，请先查看订单记录，必要时联系客服并提供订单号。
2. 兑换码为一次性凭证，兑换成功即失效；因用户自行泄露、转赠或被他人使用导致的损失，由用户自行承担。

四、退款与争议
1. 已消耗的额度不支持退款；未消耗部分如需退款，请通过工单提交申请，由本站按实际情况审核处理。
2. 因用户违反本协议或站内规则（包括但不限于利用本站从事违法活动、批量注册、恶意刷量、攻击接口）被限制或封禁的账户，对应权益不予退还。

五、发票
用户可就实际支付的金额申请发票，申请入口在钱包页面。发票申请需填写真实抬头与税号，因信息填写错误导致的作废或重开，由用户承担相应成本。

六、其他
1. 本站有权根据业务调整更新本协议，更新后在站内公布并标注新版本号，用户继续购买即视为接受更新后的协议。
2. 本协议未尽事宜，按照本站《用户协议》与《隐私政策》执行。`

var purchaseAgreementSetting = PurchaseAgreementSetting{
	Enabled:                true,
	Title:                  "购买协议",
	Version:                "1.0",
	Content:                defaultPurchaseAgreementContent,
	RequireForRedemption:   true,
	RequireForTopup:        true,
	RequireForSubscription: true,
}

func init() {
	config.GlobalConfig.Register("purchase_agreement_setting", &purchaseAgreementSetting)
}

// GetPurchaseAgreementSetting 获取购买协议配置
func GetPurchaseAgreementSetting() *PurchaseAgreementSetting {
	return &purchaseAgreementSetting
}

// PurchaseAgreementTitle 标题未配置时的兜底
func PurchaseAgreementTitle() string {
	if purchaseAgreementSetting.Title == "" {
		return "购买协议"
	}
	return purchaseAgreementSetting.Title
}

// PurchaseAgreementVersion 版本号未配置时的兜底
func PurchaseAgreementVersion() string {
	if purchaseAgreementSetting.Version == "" {
		return "1.0"
	}
	return purchaseAgreementSetting.Version
}

// PurchaseAgreementRequired 指定购买场景是否需要签署协议
func PurchaseAgreementRequired(scene string) bool {
	if !purchaseAgreementSetting.Enabled {
		return false
	}
	switch scene {
	case PurchaseSceneRedemption:
		return purchaseAgreementSetting.RequireForRedemption
	case PurchaseSceneTopup:
		return purchaseAgreementSetting.RequireForTopup
	case PurchaseSceneSubscription:
		return purchaseAgreementSetting.RequireForSubscription
	}
	return false
}

// 购买场景，与前端请求体里的 scene 字段一致
const (
	PurchaseSceneRedemption   = "redemption"
	PurchaseSceneTopup        = "topup"
	PurchaseSceneSubscription = "subscription"
)
