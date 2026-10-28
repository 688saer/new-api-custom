package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 工单后台：队列、指派、状态流转
// ---------------------------------------------------------------------------

// 队列筛选：只看指派给自己 / 只看未指派 / 全部
const (
	TicketAssignmentAll        = "all"
	TicketAssignmentMine       = "mine"
	TicketAssignmentUnassigned = "unassigned"
)

// TicketFilterAll 表示该维度不筛选（前端下拉框的"全部"选项）
const TicketFilterAll = "all"

// StaffTicketFilter 后台队列筛选条件
type StaffTicketFilter struct {
	Status     string
	Category   string
	Keyword    string
	Archived   bool
	Assignment string
	Page       int
	PageSize   int
}

// StaffTicketCounts 后台侧边栏角标
type StaffTicketCounts struct {
	Pending      int64 `json:"pending"`
	Processing   int64 `json:"processing"`
	AwaitingUser int64 `json:"awaiting_user"`
	Resolved     int64 `json:"resolved"`
	Closed       int64 `json:"closed"`
	Unassigned   int64 `json:"unassigned"`
	Unread       int64 `json:"unread"`
	Total        int64 `json:"total"`
}

// TicketAgentScope 把「能看哪些工单」收敛成一个查询条件
func ticketAgentScope(query *gorm.DB, agent *TicketAgent) *gorm.DB {
	if agent.HasPermission(TicketPermViewAll) {
		return query
	}
	return query.Where("agent_id = ?", agent.Id)
}

// requireTicketAgentPermission 权限不足时统一报错
func requireTicketAgentPermission(agent *TicketAgent, permission string) error {
	if agent.HasPermission(permission) {
		return nil
	}
	return newTicketError(TicketCodeAgentPermission, "You do not have permission for this action")
}

// findStaffTicket 读取工单并校验可见范围
func findStaffTicket(agent *TicketAgent, ticketId int) (*Ticket, error) {
	query := ticketAgentScope(DB.Model(&Ticket{}), agent)
	var ticket Ticket
	err := query.Where("id = ?", ticketId).First(&ticket).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, newTicketError(TicketCodeNotFound, "Ticket not found")
	}
	if err != nil {
		return nil, err
	}
	return &ticket, nil
}

// ListStaffTickets 后台工单队列
func ListStaffTickets(agent *TicketAgent, filter StaffTicketFilter) (*TicketListPage, error) {
	page, pageSize := normalizeTicketPage(filter.Page, filter.PageSize)

	query := ticketAgentScope(DB.Model(&Ticket{}), agent)
	query = query.Where("archived = ?", filter.Archived)

	if status := NormalizeTicketStatus(filter.Status); status != "" {
		query = query.Where("status = ?", status)
	}
	if category := strings.TrimSpace(filter.Category); category != "" && category != TicketFilterAll {
		query = query.Where("category = ?", category)
	}
	switch filter.Assignment {
	case TicketAssignmentMine:
		query = query.Where("agent_id = ?", agent.Id)
	case TicketAssignmentUnassigned:
		query = query.Where("agent_id = 0")
	}

	if keyword := strings.TrimSpace(filter.Keyword); keyword != "" {
		pattern := "%" + keyword + "%"
		query = query.Where(
			"title LIKE ? OR user_id IN (SELECT id FROM users WHERE username LIKE ?) OR id IN (SELECT ticket_id FROM ticket_messages WHERE content LIKE ?)",
			pattern, pattern, pattern,
		)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	var tickets []Ticket
	err := query.Order("last_message_at desc, id desc").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&tickets).Error
	if err != nil {
		return nil, err
	}

	items, err := decorateStaffTickets(tickets)
	if err != nil {
		return nil, err
	}
	return &TicketListPage{Items: items, Total: total, Page: page, PageSize: pageSize}, nil
}

