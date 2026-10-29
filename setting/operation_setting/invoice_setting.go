package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// InvoiceSetting 发票模块配置（后台「发票管理」页维护）
type InvoiceSetting struct {
	// Enabled 总开关，关闭后用户侧申请入口隐藏，已有申请仍可查看
	Enabled bool `json:"enabled"`

	// SellerName 销售方名称，展示在申请页与说明里
	SellerName string `json:"seller_name"`

	// Contact 开票咨询方式（邮箱或工单入口说明）
	Contact string `json:"contact"`

	// Notice 申请须知，逐条展示在申请表单上方
	Notice string `json:"notice"`

	// MinAmount / MaxAmount 单次可申请的开票金额区间（元），0 表示不限制
	MinAmount float64 `json:"min_amount"`
	MaxAmount float64 `json:"max_amount"`

	// MaxPendingPerUser 单个用户同时处于待处理状态的申请上限
	MaxPendingPerUser int `json:"max_pending_per_user"`
}

var invoiceSetting = InvoiceSetting{
	Enabled:           true,
	SellerName:        "",
	Contact:           "",
	Notice:            "",
	MinAmount:         0,
	MaxAmount:         0,
	MaxPendingPerUser: 3,
}

func init() {
	config.GlobalConfig.Register("invoice_setting", &invoiceSetting)
}

// GetInvoiceSetting 获取发票配置
func GetInvoiceSetting() *InvoiceSetting {
	return &invoiceSetting
}

// IsInvoiceEnabled 发票模块是否启用
func IsInvoiceEnabled() bool {
	return invoiceSetting.Enabled
}
