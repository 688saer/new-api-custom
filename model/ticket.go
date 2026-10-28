package model

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 工单
// ---------------------------------------------------------------------------

// 工单状态。pending 与 processing 对用户都显示为「待客服回复」。
const (
	TicketStatusPending      = "pending"
	TicketStatusProcessing   = "processing"
	TicketStatusAwaitingUser = "awaiting_user"
	TicketStatusResolved     = "resolved"
	TicketStatusClosed       = "closed"
)

// 工单分类，与前端翻译键一一对应
const (
	TicketCategoryApi     = "api"
	TicketCategoryBilling = "billing"
	TicketCategoryAccount = "account"
	TicketCategoryModel   = "model"
	TicketCategoryOther   = "other"
)

// 工单优先级
const (
	TicketPriorityLow    = "low"
	TicketPriorityNormal = "normal"
	TicketPriorityHigh   = "high"
	TicketPriorityUrgent = "urgent"
)

// 消息作者类型
const (
	TicketAuthorUser   = "user"
	TicketAuthorAgent  = "agent"
	TicketAuthorSystem = "system"
)

// 工单相关错误码，前端依据 code 展示对应文案
const (
	TicketCodeNotFound              = "TICKET_NOT_FOUND"
	TicketCodeNotEnabled            = "TICKET_NOT_ENABLED"
	TicketCodeClosed                = "TICKET_CLOSED"
	TicketCodeLimitReached          = "TICKET_LIMIT_REACHED"
	TicketCodeInvalidCategory       = "TICKET_INVALID_CATEGORY"
	TicketCodeInvalidTitle          = "TICKET_INVALID_TITLE"
	TicketCodeEmptyContent          = "TICKET_EMPTY_CONTENT"
	TicketCodeAttachmentDisabled    = "TICKET_ATTACHMENT_DISABLED"
	TicketCodeAttachmentTooLarge    = "TICKET_ATTACHMENT_TOO_LARGE"
	TicketCodeAttachmentInvalidType = "TICKET_ATTACHMENT_INVALID_TYPE"
	TicketCodeAttachmentMissing     = "TICKET_ATTACHMENT_MISSING"
	TicketCodeForbidden             = "TICKET_FORBIDDEN"
	TicketCodeInvalidStatus         = "TICKET_INVALID_STATUS"
)

// TicketError 带错误码的工单错误，控制器会把 code 一并返回
type TicketError struct {
	Code    string
	Message string
}

func (e *TicketError) Error() string { return e.Message }

func newTicketError(code, message string) *TicketError {
	return &TicketError{Code: code, Message: message}
}

// Ticket 工单主表
type Ticket struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int    `json:"user_id" gorm:"not null;index:idx_ticket_user,priority:1"`
	Title     string `json:"title" gorm:"type:varchar(200);not null"`
	Category  string `json:"category" gorm:"type:varchar(32);not null;default:'other'"`
	Status    string `json:"status" gorm:"type:varchar(24);not null;default:'pending';index:idx_ticket_status,priority:1"`
	Priority  string `json:"priority" gorm:"type:varchar(16);not null;default:'normal'"`
	AgentId   int    `json:"agent_id" gorm:"not null;default:0;index:idx_ticket_agent"`
	AgentName string `json:"agent_name" gorm:"type:varchar(64);not null;default:''"`
	Archived  bool   `json:"archived" gorm:"not null;default:false"`

	// UnreadForUser / UnreadForStaff 未读消息数，打开详情时清零
	UnreadForUser  int `json:"unread_for_user" gorm:"not null;default:0"`
	UnreadForStaff int `json:"unread_for_staff" gorm:"not null;default:0"`

	MessageCount   int    `json:"message_count" gorm:"not null;default:0"`
	LastAuthorType string `json:"last_author_type" gorm:"type:varchar(16);not null;default:'user'"`
	LastMessageAt  int64  `json:"last_message_at" gorm:"bigint;not null;default:0;index:idx_ticket_last_message"`
	CreatedAt      int64  `json:"created_at" gorm:"bigint;not null;default:0;index:idx_ticket_user,priority:2"`
	UpdatedAt      int64  `json:"updated_at" gorm:"bigint;not null;default:0"`
	ResolvedAt     int64  `json:"resolved_at" gorm:"bigint;not null;default:0"`
	ClosedAt       int64  `json:"closed_at" gorm:"bigint;not null;default:0"`
}

