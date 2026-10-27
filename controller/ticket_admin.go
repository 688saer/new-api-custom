package controller

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// 工单后台（独立账号、独立会话）
// ---------------------------------------------------------------------------

// currentTicketAgent 取出当前后台操作者
func currentTicketAgent(c *gin.Context) (*model.TicketAgent, bool) {
	agent, ok := middleware.GetTicketAgent(c)
	if !ok {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentSession,
			Message: "Sign in to the ticket console to continue",
		}, gin.H{"code": model.TicketCodeAgentSession})
		return nil, false
	}
	return agent, true
}

// TicketAgentLogin 后台登录（POST /api/ticket-console/auth/login）
func TicketAgentLogin(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentCredentials,
			Message: "Invalid username or password",
		}, gin.H{"code": model.TicketCodeAgentCredentials})
		return
	}

	agent, token, err := model.LoginTicketAgent(req.Username, req.Password, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}

	common.SysLog(fmt.Sprintf("ticket console: %s signed in from %s",
		model.TicketAgentAuditText(agent), c.ClientIP()))
	common.ApiSuccess(c, gin.H{
		"token": token,
		"agent": agent.ToView(),
	})
}

// TicketAgentLogout 后台退出（POST /api/ticket-console/auth/logout）
func TicketAgentLogout(c *gin.Context) {
	if token, ok := strings.CutPrefix(strings.TrimSpace(c.GetHeader("Authorization")), "Bearer "); ok {
		if err := model.RevokeTicketAgentSession(token); err != nil {
			common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
			return
		}
	}
	common.ApiSuccess(c, nil)
}

// TicketAgentSelf 当前账号信息（GET /api/ticket-console/auth/self）
func TicketAgentSelf(c *gin.Context) {
	agent, ok := currentTicketAgent(c)
	if !ok {
		return
	}
	common.ApiSuccess(c, gin.H{
		"agent":       agent.ToView(),
		"site_admin":  middleware.IsTicketSiteAdminSession(c),
		"permissions": model.TicketAgentPermissionCatalog(),
	})
}

// TicketAgentBootstrap 首个账号自助创建（POST /api/ticket-console/auth/bootstrap）
// 仅在还没有任何后台账号时可用，创建出来的是 owner。
func TicketAgentBootstrap(c *gin.Context) {
	var req struct {
		Username    string `json:"username"`
		DisplayName string `json:"display_name"`
		Password    string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentInvalidName,
			Message: "Fill in the account form first",
		}, gin.H{"code": model.TicketCodeAgentInvalidName})
		return
	}

	agent, err := model.BootstrapTicketAgent(req.Username, req.DisplayName, req.Password)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.SysLog(fmt.Sprintf("ticket console: bootstrap account %s created from %s",
		model.TicketAgentAuditText(agent), c.ClientIP()))
	common.ApiSuccess(c, agent.ToView())
}

// TicketAgentChangePassword 修改自己的密码（PUT /api/ticket-console/auth/password）
func TicketAgentChangePassword(c *gin.Context) {
	agent, ok := currentTicketAgent(c)
	if !ok {
		return
	}
	if middleware.IsTicketSiteAdminSession(c) {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentPassword,
			Message: "Create a ticket console account to change a password",
		}, gin.H{"code": model.TicketCodeAgentPassword})
		return
	}

	var req struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentPassword,
			Message: "Fill in both passwords",
		}, gin.H{"code": model.TicketCodeAgentPassword})
		return
	}

	if err := model.ChangeTicketAgentPassword(agent.Id, req.OldPassword, req.NewPassword); err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.SysLog(fmt.Sprintf("ticket console: %s changed its password", model.TicketAgentAuditText(agent)))
	common.ApiSuccess(c, nil)
}

