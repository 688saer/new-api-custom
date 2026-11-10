package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// WheelSetting 幸运大转盘配置
//
// 奖品本身存放在 wheel_prizes 表中（可增删改、带库存），这里只放活动级规则。
type WheelSetting struct {
	// Enabled 是否启用大转盘活动
	Enabled bool `json:"enabled"`

	// Title 活动标题（留空时前端使用默认文案）
	Title string `json:"title"`
	// Subtitle 活动副标题
	Subtitle string `json:"subtitle"`
	// RulesText 活动规则正文，按行展示
	RulesText string `json:"rules_text"`

	// DailyFreeDraws 每日免费抽奖次数
	DailyFreeDraws int `json:"daily_free_draws"`
	// DailyDrawLimit 每人每日最多抽奖次数，0 表示不限
	DailyDrawLimit int `json:"daily_draw_limit"`
	// SingleCostQuota 免费次数用尽后单次抽奖消耗额度
	SingleCostQuota int `json:"single_cost_quota"`

	// ShowPublicWins 是否公开展示中奖动态
	ShowPublicWins bool `json:"show_public_wins"`
	// PublicWinsLimit 公开中奖动态条数
	PublicWinsLimit int `json:"public_wins_limit"`

	// RedemptionExpireDays 兑换码奖品的有效期（天），0 表示长期有效
	RedemptionExpireDays int `json:"redemption_expire_days"`
}

var wheelSetting = WheelSetting{
	Enabled:              false,
	Title:                "",
	Subtitle:             "",
	RulesText:            "",
	DailyFreeDraws:       1,
	DailyDrawLimit:       0,
	SingleCostQuota:      500000, // 500k quota = $1.00
	ShowPublicWins:       true,
	PublicWinsLimit:      12,
	RedemptionExpireDays: 30,
}

func init() {
	config.GlobalConfig.Register("wheel_setting", &wheelSetting)
}

// GetWheelSetting 获取大转盘配置
func GetWheelSetting() *WheelSetting {
	return &wheelSetting
}

// IsWheelEnabled 是否启用大转盘
func IsWheelEnabled() bool {
	return wheelSetting.Enabled
}