func (Ticket) TableName() string {
	return "tickets"
}

// TicketMessage 工单消息
type TicketMessage struct {
	Id         int    `json:"id" gorm:"primaryKey;autoIncrement"`
	TicketId   int    `json:"ticket_id" gorm:"not null;index:idx_ticket_message_ticket,priority:1"`
	AuthorType string `json:"author_type" gorm:"type:varchar(16);not null"`
	AuthorId   int    `json:"author_id" gorm:"not null;default:0"`
	AuthorName string `json:"author_name" gorm:"type:varchar(64);not null;default:''"`
	Content    string `json:"content" gorm:"type:text"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint;not null;default:0;index:idx_ticket_message_ticket,priority:2"`
}

func (TicketMessage) TableName() string {
	return "ticket_messages"
}

// TicketAttachment 工单图片元数据。图片字节落盘，数据库只存路径与摘要，
// 避免把 2MB 图片塞进 TEXT 列（MySQL 的 TEXT 只有 64KB）。
type TicketAttachment struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	TicketId     int    `json:"ticket_id" gorm:"not null;default:0;index:idx_ticket_attachment_ticket"`
	MessageId    int    `json:"message_id" gorm:"not null;default:0"`
	UploaderType string `json:"-" gorm:"type:varchar(8);not null;default:'user'"`
	UploaderId   int    `json:"uploader_id" gorm:"not null;default:0"`
	FileName     string `json:"file_name" gorm:"type:varchar(120);not null;default:''"`
	MimeType     string `json:"mime_type" gorm:"type:varchar(64);not null;default:''"`
	Size         int64  `json:"size" gorm:"not null;default:0"`
	StorageKey   string `json:"-" gorm:"type:varchar(160);not null;default:''"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;not null;default:0"`
}

func (TicketAttachment) TableName() string {
	return "ticket_attachments"
}

// TicketMessageView 返回给前端的消息，带附件
type TicketMessageView struct {
	TicketMessage
	Attachments []TicketAttachment `json:"attachments"`
}

// TicketView 返回给前端的工单，附带展示字段
type TicketView struct {
	Ticket
	Username     string              `json:"username,omitempty"`
	Email        string              `json:"email,omitempty"`
	Messages     []TicketMessageView `json:"messages,omitempty"`
	Attachments  []TicketAttachment  `json:"attachments,omitempty"`
	UnreadCount  int                 `json:"unread_count"`
	Replyable    bool                `json:"replyable"`
	LastMessage  string              `json:"last_message,omitempty"`
	CustomFields map[string]any      `json:"-"`
}

// TicketListPage 分页结果
type TicketListPage struct {
	Items    []TicketView `json:"items"`
	Total    int64        `json:"total"`
	Page     int          `json:"page"`
	PageSize int          `json:"page_size"`
}

// 输入长度限制
const (
	ticketTitleMaxRunes   = 200
	ticketContentMaxRunes = 5000
	ticketPageSizeMax     = 100
	ticketPreviewRunes    = 120
)

// NormalizeTicketCategory 收敛分类，未知值回落 other
func NormalizeTicketCategory(category string) string {
	switch category {
	case TicketCategoryApi, TicketCategoryBilling, TicketCategoryAccount, TicketCategoryModel, TicketCategoryOther:
		return category
	default:
		return TicketCategoryOther
	}
}

// NormalizeTicketPriority 收敛优先级，未知值回落 normal
func NormalizeTicketPriority(priority string) string {
	switch priority {
	case TicketPriorityLow, TicketPriorityNormal, TicketPriorityHigh, TicketPriorityUrgent:
		return priority
	default:
		return TicketPriorityNormal
	}
}

// NormalizeTicketStatus 收敛状态，未知值返回空串表示非法
func NormalizeTicketStatus(status string) string {
	switch status {
	case TicketStatusPending, TicketStatusProcessing, TicketStatusAwaitingUser, TicketStatusResolved, TicketStatusClosed:
		return status
	default:
		return ""
	}
}

// IsTicketEnded 已解决或已关闭都算结束，此时用户不能继续回复
func IsTicketEnded(status string) bool {
	return status == TicketStatusResolved || status == TicketStatusClosed
}

// ticketReplyable 已归档的工单同样不能再回复，必须先恢复
func ticketReplyable(ticket *Ticket) bool {
	return !ticket.Archived && !IsTicketEnded(ticket.Status)
}

