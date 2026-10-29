package controller

import (
	"errors"
	"fmt"
	"io"
	"mime"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// invoiceErrorFields 把错误码附加到响应体，前端据此展示对应文案
func invoiceErrorFields(err error) gin.H {
	var invoiceErr *model.InvoiceError
	if errors.As(err, &invoiceErr) {
		return gin.H{"code": invoiceErr.Code, "reason": invoiceErr.Message}
	}
	return gin.H{}
}

func invoiceIdParam(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorStatus(c, 200, &model.InvoiceError{
			Code:    model.InvoiceCodeNotFound,
			Message: "Invoice request not found",
		}, gin.H{"code": model.InvoiceCodeNotFound})
		return 0, false
	}
	return id, true
}

// currentUsername 会话认证时上下文里有用户名，API 令牌调用时为空，回落到数据库
func currentUsername(c *gin.Context) string {
	if name := strings.TrimSpace(c.GetString("username")); name != "" {
		return name
	}
	if name, err := model.GetUsernameById(c.GetInt("id"), false); err == nil {
		return name
	}
	return ""
}

// GetMyInvoices 我的发票申请（GET /api/user/invoices?page=&page_size=）
func GetMyInvoices(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))

	result, err := model.ListInvoicesForUser(c.GetInt("id"), page, pageSize)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, invoiceErrorFields(err))
		return
	}
	setting := operation_setting.GetInvoiceSetting()
	common.ApiSuccess(c, gin.H{
		"items":     result.Items,
		"total":     result.Total,
		"page":      result.Page,
		"page_size": result.PageSize,
		"setting": gin.H{
			"enabled":     setting.Enabled,
			"seller_name": setting.SellerName,
			"contact":     setting.Contact,
			"notice":      setting.Notice,
			"min_amount":  setting.MinAmount,
			"max_amount":  setting.MaxAmount,
		},
	})
}

// CreateMyInvoice 提交开票申请（POST /api/user/invoices）
func CreateMyInvoice(c *gin.Context) {
	var req struct {
		TitleType string  `json:"title_type"`
		TitleName string  `json:"title_name"`
		TaxId     string  `json:"tax_id"`
		Email     string  `json:"email"`
		Phone     string  `json:"phone"`
		Amount    float64 `json:"amount"`
		Content   string  `json:"content"`
		Remark    string  `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.InvoiceError{
			Code:    model.InvoiceCodeInvalidTitle,
			Message: "Fill in the invoice form first",
		}, gin.H{"code": model.InvoiceCodeInvalidTitle})
		return
	}

	invoice, err := model.CreateInvoice(model.CreateInvoiceParams{
		UserId:    c.GetInt("id"),
		Username:  currentUsername(c),
		TitleType: req.TitleType,
		TitleName: req.TitleName,
		TaxId:     req.TaxId,
		Email:     req.Email,
		Phone:     req.Phone,
		Amount:    req.Amount,
		Content:   req.Content,
		Remark:    req.Remark,
	})
	if err != nil {
		common.ApiErrorStatus(c, 200, err, invoiceErrorFields(err))
		return
	}
	common.ApiSuccess(c, invoice)
}

// DownloadMyInvoice 下载已开具的发票（GET /api/user/invoices/:id/file）
func DownloadMyInvoice(c *gin.Context) {
	invoiceId, ok := invoiceIdParam(c)
	if !ok {
		return
	}
	invoice, err := model.GetInvoiceForUser(c.GetInt("id"), invoiceId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, invoiceErrorFields(err))
		return
	}
	writeInvoiceFileResponse(c, invoice)
}

// writeInvoiceFileResponse 把发票 PDF 写入响应
func writeInvoiceFileResponse(c *gin.Context, invoice *model.Invoice) {
	file, err := model.OpenInvoiceFile(invoice)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, invoiceErrorFields(err))
		return
	}
	defer file.Close()

	name := invoice.FileName
	if name == "" {
		name = fmt.Sprintf("invoice-%d.pdf", invoice.Id)
	}
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition",
		mime.FormatMediaType("attachment", map[string]string{"filename": filepath.Base(name)}))
	c.Header("Cache-Control", "no-store")
	if _, err := io.Copy(c.Writer, file); err != nil {
		common.SysLog(fmt.Sprintf("invoice %d file copy failed: %s", invoice.Id, err.Error()))
	}
}

// GetPurchaseAgreement 读取购买协议与当前用户的签署状态（GET /api/user/purchase-agreement）
func GetPurchaseAgreement(c *gin.Context) {
	state, err := model.GetPurchaseAgreementState(c.GetInt("id"))
	if err != nil {
		common.ApiErrorStatus(c, 200, err, gin.H{})
		return
	}
	common.ApiSuccess(c, state)
}

// SignPurchaseAgreement 记录签署（POST /api/user/purchase-agreement/sign）
func SignPurchaseAgreement(c *gin.Context) {
	var req struct {
		Scene string `json:"scene"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Scene = ""
	}
	scene := strings.TrimSpace(req.Scene)
	switch scene {
	case operation_setting.PurchaseSceneRedemption,
		operation_setting.PurchaseSceneTopup,
		operation_setting.PurchaseSceneSubscription:
	default:
		scene = operation_setting.PurchaseSceneTopup
	}

	userId := c.GetInt("id")
	version := operation_setting.PurchaseAgreementVersion()
	username := currentUsername(c)
	if err := model.SignPurchaseAgreement(userId, username, scene, version,
		c.ClientIP(), c.Request.UserAgent()); err != nil {
		common.ApiErrorStatus(c, 200, err, gin.H{})
		return
	}

	state, err := model.GetPurchaseAgreementState(userId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, gin.H{})
		return
	}
	common.ApiSuccess(c, state)
}

