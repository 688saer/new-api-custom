package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// LotteryPrizeTier 抽奖奖池档位
type LotteryPrizeTier struct {
	Quota  int     `json:"quota"`  // 该档位奖励额度
	Weight float64 `json:"weight"` // 该档位权重（总和不必为 1，按权重归一化）
}

// LotterySetting 幸运抽奖配置
type LotterySetting struct {
	Enabled bool `json:"enabled"` // 是否启用抽奖

	// DailyFreeDraws 每日免费抽奖次数
	DailyFreeDraws int `json:"daily_free_draws"`

	// SingleCostQuota 付费单抽消耗额度（免费次数用尽后生效）
	SingleCostQuota int `json:"single_cost_quota"`

	// MultiCostQuota 十连抽总消耗额度（用于计算"立省"展示）
	MultiCostQuota int `json:"multi_cost_quota"`

	// EnableMulti 是否允许十连抽
	EnableMulti bool `json:"enable_multi"`

	// RequireNoDrawTodayForMulti 十连抽要求当日尚未抽过
	RequireNoDrawTodayForMulti bool `json:"require_no_draw_today_for_multi"`

	// PublicWinsLimit 公开中奖榜显示条数
	PublicWinsLimit int `json:"public_wins_limit"`

	// MinWinQuotaForPublic 进入公开中奖榜的最低额度
	MinWinQuotaForPublic int `json:"min_win_quota_for_public"`

	// Prizes 奖池
	Prizes []LotteryPrizeTier `json:"prizes"`
}

var lotterySetting = LotterySetting{
	Enabled:                    false,
	DailyFreeDraws:             1,
	SingleCostQuota:            500000,  // 500k quota = $1.00
	MultiCostQuota:             4500000, // 4.5M quota = $9.00
	EnableMulti:                true,
	RequireNoDrawTodayForMulti: true,
	PublicWinsLimit:            20,
	MinWinQuotaForPublic:       1000000,
	// 默认奖池：约 55% 空奖、38% 小额、6% 中额、1% 大额
	Prizes: []LotteryPrizeTier{
		{Quota: 0, Weight: 55},
		{Quota: 100000, Weight: 20},    // $0.20
		{Quota: 200000, Weight: 10},    // $0.40
		{Quota: 500000, Weight: 6},     // $1.00
		{Quota: 1000000, Weight: 4},    // $2.00
		{Quota: 2000000, Weight: 3},    // $4.00
		{Quota: 5000000, Weight: 1.5},  // $10.00
		{Quota: 10000000, Weight: 0.5}, // $20.00
	},
}

func init() {
	config.GlobalConfig.Register("lottery_setting", &lotterySetting)
}

// GetLotterySetting 获取抽奖配置
func GetLotterySetting() *LotterySetting {
	return &lotterySetting
}

// IsLotteryEnabled 是否启用抽奖
func IsLotteryEnabled() bool {
	return lotterySetting.Enabled
}