// ValidateTicketTitle 校验标题
func ValidateTicketTitle(title string) error {
	trimmed := strings.TrimSpace(title)
	if trimmed == "" {
		return newTicketError(TicketCodeInvalidTitle, "Enter a title for this ticket")
	}
	if utf8.RuneCountInString(trimmed) > ticketTitleMaxRunes {
		return newTicketError(TicketCodeInvalidTitle, "The title is too long")
	}
	return nil
}

// ValidateTicketContent 校验正文
func ValidateTicketContent(content string) error {
	if strings.TrimSpace(content) == "" {
		return newTicketError(TicketCodeEmptyContent, "Write a message first")
	}
	if utf8.RuneCountInString(content) > ticketContentMaxRunes {
		return newTicketError(TicketCodeEmptyContent, "The message is too long")
	}
	return nil
}

func ticketPreview(content string) string {
	compact := strings.Join(strings.Fields(content), " ")
	runes := []rune(compact)
	if len(runes) <= ticketPreviewRunes {
		return compact
	}
	return string(runes[:ticketPreviewRunes]) + "…"
}

func normalizeTicketPage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > ticketPageSizeMax {
		pageSize = ticketPageSizeMax
	}
	return page, pageSize
}

// loadTicketMessages 读取工单消息并挂上附件
func loadTicketMessages(ticketId int) ([]TicketMessageView, error) {
	var messages []TicketMessage
	if err := DB.Where("ticket_id = ?", ticketId).Order("id asc").Find(&messages).Error; err != nil {
		return nil, err
	}
	if len(messages) == 0 {
		return []TicketMessageView{}, nil
	}

	messageIds := make([]int, 0, len(messages))
	for _, message := range messages {
		messageIds = append(messageIds, message.Id)
	}

	var attachments []TicketAttachment
	if err := DB.Where("message_id IN ?", messageIds).Order("id asc").Find(&attachments).Error; err != nil {
		return nil, err
	}
	byMessage := make(map[int][]TicketAttachment, len(attachments))
	for _, attachment := range attachments {
		byMessage[attachment.MessageId] = append(byMessage[attachment.MessageId], attachment)
	}

	views := make([]TicketMessageView, 0, len(messages))
	for _, message := range messages {
		view := TicketMessageView{TicketMessage: message}
		if items, ok := byMessage[message.Id]; ok {
			view.Attachments = items
		} else {
			view.Attachments = []TicketAttachment{}
		}
		views = append(views, view)
	}
	return views, nil
}

// findUserTicket 读取属于该用户的工单，不存在时统一返回 NOT_FOUND，
// 避免用 404/403 的差异探测他人工单是否存在。
func findUserTicket(userId, ticketId int) (*Ticket, error) {
	var ticket Ticket
	err := DB.Where("id = ? AND user_id = ?", ticketId, userId).First(&ticket).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, newTicketError(TicketCodeNotFound, "Ticket not found")
	}
	if err != nil {
		return nil, err
	}
	return &ticket, nil
}

// GetUserTicketCount 用户未结束工单数
func GetUserTicketCount(userId int) (int64, error) {
	var count int64
	err := DB.Model(&Ticket{}).
		Where("user_id = ? AND status NOT IN ?", userId, []string{TicketStatusResolved, TicketStatusClosed}).
		Count(&count).Error
	return count, err
}

// GetUserUnreadTicketCount 用户未读工单条数（含消息未读）
func GetUserUnreadTicketCount(userId int) (int64, error) {
	var count int64
	err := DB.Model(&Ticket{}).
		Where("user_id = ? AND unread_for_user > 0", userId).
		Count(&count).Error
	return count, err
}

// CreateTicketInput 新建工单输入
type CreateTicketInput struct {
	UserId    int
	Title     string
	Category  string
	Content   string
	ImageKeys []string
}