// ConfirmPurchaseAgreement 购买前的服务端确认（POST /api/user/purchase-agreement/confirm）。
// 未签署时返回 AGREEMENT_REQUIRED，前端据此弹出协议；签署后返回当前状态。
func ConfirmPurchaseAgreement(c *gin.Context) {
	var req struct {
		Scene string `json:"scene"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Scene = ""
	}
	scene := strings.TrimSpace(req.Scene)
	switch scene {
	case operation_setting.PurchaseSceneRedemption,
		operation_setting.PurchaseSceneTopup,
		operation_setting.PurchaseSceneSubscription:
	default:
		common.ApiErrorStatus(c, 200, &model.InvoiceError{
			Code:    model.InvoiceCodeInvalidStatus,
			Message: "Unknown purchase scene",
		}, gin.H{"code": model.InvoiceCodeInvalidStatus})
		return
	}

	state, err := model.GetPurchaseAgreementState(c.GetInt("id"))
	if err != nil {
		common.ApiErrorStatus(c, 200, err, gin.H{})
		return
	}

	required := false
	switch scene {
	case operation_setting.PurchaseSceneRedemption:
		required = state.RequireRedeem
	case operation_setting.PurchaseSceneTopup:
		required = state.RequireTopup
	case operation_setting.PurchaseSceneSubscription:
		required = state.RequirePlan
	}
	if required && !state.Signed {
		common.ApiErrorStatus(c, 200, &model.InvoiceError{
			Code:    "AGREEMENT_REQUIRED",
			Message: "Please read and accept the purchase agreement first",
		}, gin.H{"code": "AGREEMENT_REQUIRED", "agreement": state})
		return
	}
	common.ApiSuccess(c, state)
}

// ---------------------------------------------------------------------------
// 后台：发票管理与协议设置
// ---------------------------------------------------------------------------

// ListInvoicesAdmin 后台发票列表（GET /api/invoice/）
func ListInvoicesAdmin(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))

	result, err := model.ListInvoices(model.InvoiceFilter{
		Status:   c.Query("status"),
		Keyword:  c.Query("keyword"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		common.ApiErrorStatus(c, 200, err, invoiceErrorFields(err))
		return
	}
	common.ApiSuccess(c, result)
}

// GetInvoiceAdmin 后台查看单条申请（GET /api/invoice/:id）
func GetInvoiceAdmin(c *gin.Context) {
	invoiceId, ok := invoiceIdParam(c)
	if !ok {
		return
	}
	invoice, err := model.GetInvoiceById(invoiceId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, invoiceErrorFields(err))
		return
	}
	common.ApiSuccess(c, invoice)
}

// ReviewInvoiceAdmin 审核（PUT /api/invoice/:id/review）
func ReviewInvoiceAdmin(c *gin.Context) {
	invoiceId, ok := invoiceIdParam(c)
	if !ok {
		return
	}
	var req struct {
		Approve bool   `json:"approve"`
		Reason  string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.InvoiceError{
			Code:    model.InvoiceCodeInvalidStatus,
			Message: "Nothing to review",
		}, gin.H{"code": model.InvoiceCodeInvalidStatus})
		return
	}

	invoice, err := model.ReviewInvoice(invoiceId, req.Approve, req.Reason,
		c.GetInt("id"), currentUsername(c))
	if err != nil {
		common.ApiErrorStatus(c, 200, err, invoiceErrorFields(err))
		return
	}
	common.ApiSuccess(c, invoice)
}

// IssueInvoiceAdmin 开具（POST /api/invoice/:id/issue，multipart：invoice_no + file）
func IssueInvoiceAdmin(c *gin.Context) {
	invoiceId, ok := invoiceIdParam(c)
	if !ok {
		return
	}

	invoiceNo := c.PostForm("invoice_no")
	header, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorStatus(c, 200, &model.InvoiceError{
			Code:    model.InvoiceCodeFileMissing,
			Message: "Attach the invoice PDF",
		}, gin.H{"code": model.InvoiceCodeFileMissing})
		return
	}
	if header.Size > 8*1024*1024 {
		common.ApiErrorStatus(c, 200, &model.InvoiceError{
			Code:    model.InvoiceCodeFileTooLarge,
			Message: "The invoice file must be smaller than 8 MB",
		}, gin.H{"code": model.InvoiceCodeFileTooLarge})
		return
	}
	file, err := header.Open()
	if err != nil {
		common.ApiErrorStatus(c, 200, err, gin.H{})
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, gin.H{})
		return
	}

	invoice, err := model.IssueInvoice(invoiceId, invoiceNo, header.Filename, data,
		c.GetInt("id"), currentUsername(c))
	if err != nil {
		common.ApiErrorStatus(c, 200, err, invoiceErrorFields(err))
		return
	}
	common.ApiSuccess(c, invoice)
}

// DownloadInvoiceAdmin 后台下载发票文件（GET /api/invoice/:id/file）
func DownloadInvoiceAdmin(c *gin.Context) {
	invoiceId, ok := invoiceIdParam(c)
	if !ok {
		return
	}
	invoice, err := model.GetInvoiceById(invoiceId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, invoiceErrorFields(err))
		return
	}
	writeInvoiceFileResponse(c, invoice)
}

// GetInvoiceSettingAdmin 读取发票与协议设置（GET /api/invoice/setting）
func GetInvoiceSettingAdmin(c *gin.Context) {
	common.ApiSuccess(c, gin.H{
		"invoice":   operation_setting.GetInvoiceSetting(),
		"agreement": operation_setting.GetPurchaseAgreementSetting(),
	})
}

// UpdateInvoiceSettingAdmin 保存发票与协议设置（PUT /api/invoice/setting）
func UpdateInvoiceSettingAdmin(c *gin.Context) {
	var req struct {
		Invoice   *operation_setting.InvoiceSetting           `json:"invoice"`
		Agreement *operation_setting.PurchaseAgreementSetting `json:"agreement"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.InvoiceError{
			Code:    model.InvoiceCodeInvalidStatus,
			Message: "Fill in the settings form first",
		}, gin.H{"code": model.InvoiceCodeInvalidStatus})
		return
	}

	values := map[string]string{}
	if req.Invoice != nil {
		if req.Invoice.MinAmount < 0 || req.Invoice.MaxAmount < 0 {
			common.ApiErrorStatus(c, 200, &model.InvoiceError{
				Code:    model.InvoiceCodeInvalidAmount,
				Message: "Amount limits cannot be negative",
			}, gin.H{"code": model.InvoiceCodeInvalidAmount})
			return
		}
		if req.Invoice.MaxAmount > 0 && req.Invoice.MinAmount > req.Invoice.MaxAmount {
			common.ApiErrorStatus(c, 200, &model.InvoiceError{
				Code:    model.InvoiceCodeInvalidAmount,
				Message: "The minimum amount cannot be larger than the maximum",
			}, gin.H{"code": model.InvoiceCodeInvalidAmount})
			return
		}
		if req.Invoice.MaxPendingPerUser < 0 {
			req.Invoice.MaxPendingPerUser = 0
		}
		mapped, err := config.ConfigToMap(req.Invoice)
		if err != nil {
			common.ApiErrorStatus(c, 200, err, gin.H{})
			return
		}
		for key, value := range mapped {
			values["invoice_setting."+key] = value
		}
	}
	if req.Agreement != nil {
		req.Agreement.Title = strings.TrimSpace(req.Agreement.Title)
		req.Agreement.Version = strings.TrimSpace(req.Agreement.Version)
		req.Agreement.Content = strings.TrimSpace(req.Agreement.Content)
		if req.Agreement.Version == "" {
			req.Agreement.Version = "1.0"
		}
		if req.Agreement.Content == "" {
			common.ApiErrorStatus(c, 200, &model.InvoiceError{
				Code:    model.InvoiceCodeInvalidStatus,
				Message: "The agreement text cannot be empty",
			}, gin.H{"code": model.InvoiceCodeInvalidStatus})
			return
		}
		mapped, err := config.ConfigToMap(req.Agreement)
		if err != nil {
			common.ApiErrorStatus(c, 200, err, gin.H{})
			return
		}
		for key, value := range mapped {
			values["purchase_agreement_setting."+key] = value
		}
	}

	if err := model.UpdateOptionsBulk(values); err != nil {
		common.ApiErrorStatus(c, 200, err, gin.H{})
		return
	}

	common.SysLog(fmt.Sprintf("invoice: %s updated invoice and agreement settings",
		currentUsername(c)))
	common.ApiSuccess(c, gin.H{
		"invoice":   operation_setting.GetInvoiceSetting(),
		"agreement": operation_setting.GetPurchaseAgreementSetting(),
	})
}

// ListAgreementSignaturesAdmin 后台查看协议签署记录（GET /api/invoice/signatures）
func ListAgreementSignaturesAdmin(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))

	result, err := model.ListPurchaseAgreementSignatures(c.Query("keyword"), page, pageSize)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, gin.H{})
		return
	}
	common.ApiSuccess(c, result)
}