// decorateStaffTickets 批量补用户信息与最后一条消息
func decorateStaffTickets(tickets []Ticket) ([]TicketView, error) {
	views := make([]TicketView, 0, len(tickets))
	if len(tickets) == 0 {
		return views, nil
	}

	ticketIds := make([]int, 0, len(tickets))
	userIds := make([]int, 0, len(tickets))
	for _, ticket := range tickets {
		ticketIds = append(ticketIds, ticket.Id)
		userIds = append(userIds, ticket.UserId)
	}

	var users []User
	if err := DB.Select("id", "username", "email").Where("id IN ?", userIds).Find(&users).Error; err != nil {
		return nil, err
	}
	userById := make(map[int]User, len(users))
	for _, user := range users {
		userById[user.Id] = user
	}

	var messages []TicketMessage
	if err := DB.Where("ticket_id IN ?", ticketIds).Order("id asc").Find(&messages).Error; err != nil {
		return nil, err
	}
	lastByTicket := make(map[int]TicketMessage, len(messages))
	for _, message := range messages {
		lastByTicket[message.TicketId] = message
	}

	for _, ticket := range tickets {
		view := TicketView{
			Ticket:      ticket,
			UnreadCount: ticket.UnreadForStaff,
			Replyable:   ticketReplyable(&ticket),
		}
		if user, ok := userById[ticket.UserId]; ok {
			view.Username = user.Username
			view.Email = user.Email
		}
		if message, ok := lastByTicket[ticket.Id]; ok {
			view.LastMessage = ticketPreview(message.Content)
		}
		views = append(views, view)
	}
	return views, nil
}

// GetStaffTicketView 后台工单详情，读取后清掉后台未读
func GetStaffTicketView(agent *TicketAgent, ticketId int) (*TicketView, error) {
	ticket, err := findStaffTicket(agent, ticketId)
	if err != nil {
		return nil, err
	}

	messages, err := loadTicketMessages(ticketId)
	if err != nil {
		return nil, err
	}

	if ticket.UnreadForStaff > 0 {
		if err := DB.Model(&Ticket{}).Where("id = ?", ticketId).Update("unread_for_staff", 0).Error; err != nil {
			return nil, err
		}
		ticket.UnreadForStaff = 0
	}

	view := &TicketView{
		Ticket:    *ticket,
		Messages:  messages,
		Replyable: ticketReplyable(ticket),
	}

	var user User
	if err := DB.Select("id", "username", "email").Where("id = ?", ticket.UserId).First(&user).Error; err == nil {
		view.Username = user.Username
		view.Email = user.Email
	}
	if len(messages) > 0 {
		view.LastMessage = ticketPreview(messages[len(messages)-1].Content)
	}
	return view, nil
}

// ReplyStaffTicket 客服回复
func ReplyStaffTicket(agent *TicketAgent, ticketId int, content string, imageKeys []string) (*TicketView, error) {
	if err := requireTicketAgentPermission(agent, TicketPermReply); err != nil {
		return nil, err
	}
	if err := ValidateTicketContent(content); err != nil {
		return nil, err
	}

	ticket, err := findStaffTicket(agent, ticketId)
	if err != nil {
		return nil, err
	}
	if IsTicketEnded(ticket.Status) {
		return nil, newTicketError(TicketCodeClosed, "This ticket is already closed")
	}
	if ticket.Archived {
		return nil, newTicketError(TicketCodeClosed, "This ticket is archived. Restore it to continue.")
	}

	now := common.GetTimestamp()
	err = DB.Transaction(func(tx *gorm.DB) error {
		message := &TicketMessage{
			TicketId:   ticketId,
			AuthorType: TicketAuthorAgent,
			AuthorId:   agent.Id,
			AuthorName: agent.DisplayLabel(),
			Content:    strings.TrimSpace(content),
			CreatedAt:  now,
		}
		if err := tx.Create(message).Error; err != nil {
			return err
		}
		if err := attachUploadedImages(tx, ticketId, message.Id, TicketUploaderAgent, agent.Id, imageKeys); err != nil {
			return err
		}

		updates := map[string]any{
			"message_count":    gorm.Expr("message_count + 1"),
			"last_author_type": TicketAuthorAgent,
			"last_message_at":  now,
			"updated_at":       now,
			"status":           TicketStatusAwaitingUser,
			"unread_for_user":  gorm.Expr("unread_for_user + 1"),
		}
		// 站点管理员代管时 Id 为 0，不能把「未指派」写成已指派
		if agent.Id > 0 {
			updates["agent_id"] = agent.Id
			updates["agent_name"] = agent.DisplayLabel()
		}
		return tx.Model(&Ticket{}).Where("id = ?", ticketId).Updates(updates).Error
	})
	if err != nil {
		return nil, err
	}
	return GetStaffTicketView(agent, ticketId)
}