// CreateTicket 新建工单并写入首条消息
func CreateTicket(input CreateTicketInput) (*TicketView, error) {
	if !operation_setting.IsTicketEnabled() {
		return nil, newTicketError(TicketCodeNotEnabled, "The ticket system is not enabled")
	}
	if err := ValidateTicketTitle(input.Title); err != nil {
		return nil, err
	}
	if err := ValidateTicketContent(input.Content); err != nil {
		return nil, err
	}

	setting := operation_setting.GetTicketSetting()
	if setting.MaxOpenTickets > 0 {
		openCount, err := GetUserTicketCount(input.UserId)
		if err != nil {
			return nil, err
		}
		if openCount >= int64(setting.MaxOpenTickets) {
			return nil, newTicketError(TicketCodeLimitReached,
				fmt.Sprintf("You already have %d open tickets. Resolve or archive one first.", openCount))
		}
	}

	now := common.GetTimestamp()
	ticket := &Ticket{
		UserId:         input.UserId,
		Title:          strings.TrimSpace(input.Title),
		Category:       NormalizeTicketCategory(input.Category),
		Status:         TicketStatusPending,
		Priority:       TicketPriorityNormal,
		LastAuthorType: TicketAuthorUser,
		LastMessageAt:  now,
		CreatedAt:      now,
		UpdatedAt:      now,
		MessageCount:   1,
		UnreadForStaff: 1,
	}

	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(ticket).Error; err != nil {
			return err
		}
		message := &TicketMessage{
			TicketId:   ticket.Id,
			AuthorType: TicketAuthorUser,
			AuthorId:   input.UserId,
			Content:    strings.TrimSpace(input.Content),
			CreatedAt:  now,
		}
		if err := tx.Create(message).Error; err != nil {
			return err
		}
		if err := attachUploadedImages(tx, ticket.Id, message.Id, TicketUploaderUser, input.UserId, input.ImageKeys); err != nil {
			return err
		}
		return appendOfflineAutoReply(tx, ticket, now)
	})
	if err != nil {
		return nil, err
	}

	return GetUserTicketView(input.UserId, ticket.Id)
}

// appendOfflineAutoReply 客服离线时给新消息补一条自动回复，同一工单 30 分钟内只回一次
func appendOfflineAutoReply(tx *gorm.DB, ticket *Ticket, now int64) error {
	setting := operation_setting.GetTicketSetting()
	if setting.Online || strings.TrimSpace(setting.OfflineReply) == "" {
		return nil
	}

	var recent int64
	err := tx.Model(&TicketMessage{}).
		Where("ticket_id = ? AND author_type = ? AND created_at > ?", ticket.Id, TicketAuthorSystem, now-30*60).
		Count(&recent).Error
	if err != nil {
		return err
	}
	if recent > 0 {
		return nil
	}

	message := &TicketMessage{
		TicketId:   ticket.Id,
		AuthorType: TicketAuthorSystem,
		AuthorName: operation_setting.TicketAgentName(),
		Content:    strings.TrimSpace(setting.OfflineReply),
		CreatedAt:  now,
	}
	if err := tx.Create(message).Error; err != nil {
		return err
	}
	return tx.Model(&Ticket{}).Where("id = ?", ticket.Id).Updates(map[string]any{
		"message_count":    gorm.Expr("message_count + 1"),
		"last_author_type": TicketAuthorSystem,
		"last_message_at":  now,
		"unread_for_user":  gorm.Expr("unread_for_user + 1"),
		"updated_at":       now,
	}).Error
}

// GetUserTicketView 读取用户侧工单详情（含消息），并把未读清零
func GetUserTicketView(userId, ticketId int) (*TicketView, error) {
	ticket, err := findUserTicket(userId, ticketId)
	if err != nil {
		return nil, err
	}

	messages, err := loadTicketMessages(ticketId)
	if err != nil {
		return nil, err
	}

	if ticket.UnreadForUser > 0 {
		if err := DB.Model(&Ticket{}).Where("id = ?", ticketId).Update("unread_for_user", 0).Error; err != nil {
			return nil, err
		}
		ticket.UnreadForUser = 0
	}

	view := &TicketView{
		Ticket:      *ticket,
		Messages:    messages,
		Replyable:   ticketReplyable(ticket),
		UnreadCount: 0,
	}
	if len(messages) > 0 {
		view.LastMessage = ticketPreview(messages[len(messages)-1].Content)
	}
	return view, nil
}

// ListUserTickets 用户侧工单列表，archived 控制看进行中还是已归档
func ListUserTickets(userId int, archived bool, page, pageSize int) (*TicketListPage, error) {
	page, pageSize = normalizeTicketPage(page, pageSize)

	query := DB.Model(&Ticket{}).Where("user_id = ? AND archived = ?", userId, archived)
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

	items, err := decorateTicketPreviews(tickets)
	if err != nil {
		return nil, err
	}
	return &TicketListPage{Items: items, Total: total, Page: page, PageSize: pageSize}, nil
}