// ListStaffTickets 后台工单队列（GET /api/ticket-console/tickets）
func ListStaffTickets(c *gin.Context) {
	agent, ok := currentTicketAgent(c)
	if !ok {
		return
	}

	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	result, err := model.ListStaffTickets(agent, model.StaffTicketFilter{
		Status:     c.Query("status"),
		Category:   c.Query("category"),
		Keyword:    c.Query("keyword"),
		Archived:   c.Query("archived") == "true" || c.Query("archived") == "1",
		Assignment: c.DefaultQuery("assignment", model.TicketAssignmentAll),
		Page:       page,
		PageSize:   pageSize,
	})
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, result)
}

// GetStaffTicket 后台工单详情（GET /api/ticket-console/tickets/:id）
func GetStaffTicket(c *gin.Context) {
	agent, ok := currentTicketAgent(c)
	if !ok {
		return
	}
	ticketId, ok := ticketIdParam(c)
	if !ok {
		return
	}
	view, err := model.GetStaffTicketView(agent, ticketId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, view)
}

// ReplyStaffTicket 客服回复（POST /api/ticket-console/tickets/:id/messages）
func ReplyStaffTicket(c *gin.Context) {
	agent, ok := currentTicketAgent(c)
	if !ok {
		return
	}
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
			Message: "Write a reply first",
		}, gin.H{"code": model.TicketCodeEmptyContent})
		return
	}

	view, err := model.ReplyStaffTicket(agent, ticketId, req.Content, req.ImageKeys)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, view)
}

// AssignStaffTicket 指派工单（PUT /api/ticket-console/tickets/:id/assign）
func AssignStaffTicket(c *gin.Context) {
	agent, ok := currentTicketAgent(c)
	if !ok {
		return
	}
	ticketId, ok := ticketIdParam(c)
	if !ok {
		return
	}

	var req struct {
		AgentId int `json:"agent_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentNotFound,
			Message: "Choose an account to assign",
		}, gin.H{"code": model.TicketCodeAgentNotFound})
		return
	}

	view, err := model.AssignStaffTicket(agent, ticketId, req.AgentId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, view)
}

// SetStaffTicketStatus 后台调整状态（PUT /api/ticket-console/tickets/:id/status）
func SetStaffTicketStatus(c *gin.Context) {
	agent, ok := currentTicketAgent(c)
	if !ok {
		return
	}
	ticketId, ok := ticketIdParam(c)
	if !ok {
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeInvalidStatus,
			Message: "Unsupported ticket status",
		}, gin.H{"code": model.TicketCodeInvalidStatus})
		return
	}

	view, err := model.SetStaffTicketStatus(agent, ticketId, req.Status)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, view)
}

// ArchiveStaffTicket 后台归档（PUT /api/ticket-console/tickets/:id/archive）
func ArchiveStaffTicket(c *gin.Context) {
	agent, ok := currentTicketAgent(c)
	if !ok {
		return
	}
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

	view, err := model.ArchiveStaffTicket(agent, ticketId, req.Archived)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, view)
}

// CreateStaffTicket 客服主动给用户发起会话（POST /api/ticket-console/tickets）
func CreateStaffTicket(c *gin.Context) {
	agent, ok := currentTicketAgent(c)
	if !ok {
		return
	}

	var req struct {
		UserId   int    `json:"user_id"`
		Title    string `json:"title"`
		Category string `json:"category"`
		Content  string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeInvalidTitle,
			Message: "Fill in the conversation form first",
		}, gin.H{"code": model.TicketCodeInvalidTitle})
		return
	}

	view, err := model.CreateStaffTicketForUser(agent, req.UserId, req.Title, req.Category, req.Content)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, view)
}

// GetStaffTicketCounts 各状态数量（GET /api/ticket-console/counts）
func GetStaffTicketCounts(c *gin.Context) {
	agent, ok := currentTicketAgent(c)
	if !ok {
		return
	}
	counts, err := model.GetStaffTicketCounts(agent)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, counts)
}

// ListTicketAgents 后台账号列表（GET /api/ticket-console/agents）
func ListTicketAgents(c *gin.Context) {
	agents, err := model.ListTicketAgents()
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	views := make([]model.TicketAgentView, 0, len(agents))
	for i := range agents {
		views = append(views, agents[i].ToView())
	}
	common.ApiSuccess(c, gin.H{
		"items":       views,
		"permissions": model.TicketAgentPermissionCatalog(),
		"roles": []gin.H{
			{"id": model.TicketAgentRoleOwner, "permissions": model.TicketAgentRolePermissions(model.TicketAgentRoleOwner)},
			{"id": model.TicketAgentRoleAdmin, "permissions": model.TicketAgentRolePermissions(model.TicketAgentRoleAdmin)},
			{"id": model.TicketAgentRoleAgent, "permissions": model.TicketAgentRolePermissions(model.TicketAgentRoleAgent)},
		},
	})
}

// CreateTicketAgent 新建后台账号（POST /api/ticket-console/agents）
func CreateTicketAgent(c *gin.Context) {
	operator, ok := currentTicketAgent(c)
	if !ok {
		return
	}

	var req struct {
		Username    string   `json:"username"`
		DisplayName string   `json:"display_name"`
		Password    string   `json:"password"`
		Role        string   `json:"role"`
		Permissions []string `json:"permissions"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentInvalidName,
			Message: "Fill in the account form first",
		}, gin.H{"code": model.TicketCodeAgentInvalidName})
		return
	}

	agent, err := model.CreateTicketAgent(operator.Id, req.Username, req.DisplayName, req.Password, req.Role, req.Permissions)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.SysLog(fmt.Sprintf("ticket console: %s created account %s",
		model.TicketAgentAuditText(operator), model.TicketAgentAuditText(agent)))
	common.ApiSuccess(c, agent.ToView())
}

