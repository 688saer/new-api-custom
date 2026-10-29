package model

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 发票
// ---------------------------------------------------------------------------

// 发票申请状态。pending 待审核，approved 审核通过待开具，issued 已开具，rejected 已驳回。
const (
	InvoiceStatusPending  = "pending"
	InvoiceStatusApproved = "approved"
	InvoiceStatusIssued   = "issued"
	InvoiceStatusRejected = "rejected"
)

// 抬头类型
const (
	InvoiceTitlePersonal = "personal"
	InvoiceTitleCompany  = "company"
)

// 发票错误码，前端按 code 展示对应文案
const (
	InvoiceCodeNotFound       = "INVOICE_NOT_FOUND"
	InvoiceCodeNotEnabled     = "INVOICE_NOT_ENABLED"
	InvoiceCodeInvalidTitle   = "INVOICE_INVALID_TITLE"
	InvoiceCodeInvalidTaxId   = "INVOICE_INVALID_TAX_ID"
	InvoiceCodeInvalidEmail   = "INVOICE_INVALID_EMAIL"
	InvoiceCodeInvalidAmount  = "INVOICE_INVALID_AMOUNT"
	InvoiceCodeTooManyPending = "INVOICE_TOO_MANY_PENDING"
	InvoiceCodeInvalidStatus  = "INVOICE_INVALID_STATUS"
	InvoiceCodeFileMissing    = "INVOICE_FILE_MISSING"
	InvoiceCodeFileTooLarge   = "INVOICE_FILE_TOO_LARGE"
	InvoiceCodeFileInvalid    = "INVOICE_FILE_INVALID"
	InvoiceCodeForbidden      = "INVOICE_FORBIDDEN"
)

// InvoiceError 带错误码的发票错误
type InvoiceError struct {
	Code    string
	Message string
}

func (e *InvoiceError) Error() string { return e.Message }

func newInvoiceError(code, message string) *InvoiceError {
	return &InvoiceError{Code: code, Message: message}
}

// 单据上限，与前端提示保持一致
const (
	invoiceFileMaxBytes  = 8 * 1024 * 1024
	invoicePageSizeMax   = 100
	invoiceTitleMaxRunes = 100
	invoiceRemarkMax     = 500
)

// Invoice 发票申请单
type Invoice struct {
	Id       int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId   int    `json:"user_id" gorm:"not null;index:idx_invoice_user,priority:1"`
	Username string `json:"username" gorm:"type:varchar(64);not null;default:''"`

	TitleType string `json:"title_type" gorm:"type:varchar(16);not null;default:'personal'"`
	TitleName string `json:"title_name" gorm:"type:varchar(100);not null"`
	TaxId     string `json:"tax_id" gorm:"type:varchar(64);not null;default:''"`
	Email     string `json:"email" gorm:"type:varchar(128);not null;default:''"`
	Phone     string `json:"phone" gorm:"type:varchar(32);not null;default:''"`

	// Amount 开票金额（元），用整数分存储避免浮点误差
	AmountCents int64  `json:"amount_cents" gorm:"bigint;not null;default:0"`
	Content     string `json:"content" gorm:"type:varchar(64);not null;default:''"`
	Remark      string `json:"remark" gorm:"type:varchar(500);not null;default:''"`

	Status       string `json:"status" gorm:"type:varchar(16);not null;default:'pending';index:idx_invoice_status,priority:1"`
	RejectReason string `json:"reject_reason" gorm:"type:varchar(255);not null;default:''"`

	// 开具结果
	InvoiceNo string `json:"invoice_no" gorm:"type:varchar(64);not null;default:''"`
	FileName  string `json:"file_name" gorm:"type:varchar(120);not null;default:''"`
	FileKey   string `json:"-" gorm:"type:varchar(255);not null;default:''"`
	FileSize  int64  `json:"file_size" gorm:"bigint;not null;default:0"`

	ReviewerId   int    `json:"reviewer_id" gorm:"not null;default:0"`
	ReviewerName string `json:"reviewer_name" gorm:"type:varchar(64);not null;default:''"`
	IssuerId     int    `json:"issuer_id" gorm:"not null;default:0"`
	IssuerName   string `json:"issuer_name" gorm:"type:varchar(64);not null;default:''"`

	ReviewedAt int64 `json:"reviewed_at" gorm:"bigint;not null;default:0"`
	IssuedAt   int64 `json:"issued_at" gorm:"bigint;not null;default:0"`
	CreatedAt  int64 `json:"created_at" gorm:"bigint;not null;default:0;index:idx_invoice_user,priority:2"`
	UpdatedAt  int64 `json:"updated_at" gorm:"bigint;not null;default:0"`
}

