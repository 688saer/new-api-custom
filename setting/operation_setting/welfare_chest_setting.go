package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// WelfareChestBox 单个福箱配置
type WelfareChestBox struct {
	Key          string  `json:"key"`            // 箱标识：xiaoshuai_ge / hei_dashuai
	Enabled      bool    `json:"enabled"`        // 该箱是否开放
	ThresholdUSD float64 `json:"threshold_usd"`  // 周消费门槛（美元）
	RewardMinUSD float64 `json:"reward_min_usd"` // 奖励下限（美元）
	RewardMaxUSD float64 `json:"reward_max_usd"` // 奖励上限（美元）
	MedianUSD    float64 `json:"median_usd"`     // 展示用中位数（美元）
	ClosedImage  string  `json:"closed_image"`   // 未开启图
	OpenedImage  string  `json:"opened_image"`   // 已开启图
}

// WelfareChestSetting 福利宝箱配置
type WelfareChestSetting struct {
	Enabled       bool `json:"enabled"`        // 总开关
	CanOpenAny    bool `json:"can_open_any"`   // 满足门槛即可开启
	UnlimitedOpen bool `json:"unlimited_open"` // 不限制每周一次

	// ChooseOnePerWeek 每用户每周只能开启一个箱子（UnlimitedOpen 为 true 时忽略）
	ChooseOnePerWeek bool `json:"choose_one_per_week"`

	// MaxQuotaLimit 奖励发放后额度上限，0 表示不限制
	MaxQuotaLimit int `json:"max_quota_limit"`

	XiaoshuaiGe WelfareChestBox `json:"xiaoshuai_ge"`
	HeiDashuai  WelfareChestBox `json:"hei_dashuai"`
}

var welfareChestSetting = WelfareChestSetting{
	Enabled:          false,
	CanOpenAny:       true,
	UnlimitedOpen:    false,
	ChooseOnePerWeek: true,
	MaxQuotaLimit:    0,
	XiaoshuaiGe: WelfareChestBox{
		Key:          "xiaoshuai_ge",
		Enabled:      true,
		ThresholdUSD: 10,
		RewardMinUSD: 0.20,
		RewardMaxUSD: 1.00,
		MedianUSD:    0.50,
		ClosedImage:  "/static/welfare-chests/xiaoshuai-ge-closed.png",
		OpenedImage:  "/static/welfare-chests/xiaoshuai-ge-opened.png",
	},
	HeiDashuai: WelfareChestBox{
		Key:          "hei_dashuai",
		Enabled:      true,
		ThresholdUSD: 10,
		RewardMinUSD: 0.05,
		RewardMaxUSD: 2.00,
		MedianUSD:    0.40,
		ClosedImage:  "/static/welfare-chests/hei-dashuai-closed.png",
		OpenedImage:  "/static/welfare-chests/hei-dashuai-opened.png",
	},
}

func init() {
	config.GlobalConfig.Register("welfare_chest_setting", &welfareChestSetting)
}

// GetWelfareChestSetting 获取福利宝箱配置
func GetWelfareChestSetting() *WelfareChestSetting {
	return &welfareChestSetting
}

// IsWelfareChestEnabled 是否启用福利宝箱
func IsWelfareChestEnabled() bool {
	return welfareChestSetting.Enabled
}

// GetWelfareChestBox 按 key 获取箱子配置
func GetWelfareChestBox(key string) *WelfareChestBox {
	switch key {
	case "xiaoshuai_ge":
		return &welfareChestSetting.XiaoshuaiGe
	case "hei_dashuai":
		return &welfareChestSetting.HeiDashuai
	}
	return nil
}