// UpdateTicketAgent 修改账号（PUT /api/ticket-console/agents/:id）
func UpdateTicketAgent(c *gin.Context) {
	operator, ok := currentTicketAgent(c)
	if !ok {
		return
	}
	agentId, err := strconv.Atoi(c.Param("id"))
	if err != nil || agentId <= 0 {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentNotFound,
			Message: "This account no longer exists",
		}, gin.H{"code": model.TicketCodeAgentNotFound})
		return
	}

	var req struct {
		DisplayName string   `json:"display_name"`
		Role        string   `json:"role"`
		Permissions []string `json:"permissions"`
		Enabled     bool     `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentInvalidName,
			Message: "Fill in the account form first",
		}, gin.H{"code": model.TicketCodeAgentInvalidName})
		return
	}

	updated, err := model.UpdateTicketAgent(agentId, req.DisplayName, req.Role, req.Permissions, req.Enabled)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.SysLog(fmt.Sprintf("ticket console: %s updated account %s",
		model.TicketAgentAuditText(operator), model.TicketAgentAuditText(updated)))
	common.ApiSuccess(c, updated.ToView())
}

// DeleteTicketAgent 删除账号（DELETE /api/ticket-console/agents/:id）
func DeleteTicketAgent(c *gin.Context) {
	operator, ok := currentTicketAgent(c)
	if !ok {
		return
	}
	agentId, err := strconv.Atoi(c.Param("id"))
	if err != nil || agentId <= 0 {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentNotFound,
			Message: "This account no longer exists",
		}, gin.H{"code": model.TicketCodeAgentNotFound})
		return
	}
	if agentId == operator.Id {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentLastOwner,
			Message: "You cannot delete the account you are signed in with",
		}, gin.H{"code": model.TicketCodeAgentLastOwner})
		return
	}

	if err := model.DeleteTicketAgent(agentId); err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.SysLog(fmt.Sprintf("ticket console: %s deleted account id=%d",
		model.TicketAgentAuditText(operator), agentId))
	common.ApiSuccess(c, nil)
}

// ResetTicketAgentPassword 管理员重置他人密码（PUT /api/ticket-console/agents/:id/password）
func ResetTicketAgentPassword(c *gin.Context) {
	operator, ok := currentTicketAgent(c)
	if !ok {
		return
	}
	agentId, err := strconv.Atoi(c.Param("id"))
	if err != nil || agentId <= 0 {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentNotFound,
			Message: "This account no longer exists",
		}, gin.H{"code": model.TicketCodeAgentNotFound})
		return
	}

	var req struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAgentPassword,
			Message: "Fill in the new password first",
		}, gin.H{"code": model.TicketCodeAgentPassword})
		return
	}

	if err := model.ResetTicketAgentPassword(agentId, req.Password); err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.SysLog(fmt.Sprintf("ticket console: %s reset password of account id=%d",
		model.TicketAgentAuditText(operator), agentId))
	common.ApiSuccess(c, nil)
}

// GetTicketSettings 读取工单设置（GET /api/ticket-console/settings）
func GetTicketSettings(c *gin.Context) {
	setting := operation_setting.GetTicketSetting()
	common.ApiSuccess(c, gin.H{
		"setting":  setting,
		"defaults": model.GetTicketSystemState(),
	})
}

// UpdateTicketSettings 保存工单设置（PUT /api/ticket-console/settings）
func UpdateTicketSettings(c *gin.Context) {
	operator, ok := currentTicketAgent(c)
	if !ok {
		return
	}

	var req struct {
		Enabled          bool   `json:"enabled"`
		AgentName        string `json:"agent_name"`
		Welcome          string `json:"welcome"`
		Online           bool   `json:"online"`
		OfflineReply     string `json:"offline_reply"`
		MaxOpenTickets   int    `json:"max_open_tickets"`
		AllowAttachments bool   `json:"allow_attachments"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeInvalidStatus,
			Message: "Fill in the settings form first",
		}, gin.H{"code": model.TicketCodeInvalidStatus})
		return
	}

	setting := operation_setting.GetTicketSetting()
	setting.Enabled = req.Enabled
	setting.AgentName = strings.TrimSpace(req.AgentName)
	setting.Welcome = strings.TrimSpace(req.Welcome)
	setting.Online = req.Online
	setting.OfflineReply = strings.TrimSpace(req.OfflineReply)
	setting.MaxOpenTickets = req.MaxOpenTickets
	if setting.MaxOpenTickets < 0 {
		setting.MaxOpenTickets = 0
	}
	setting.AllowAttachments = req.AllowAttachments

	// 只写本模块自己的键，避免把其它模块的配置一起重写一遍
	configMap, err := config.ConfigToMap(setting)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	values := make(map[string]string, len(configMap))
	for key, value := range configMap {
		values["ticket_setting."+key] = value
	}
	if err := model.UpdateOptionsBulk(values); err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}

	common.SysLog(fmt.Sprintf("ticket console: %s updated ticket settings",
		model.TicketAgentAuditText(operator)))
	common.ApiSuccess(c, setting)
}

// SearchTicketUsers 搜索可以发起会话的用户（GET /api/ticket-console/users?keyword=）
func SearchTicketUsers(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	users, err := model.SearchRewardUsers(c.Query("keyword"), limit)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, ticketErrorFields(err))
		return
	}
	common.ApiSuccess(c, gin.H{"items": users})
}

// GetTicketAgentAttachment 后台读取工单图片（GET /api/ticket-console/attachments/:attachmentId）
func GetTicketAgentAttachment(c *gin.Context) {
	agent, ok := currentTicketAgent(c)
	if !ok {
		return
	}
	attachmentId, err := strconv.Atoi(c.Param("attachmentId"))
	if err != nil || attachmentId <= 0 {
		common.ApiErrorStatus(c, 200, &model.TicketError{
			Code:    model.TicketCodeAttachmentMissing,
			Message: "This image is no longer available",
		}, gin.H{"code": model.TicketCodeAttachmentMissing})
		return
	}

	attachment, err := model.FindTicketAttachmentByAgent(agent, attachmentId)
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
		c.Abort()
	}
}
