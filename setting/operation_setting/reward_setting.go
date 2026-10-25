package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// RewardTicketCopy 券面文案（管理员发放时逐字段覆盖，缺省回落默认值）
type RewardTicketCopy struct {
	Label        string `json:"label"`          // 券面左上角品牌标签
	Title        string `json:"title"`          // 主标题
	Subtitle     string `json:"subtitle"`       // 副标题
	Footer       string `json:"footer"`         // 底部说明
	StubText     string `json:"stub_text"`      // 右侧竖排文字
	StubFontSize int    `json:"stub_font_size"` // 竖排文字字号（px）
	ButtonText   string `json:"button_text"`    // 领取按钮文字
}

// RewardSetting 我的奖励配置
type RewardSetting struct {
	Enabled bool `json:"enabled"` // 总开关

	// MaxQuotaLimit 领取后额度上限，0 表示不限制
	MaxQuotaLimit int `json:"max_quota_limit"`

	// HistoryPageSize 领取记录每页条数
	HistoryPageSize int `json:"history_page_size"`

	// DefaultCopy 缺省券面文案
	DefaultCopy RewardTicketCopy `json:"default_copy"`
}

// 券面样式（前端按 data-style 渲染不同配色）
const (
	RewardStyleAurora = "aurora"
)

var rewardStyles = []string{"aurora", "citrus", "sunrise", "nocturne"}

var defaultRewardTicketCopy = RewardTicketCopy{
	Label:        "New API",
	Title:        "感谢你的支持",
	Subtitle:     "每一次创造，都值得被支持。",
	Footer:       "奖励金可用于本站模型调用",
	StubText:     "专属奖励",
	StubFontSize: 28,
	ButtonText:   "领取奖励金",
}

var rewardSetting = RewardSetting{
	Enabled:         false,
	MaxQuotaLimit:   0,
	HistoryPageSize: 20,
	DefaultCopy:     defaultRewardTicketCopy,
}

func init() {
	config.GlobalConfig.Register("reward_setting", &rewardSetting)
}

// GetRewardSetting 获取我的奖励配置
func GetRewardSetting() *RewardSetting {
	return &rewardSetting
}

// IsRewardEnabled 是否启用我的奖励
func IsRewardEnabled() bool {
	return rewardSetting.Enabled
}

// GetDefaultRewardTicketCopy 缺省券面文案
func GetDefaultRewardTicketCopy() RewardTicketCopy {
	return defaultRewardTicketCopy
}

// NormalizeRewardStyle 收敛券面样式，未知值回落 aurora
func NormalizeRewardStyle(style string) string {
	for _, candidate := range rewardStyles {
		if candidate == style {
			return style
		}
	}
	return RewardStyleAurora
}

// NormalizeRewardTicketCopy 用默认值补齐空字段，并收敛字号
func NormalizeRewardTicketCopy(copy RewardTicketCopy) RewardTicketCopy {
	fallback := defaultRewardTicketCopy
	if copy.Label == "" {
		copy.Label = fallback.Label
	}
	if copy.Title == "" {
		copy.Title = fallback.Title
	}
	if copy.Subtitle == "" {
		copy.Subtitle = fallback.Subtitle
	}
	if copy.Footer == "" {
		copy.Footer = fallback.Footer
	}
	if copy.StubText == "" {
		copy.StubText = fallback.StubText
	}
	if copy.ButtonText == "" {
		copy.ButtonText = fallback.ButtonText
	}
	if copy.StubFontSize < 14 || copy.StubFontSize > 56 {
		copy.StubFontSize = fallback.StubFontSize
	}
	return copy
}
