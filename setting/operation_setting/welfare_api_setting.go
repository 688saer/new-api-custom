package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// WelfareApiEntry 单个福利 API 条目
type WelfareApiEntry struct {
	Id          string `json:"id"`          // 唯一标识，用于前端 key 与编辑定位
	Name        string `json:"name"`        // 展示名称，如「DeepSeek V3 免费额度」
	Provider    string `json:"provider"`    // 提供方，如 DeepSeek
	Description string `json:"description"` // 一句话说明
	BaseUrl     string `json:"base_url"`    // 调用地址
	Model       string `json:"model"`       // 模型名，多个用逗号分隔
	ApiKey      string `json:"api_key"`     // 公共密钥，留空则前端不展示
	DocsUrl     string `json:"docs_url"`    // 文档或领取地址
	Badge       string `json:"badge"`       // 角标文案，如「限时免费」
	Enabled     bool   `json:"enabled"`     // 是否公开展示
	Sort        int    `json:"sort"`        // 排序，越小越靠前
}

// WelfareApiSetting 福利 API 页配置
type WelfareApiSetting struct {
	Enabled      bool              `json:"enabled"`       // 总开关
	Title        string            `json:"title"`         // 页面标题
	Subtitle     string            `json:"subtitle"`      // 页面副标题
	Notice       string            `json:"notice"`        // 顶部公告，留空不展示
	RequireLogin bool              `json:"require_login"` // 是否要求登录后才展示条目
	Apis         []WelfareApiEntry `json:"apis"`          // 福利 API 条目
}

var welfareApiSetting = WelfareApiSetting{
	Enabled:      true,
	Title:        "Welfare API",
	Subtitle:     "Free APIs published by the site operator, with endpoints and models ready to call.",
	Notice:       "",
	RequireLogin: false,
	Apis:         []WelfareApiEntry{},
}

func init() {
	config.GlobalConfig.Register("welfare_api_setting", &welfareApiSetting)
}

// GetWelfareApiSetting 获取福利 API 配置
func GetWelfareApiSetting() *WelfareApiSetting {
	return &welfareApiSetting
}

// IsWelfareApiEnabled 福利 API 页是否启用
func IsWelfareApiEnabled() bool {
	return welfareApiSetting.Enabled
}