// AssignStaffTicket 指派工单，targetAgentId 为 0 表示取消指派
func AssignStaffTicket(agent *TicketAgent, ticketId, targetAgentId int) (*TicketView, error) {
	if err := requireTicketAgentPermission(agent, TicketPermAssign); err != nil {
		return nil, err
	}
	if _, err := findStaffTicket(agent, ticketId); err != nil {
		return nil, err
	}

	agentName := ""
	status := ""
	if targetAgentId > 0 {
		target, err := GetTicketAgent(targetAgentId)
		if err != nil {
			return nil, err
		}
		if !target.Enabled {
			return nil, newTicketError(TicketCodeAgentDisabled, "This account is disabled")
		}
		agentName = target.DisplayLabel()
		status = TicketStatusProcessing
	}

	updates := map[string]any{
		"agent_id":   targetAgentId,
		"agent_name": agentName,
		"updated_at": common.GetTimestamp(),
	}
	if status != "" {
		updates["status"] = status
	}
	if err := DB.Model(&Ticket{}).Where("id = ?", ticketId).Updates(updates).Error; err != nil {
		return nil, err
	}
	return GetStaffTicketView(agent, ticketId)
}

// SetStaffTicketStatus 后台调整状态（处理中 / 已解决 / 已关闭）
func SetStaffTicketStatus(agent *TicketAgent, ticketId int, status string) (*TicketView, error) {
	if err := requireTicketAgentPermission(agent, TicketPermClose); err != nil {
		return nil, err
	}
	normalized := NormalizeTicketStatus(status)
	if normalized == "" || normalized == TicketStatusAwaitingUser {
		return nil, newTicketError(TicketCodeInvalidStatus, "Unsupported ticket status")
	}

	if _, err := findStaffTicket(agent, ticketId); err != nil {
		return nil, err
	}

	now := common.GetTimestamp()
	updates := map[string]any{
		"status":     normalized,
		"updated_at": now,
	}
	switch normalized {
	case TicketStatusResolved:
		updates["resolved_at"] = now
	case TicketStatusClosed:
		updates["closed_at"] = now
	case TicketStatusProcessing:
		if agent.Id > 0 {
			updates["agent_id"] = agent.Id
			updates["agent_name"] = agent.DisplayLabel()
		}
	}
	if err := DB.Model(&Ticket{}).Where("id = ?", ticketId).Updates(updates).Error; err != nil {
		return nil, err
	}
	return GetStaffTicketView(agent, ticketId)
}

// ArchiveStaffTicket 后台归档/恢复工单
func ArchiveStaffTicket(agent *TicketAgent, ticketId int, archived bool) (*TicketView, error) {
	if err := requireTicketAgentPermission(agent, TicketPermClose); err != nil {
		return nil, err
	}
	if _, err := findStaffTicket(agent, ticketId); err != nil {
		return nil, err
	}
	if err := DB.Model(&Ticket{}).Where("id = ?", ticketId).Updates(map[string]any{
		"archived":   archived,
		"updated_at": common.GetTimestamp(),
	}).Error; err != nil {
		return nil, err
	}
	return GetStaffTicketView(agent, ticketId)
}