func (Invoice) TableName() string {
	return "invoices"
}

// HasFile 是否已挂上发票文件
func (invoice *Invoice) HasFile() bool {
	return invoice.FileKey != ""
}

// InvoiceAmount 开票金额（元），保留两位小数
func (invoice *Invoice) InvoiceAmount() float64 {
	return float64(invoice.AmountCents) / 100
}

// InvoiceListPage 分页结果
type InvoiceListPage struct {
	Items    []Invoice `json:"items"`
	Total    int64     `json:"total"`
	Page     int       `json:"page"`
	PageSize int       `json:"page_size"`
}

// CreateInvoiceParams 用户提交的申请内容
type CreateInvoiceParams struct {
	UserId    int
	Username  string
	TitleType string
	TitleName string
	TaxId     string
	Email     string
	Phone     string
	Amount    float64
	Content   string
	Remark    string
}

func normalizeInvoicePage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > invoicePageSizeMax {
		pageSize = invoicePageSizeMax
	}
	return page, pageSize
}

// CreateInvoice 校验并写入一条申请
func CreateInvoice(params CreateInvoiceParams) (*Invoice, error) {
	setting := operation_setting.GetInvoiceSetting()
	if !setting.Enabled {
		return nil, newInvoiceError(InvoiceCodeNotEnabled, "The invoice module is not enabled")
	}

	params.TitleName = strings.TrimSpace(params.TitleName)
	params.TaxId = strings.TrimSpace(params.TaxId)
	params.Email = strings.TrimSpace(params.Email)
	params.Phone = strings.TrimSpace(params.Phone)
	params.Content = strings.TrimSpace(params.Content)
	params.Remark = strings.TrimSpace(params.Remark)

	if params.TitleType != InvoiceTitlePersonal && params.TitleType != InvoiceTitleCompany {
		return nil, newInvoiceError(InvoiceCodeInvalidTitle, "Choose an invoice title type")
	}
	if params.TitleName == "" {
		return nil, newInvoiceError(InvoiceCodeInvalidTitle, "The invoice title is required")
	}
	if utf8.RuneCountInString(params.TitleName) > invoiceTitleMaxRunes {
		return nil, newInvoiceError(InvoiceCodeInvalidTitle, "The invoice title is too long")
	}
	if params.TitleType == InvoiceTitleCompany && params.TaxId == "" {
		return nil, newInvoiceError(InvoiceCodeInvalidTaxId, "A company invoice needs a tax ID")
	}
	if !looksLikeEmail(params.Email) {
		return nil, newInvoiceError(InvoiceCodeInvalidEmail, "Enter a valid email address to receive the invoice")
	}
	if params.Amount <= 0 {
		return nil, newInvoiceError(InvoiceCodeInvalidAmount, "Enter the amount you want invoiced")
	}
	if setting.MinAmount > 0 && params.Amount < setting.MinAmount {
		return nil, newInvoiceError(InvoiceCodeInvalidAmount,
			fmt.Sprintf("The smallest invoice amount is %.2f", setting.MinAmount))
	}
	if setting.MaxAmount > 0 && params.Amount > setting.MaxAmount {
		return nil, newInvoiceError(InvoiceCodeInvalidAmount,
			fmt.Sprintf("The largest invoice amount is %.2f", setting.MaxAmount))
	}
	if utf8.RuneCountInString(params.Remark) > invoiceRemarkMax {
		params.Remark = string([]rune(params.Remark)[:invoiceRemarkMax])
	}
	if params.Content == "" {
		params.Content = "技术服务费"
	}

	if limit := setting.MaxPendingPerUser; limit > 0 {
		var pending int64
		if err := DB.Model(&Invoice{}).
			Where("user_id = ? AND status IN ?", params.UserId,
				[]string{InvoiceStatusPending, InvoiceStatusApproved}).
			Count(&pending).Error; err != nil {
			return nil, err
		}
		if pending >= int64(limit) {
			return nil, newInvoiceError(InvoiceCodeTooManyPending,
				"You already have invoice requests waiting to be processed")
		}
	}

	now := common.GetTimestamp()
	invoice := &Invoice{
		UserId:      params.UserId,
		Username:    params.Username,
		TitleType:   params.TitleType,
		TitleName:   params.TitleName,
		TaxId:       params.TaxId,
		Email:       params.Email,
		Phone:       params.Phone,
		AmountCents: int64(params.Amount*100 + 0.5),
		Content:     params.Content,
		Remark:      params.Remark,
		Status:      InvoiceStatusPending,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := DB.Create(invoice).Error; err != nil {
		return nil, err
	}
	return invoice, nil
}

// looksLikeEmail 只做基本形状校验，真正的可达性由管理员人工确认
func looksLikeEmail(email string) bool {
	if email == "" || len(email) > 128 {
		return false
	}
	at := strings.IndexByte(email, '@')
	if at <= 0 || at == len(email)-1 {
		return false
	}
	if strings.ContainsAny(email, " \t\r\n") {
		return false
	}
	return strings.Contains(email[at+1:], ".")
}

// ListInvoicesForUser 用户自己的申请列表
func ListInvoicesForUser(userId, page, pageSize int) (*InvoiceListPage, error) {
	page, pageSize = normalizeInvoicePage(page, pageSize)

	query := DB.Model(&Invoice{}).Where("user_id = ?", userId)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	items := make([]Invoice, 0)
	if err := query.Order("id desc").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, err
	}
	return &InvoiceListPage{Items: items, Total: total, Page: page, PageSize: pageSize}, nil
}

