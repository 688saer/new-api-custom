package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// TicketSetting 工单系统配置（由独立工单后台维护）
type TicketSetting struct {
	Enabled bool `json:"enabled"` // 总开关，关闭后用户侧入口隐藏

	// AgentName 客服统一展示名称，回复、欢迎语与自动回复都用它
	AgentName string `json:"agent_name"`

	// Welcome 新建工单页顶部的欢迎语
	Welcome string `json:"welcome"`

	// Online 客服在线状态；离线时新建工单或追加消息会触发自动回复
	Online bool `json:"online"`

	// OfflineReply 离线自动回复内容
	OfflineReply string `json:"offline_reply"`

	// MaxOpenTickets 单个用户同时未结束的工单上限，0 表示不限制
	MaxOpenTickets int `json:"max_open_tickets"`

	// AllowAttachments 是否允许在工单中发送图片
	AllowAttachments bool `json:"allow_attachments"`
}

var ticketSetting = TicketSetting{
	Enabled:          true,
	AgentName:        "Support",
	Welcome:          "Tell us what happened and we will get back to you here.",
	Online:           true,
	OfflineReply:     "Our support team is away right now. Leave the details here and we will reply as soon as we are back.",
	MaxOpenTickets:   10,
	AllowAttachments: true,
}

func init() {
	config.GlobalConfig.Register("ticket_setting", &ticketSetting)
}

// GetTicketSetting 获取工单配置
func GetTicketSetting() *TicketSetting {
	return &ticketSetting
}

// IsTicketEnabled 工单系统是否启用
func IsTicketEnabled() bool {
	return ticketSetting.Enabled
}

// TicketAgentName 客服展示名称，未配置时回落 Support
func TicketAgentName() string {
	if ticketSetting.AgentName == "" {
		return "Support"
	}
	return ticketSetting.AgentName
}