// GetStaffTicketCounts 各状态数量，按可见范围统计
func GetStaffTicketCounts(agent *TicketAgent) (*StaffTicketCounts, error) {
	counts := &StaffTicketCounts{}

	base := ticketAgentScope(DB.Model(&Ticket{}), agent).Where("archived = ?", false)
	var rows []struct {
		Status string
		Total  int64
	}
	if err := base.Select("status, count(*) as total").Group("status").Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		switch row.Status {
		case TicketStatusPending:
			counts.Pending = row.Total
		case TicketStatusProcessing:
			counts.Processing = row.Total
		case TicketStatusAwaitingUser:
			counts.AwaitingUser = row.Total
		case TicketStatusResolved:
			counts.Resolved = row.Total
		case TicketStatusClosed:
			counts.Closed = row.Total
		}
		counts.Total += row.Total
	}

	unassigned := ticketAgentScope(DB.Model(&Ticket{}), agent).
		Where("archived = ? AND agent_id = 0 AND status NOT IN ?", false,
			[]string{TicketStatusResolved, TicketStatusClosed})
	if err := unassigned.Count(&counts.Unassigned).Error; err != nil {
		return nil, err
	}

	unread := ticketAgentScope(DB.Model(&Ticket{}), agent).
		Where("archived = ? AND unread_for_staff > 0", false)
	if err := unread.Count(&counts.Unread).Error; err != nil {
		return nil, err
	}

	return counts, nil
}

// CreateStaffTicketForUser 客服主动给某个用户发起会话
func CreateStaffTicketForUser(agent *TicketAgent, userId int, title, category, content string) (*TicketView, error) {
	if err := requireTicketAgentPermission(agent, TicketPermReply); err != nil {
		return nil, err
	}
	if err := ValidateTicketTitle(title); err != nil {
		return nil, err
	}
	if err := ValidateTicketContent(content); err != nil {
		return nil, err
	}

	var user User
	err := DB.Select("id").Where("id = ?", userId).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, newTicketError(TicketCodeNotFound, "This user does not exist")
	}
	if err != nil {
		return nil, err
	}

	now := common.GetTimestamp()
	ticket := &Ticket{
		UserId:         userId,
		Title:          strings.TrimSpace(title),
		Category:       NormalizeTicketCategory(category),
		Status:         TicketStatusAwaitingUser,
		Priority:       TicketPriorityNormal,
		AgentId:        agent.Id,
		AgentName:      agent.DisplayLabel(),
		LastAuthorType: TicketAuthorAgent,
		LastMessageAt:  now,
		CreatedAt:      now,
		UpdatedAt:      now,
		MessageCount:   1,
		UnreadForUser:  1,
	}
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(ticket).Error; err != nil {
			return err
		}
		message := &TicketMessage{
			TicketId:   ticket.Id,
			AuthorType: TicketAuthorAgent,
			AuthorId:   agent.Id,
			AuthorName: agent.DisplayLabel(),
			Content:    strings.TrimSpace(content),
			CreatedAt:  now,
		}
		return tx.Create(message).Error
	})
	if err != nil {
		return nil, err
	}
	return GetStaffTicketView(agent, ticket.Id)
}

// GetTicketSystemState 工单系统对外的公开状态，用户侧用它决定是否显示入口
func GetTicketSystemState() map[string]any {
	setting := operation_setting.GetTicketSetting()
	return map[string]any{
		"enabled":           setting.Enabled,
		"agent_name":        operation_setting.TicketAgentName(),
		"welcome":           setting.Welcome,
		"online":            setting.Online,
		"offline_reply":     setting.OfflineReply,
		"allow_attachments": setting.AllowAttachments,
		"max_open_tickets":  setting.MaxOpenTickets,
		"categories": []string{
			TicketCategoryApi,
			TicketCategoryBilling,
			TicketCategoryAccount,
			TicketCategoryModel,
			TicketCategoryOther,
		},
	}
}
