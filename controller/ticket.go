package controller

import (
	"errors"
	"io"
	"net/url"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// ticketErrorFields 把带错误码的工单错误转成响应字段，供前端区分失败原因
func ticketErrorFields(err error) gin.H {
	var ticketErr *model.TicketError
	if errors.As(err, &ticketErr) {
		return gin.H{"code": ticketErr.Code, "reason": ticketErr.Message}
	}
	return gin.H{}
}

// ticketIdParam 读取路径里的工单 id
func ticketIdParam(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeNotFound,
			Message: "Ticket not found",
		}, gin.H{"code": model.TicketCodeNotFound})
		return 0, false
	}
	return id, true
}

// ListMyTickets 我的工单列表（GET /api/tickets?archived=&page=&page_size=）
func ListMyTickets(c *gin.Context) {
	if !operation_setting.IsTicketEnabled() {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeNotEnabled,
			Message: "The ticket system is not enabled",
		}, gin.H{"code": model.TicketCodeNotEnabled})
		return
	}

	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	archived := c.Query("archived") == "true" || c.Query("archived") == "1"

	result, err := model.ListUserTickets(c.GetInt("id"), archived, page, pageSize)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}

	unread, err := model.GetUserUnreadTicketCount(c.GetInt("id"))
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}

	common.ApiSuccess(c, gin.H{
		"items":        result.Items,
		"total":        result.Total,
		"page":         result.Page,
		"page_size":    result.PageSize,
		"unread_total": unread,
		"system":       model.GetTicketSystemState(),
	})
}

// GetMyTicket 工单详情（GET /api/tickets/:id）
func GetMyTicket(c *gin.Context) {
	ticketId, ok := ticketIdParam(c)
	if !ok {
		return
	}
	view, err := model.GetUserTicketView(c.GetInt("id"), ticketId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, view)
}

// CreateMyTicket 新建工单（POST /api/tickets）
func CreateMyTicket(c *gin.Context) {
	var req struct {
		Title     string   `json:"title"`
		Category  string   `json:"category"`
		Content   string   `json:"content"`
		ImageKeys []string `json:"image_keys"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeInvalidTitle,
			Message: "Fill in the ticket form first",
		}, gin.H{"code": model.TicketCodeInvalidTitle})
		return
	}

	view, err := model.CreateTicket(model.CreateTicketInput{
		UserId:    c.GetInt("id"),
		Title:     req.Title,
		Category:  req.Category,
		Content:   req.Content,
		ImageKeys: req.ImageKeys,
	})
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, view)
}

// ReplyMyTicket 用户追加消息（POST /api/tickets/:id/messages）
func ReplyMyTicket(c *gin.Context) {
	ticketId, ok := ticketIdParam(c)
	if !ok {
		return
	}
	var req struct {
		Content   string   `json:"content"`
		ImageKeys []string `json:"image_keys"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeEmptyContent,
			Message: "Write a message first",
		}, gin.H{"code": model.TicketCodeEmptyContent})
		return
	}

	view, err := model.ReplyUserTicket(c.GetInt("id"), ticketId, req.Content, req.ImageKeys)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, view)
}

// ResolveMyTicket 标记为已解决（PUT /api/tickets/:id/resolve）
func ResolveMyTicket(c *gin.Context) {
	ticketId, ok := ticketIdParam(c)
	if !ok {
		return
	}
	view, err := model.ResolveUserTicket(c.GetInt("id"), ticketId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, view)
}

// ArchiveMyTicket 归档或恢复（PUT /api/tickets/:id/archive  body: {"archived":true}）
func ArchiveMyTicket(c *gin.Context) {
	ticketId, ok := ticketIdParam(c)
	if !ok {
		return
	}
	var req struct {
		Archived bool `json:"archived"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeInvalidStatus,
			Message: "Unsupported archive state",
		}, gin.H{"code": model.TicketCodeInvalidStatus})
		return
	}

	view, err := model.ArchiveUserTicket(c.GetInt("id"), ticketId, req.Archived)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, view)
}

// storeTicketImageUpload 用户侧与客服侧共用的图片上传流程。
// 两套账号体系只有上传者身份不同，其余校验与响应完全一致。
func storeTicketImageUpload(c *gin.Context, uploaderType string, uploaderId int) {
	setting := operation_setting.GetTicketSetting()
	if !setting.AllowAttachments {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAttachmentDisabled,
			Message: "Images are disabled for tickets on this site",
		}, gin.H{"code": model.TicketCodeAttachmentDisabled})
		return
	}

	header, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAttachmentMissing,
			Message: "Choose an image first",
		}, gin.H{"code": model.TicketCodeAttachmentMissing})
		return
	}

	file, err := header.Open()
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	defer file.Close()

	// 多读一个字节用来判断是否超限，避免把超大文件整个读进内存
	data, err := io.ReadAll(io.LimitReader(file, ticketUploadReadLimit))
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}

	attachment, err := model.StoreTicketAttachment(uploaderType, uploaderId, header.Filename, data)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, gin.H{
		"id":        attachment.Id,
		"file_name": attachment.FileName,
		"mime_type": attachment.MimeType,
		"size":      attachment.Size,
	})
}

// UploadTicketAttachment 上传工单图片（POST /api/user/ticket-uploads）
func UploadTicketAttachment(c *gin.Context) {
	storeTicketImageUpload(c, model.TicketUploaderUser, c.GetInt("id"))
}

// UploadTicketAgentAttachment 客服上传工单图片（POST /api/ticket-console/uploads）
// 客服是独立账号体系，因此必须走自己的上传入口，不能借用用户侧的。
func UploadTicketAgentAttachment(c *gin.Context) {
	agent, ok := currentTicketAgent(c)
	if !ok {
		return
	}
	storeTicketImageUpload(c, model.TicketUploaderAgent, agent.Id)
}

// ticketUploadReadLimit 2MB 上限 + 1 字节用于判定超限
const ticketUploadReadLimit = 2*1024*1024 + 1

// GetTicketAttachment 读取工单图片（GET /api/ticket-uploads/:attachmentId）
// 图片在消息里以 blob 方式渲染，因此这里必须自己做归属校验。
func GetTicketAttachment(c *gin.Context) {
	attachmentId, err := strconv.Atoi(c.Param("attachmentId"))
	if err != nil || attachmentId <= 0 {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAttachmentMissing,
			Message: "This image is no longer available",
		}, gin.H{"code": model.TicketCodeAttachmentMissing})
		return
	}

	userId := c.GetInt("id")
	attachment, err := model.FindTicketAttachmentForUser(userId, attachmentId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}

	c.Header("Content-Type", model.TicketAttachmentMimeType(attachment))
	c.Header("Content-Length", strconv.FormatInt(attachment.Size, 10))
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Cache-Control", "private, max-age=600")
	c.Header("Content-Disposition", "inline; filename*=UTF-8''"+url.PathEscape(attachment.FileName))
	if err := model.CopyTicketAttachment(c.Writer, attachment); err != nil {
		// 响应头已发出，只能中断连接
		c.Abort()
	}
}