// GetInvoiceForUser 读取用户自己的申请单
func GetInvoiceForUser(userId, invoiceId int) (*Invoice, error) {
	var invoice Invoice
	err := DB.Where("id = ? AND user_id = ?", invoiceId, userId).First(&invoice).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, newInvoiceError(InvoiceCodeNotFound, "Invoice request not found")
	}
	if err != nil {
		return nil, err
	}
	return &invoice, nil
}

// InvoiceFilter 后台列表筛选条件
type InvoiceFilter struct {
	Status   string
	Keyword  string
	Page     int
	PageSize int
}

// ListInvoices 后台列表
func ListInvoices(filter InvoiceFilter) (*InvoiceListPage, error) {
	page, pageSize := normalizeInvoicePage(filter.Page, filter.PageSize)

	query := DB.Model(&Invoice{})
	switch filter.Status {
	case InvoiceStatusPending, InvoiceStatusApproved, InvoiceStatusIssued, InvoiceStatusRejected:
		query = query.Where("status = ?", filter.Status)
	}
	if keyword := strings.TrimSpace(filter.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where(
			"title_name LIKE ? OR username LIKE ? OR email LIKE ? OR invoice_no LIKE ?",
			like, like, like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	items := make([]Invoice, 0)
	if err := query.Order("id desc").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, err
	}
	return &InvoiceListPage{Items: items, Total: total, Page: page, PageSize: pageSize}, nil
}

// GetInvoiceById 后台读取任意申请单
func GetInvoiceById(invoiceId int) (*Invoice, error) {
	var invoice Invoice
	err := DB.Where("id = ?", invoiceId).First(&invoice).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, newInvoiceError(InvoiceCodeNotFound, "Invoice request not found")
	}
	if err != nil {
		return nil, err
	}
	return &invoice, nil
}

// ReviewInvoice 审核：通过后进入待开具，驳回则结束流程
func ReviewInvoice(invoiceId int, approve bool, reason string, reviewerId int, reviewerName string) (*Invoice, error) {
	invoice, err := GetInvoiceById(invoiceId)
	if err != nil {
		return nil, err
	}
	if invoice.Status != InvoiceStatusPending {
		return nil, newInvoiceError(InvoiceCodeInvalidStatus, "This request has already been processed")
	}

	now := common.GetTimestamp()
	updates := map[string]any{
		"reviewer_id":   reviewerId,
		"reviewer_name": reviewerName,
		"reviewed_at":   now,
		"updated_at":    now,
	}
	if approve {
		updates["status"] = InvoiceStatusApproved
	} else {
		reason = strings.TrimSpace(reason)
		if reason == "" {
			return nil, newInvoiceError(InvoiceCodeInvalidStatus, "Tell the user why the request was rejected")
		}
		if utf8.RuneCountInString(reason) > 200 {
			reason = string([]rune(reason)[:200])
		}
		updates["status"] = InvoiceStatusRejected
		updates["reject_reason"] = reason
	}
	if err := DB.Model(&Invoice{}).Where("id = ?", invoiceId).Updates(updates).Error; err != nil {
		return nil, err
	}
	return GetInvoiceById(invoiceId)
}