// decorateTicketPreviews 批量补上最后一条消息的摘要，避免 N+1 查询
func decorateTicketPreviews(tickets []Ticket) ([]TicketView, error) {
	views := make([]TicketView, 0, len(tickets))
	if len(tickets) == 0 {
		return views, nil
	}

	ids := make([]int, 0, len(tickets))
	for _, ticket := range tickets {
		ids = append(ids, ticket.Id)
	}

	var messages []TicketMessage
	if err := DB.Where("ticket_id IN ?", ids).Order("id asc").Find(&messages).Error; err != nil {
		return nil, err
	}
	lastByTicket := make(map[int]TicketMessage, len(messages))
	for _, message := range messages {
		lastByTicket[message.TicketId] = message
	}

	for _, ticket := range tickets {
		view := TicketView{
			Ticket:      ticket,
			UnreadCount: ticket.UnreadForUser,
			Replyable:   ticketReplyable(&ticket),
		}
		if message, ok := lastByTicket[ticket.Id]; ok {
			view.LastMessage = ticketPreview(message.Content)
		}
		views = append(views, view)
	}
	return views, nil
}

// ReplyUserTicket 用户追加消息
func ReplyUserTicket(userId, ticketId int, content string, imageKeys []string) (*TicketView, error) {
	if err := ValidateTicketContent(content); err != nil {
		return nil, err
	}
	ticket, err := findUserTicket(userId, ticketId)
	if err != nil {
		return nil, err
	}
	if ticket.Archived {
		return nil, newTicketError(TicketCodeClosed, "This ticket is archived")
	}
	if IsTicketEnded(ticket.Status) {
		return nil, newTicketError(TicketCodeClosed, "This ticket is closed. Open a new one if you still need help.")
	}

	now := common.GetTimestamp()
	err = DB.Transaction(func(tx *gorm.DB) error {
		message := &TicketMessage{
			TicketId:   ticketId,
			AuthorType: TicketAuthorUser,
			AuthorId:   userId,
			Content:    strings.TrimSpace(content),
			CreatedAt:  now,
		}
		if err := tx.Create(message).Error; err != nil {
			return err
		}
		if err := attachUploadedImages(tx, ticketId, message.Id, TicketUploaderUser, userId, imageKeys); err != nil {
			return err
		}
		status := ticket.Status
		if status == TicketStatusAwaitingUser {
			status = TicketStatusProcessing
		}
		if err := tx.Model(&Ticket{}).Where("id = ?", ticketId).Updates(map[string]any{
			"message_count":    gorm.Expr("message_count + 1"),
			"last_author_type": TicketAuthorUser,
			"last_message_at":  now,
			"updated_at":       now,
			"status":           status,
			"unread_for_staff": gorm.Expr("unread_for_staff + 1"),
		}).Error; err != nil {
			return err
		}
		updated := *ticket
		updated.Status = status
		return appendOfflineAutoReply(tx, &updated, now)
	})
	if err != nil {
		return nil, err
	}
	return GetUserTicketView(userId, ticketId)
}

// ResolveUserTicket 用户把工单标记为已解决
func ResolveUserTicket(userId, ticketId int) (*TicketView, error) {
	ticket, err := findUserTicket(userId, ticketId)
	if err != nil {
		return nil, err
	}
	if IsTicketEnded(ticket.Status) {
		return nil, newTicketError(TicketCodeInvalidStatus, "This ticket is already closed")
	}

	now := common.GetTimestamp()
	if err := DB.Model(&Ticket{}).Where("id = ?", ticketId).Updates(map[string]any{
		"status":      TicketStatusResolved,
		"resolved_at": now,
		"updated_at":  now,
	}).Error; err != nil {
		return nil, err
	}
	return GetUserTicketView(userId, ticketId)
}

// ArchiveUserTicket 用户归档/恢复工单
func ArchiveUserTicket(userId, ticketId int, archived bool) (*TicketView, error) {
	if _, err := findUserTicket(userId, ticketId); err != nil {
		return nil, err
	}
	if err := DB.Model(&Ticket{}).Where("id = ?", ticketId).Updates(map[string]any{
		"archived":   archived,
		"updated_at": common.GetTimestamp(),
	}).Error; err != nil {
		return nil, err
	}
	return GetUserTicketView(userId, ticketId)
}