// IssueInvoice 开具：写入发票号并保存 PDF，落盘成功才改状态
func IssueInvoice(invoiceId int, invoiceNo string, fileName string, data []byte, reviewerId int, reviewerName string) (*Invoice, error) {
	invoice, err := GetInvoiceById(invoiceId)
	if err != nil {
		return nil, err
	}
	if invoice.Status == InvoiceStatusRejected {
		return nil, newInvoiceError(InvoiceCodeInvalidStatus, "A rejected request cannot be issued")
	}

	invoiceNo = strings.TrimSpace(invoiceNo)
	if invoiceNo == "" {
		return nil, newInvoiceError(InvoiceCodeInvalidStatus, "Enter the invoice number")
	}
	if utf8.RuneCountInString(invoiceNo) > 64 {
		return nil, newInvoiceError(InvoiceCodeInvalidStatus, "The invoice number is too long")
	}
	if len(data) == 0 {
		return nil, newInvoiceError(InvoiceCodeFileMissing, "Attach the invoice PDF")
	}
	if len(data) > invoiceFileMaxBytes {
		return nil, newInvoiceError(InvoiceCodeFileTooLarge, "The invoice file must be smaller than 8 MB")
	}
	if !looksLikePDF(data) {
		return nil, newInvoiceError(InvoiceCodeFileInvalid, "Only PDF invoices are supported")
	}

	relative, err := writeInvoiceFile(data)
	if err != nil {
		return nil, err
	}

	now := common.GetTimestamp()
	updates := map[string]any{
		"status":      InvoiceStatusIssued,
		"invoice_no":  invoiceNo,
		"file_name":   sanitizeInvoiceFileName(fileName),
		"file_key":    relative,
		"file_size":   int64(len(data)),
		"issuer_id":   reviewerId,
		"issuer_name": reviewerName,
		"issued_at":   now,
		"updated_at":  now,
	}
	if err := DB.Model(&Invoice{}).Where("id = ?", invoiceId).Updates(updates).Error; err != nil {
		_ = os.Remove(filepath.Join(invoiceFileDir(), relative))
		return nil, err
	}
	return GetInvoiceById(invoiceId)
}

// looksLikePDF 用文件头判断，不信任扩展名
func looksLikePDF(data []byte) bool {
	return len(data) > 4 && string(data[:4]) == "%PDF"
}

func invoiceFileDir() string {
	dir := strings.TrimSpace(os.Getenv("INVOICE_FILE_DIR"))
	if dir == "" {
		dir = filepath.Join(".", "data", "invoice-files")
	}
	return dir
}

func writeInvoiceFile(data []byte) (string, error) {
	now := time.Now()
	relative := filepath.Join(now.Format("2006"), now.Format("01"), uuid.NewString()+".pdf")
	fullPath := filepath.Join(invoiceFileDir(), relative)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0o750); err != nil {
		return "", fmt.Errorf("create invoice directory: %w", err)
	}
	if err := os.WriteFile(fullPath, data, 0o600); err != nil {
		return "", fmt.Errorf("write invoice file: %w", err)
	}
	return relative, nil
}

func sanitizeInvoiceFileName(fileName string) string {
	name := strings.TrimSpace(filepath.Base(fileName))
	if name == "" || name == "." || name == string(filepath.Separator) {
		return "invoice.pdf"
	}
	runes := []rune(name)
	if len(runes) > 100 {
		name = string(runes[:100])
	}
	return name
}

// OpenInvoiceFile 打开已开具的发票文件，调用方负责关闭
func OpenInvoiceFile(invoice *Invoice) (*os.File, error) {
	if !invoice.HasFile() {
		return nil, newInvoiceError(InvoiceCodeFileMissing, "The invoice file is not available yet")
	}
	fullPath := filepath.Join(invoiceFileDir(), invoice.FileKey)
	file, err := os.Open(fullPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil, newInvoiceError(InvoiceCodeFileMissing, "The invoice file is missing on the server")
	}
	if err != nil {
		return nil, err
	}
	return file, nil
}
