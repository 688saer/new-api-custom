package model

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 工单后台账号（与站点用户完全独立的一套账号体系）
// ---------------------------------------------------------------------------

// 工单后台角色。角色只是权限预设，实际权限逐账号存 permissions 字段。
const (
	TicketAgentRoleOwner = "owner" // 拥有全部权限，且是唯一不可降级的角色
	TicketAgentRoleAdmin = "admin" // 可处理工单、改设置，不能管理账号
	TicketAgentRoleAgent = "agent" // 只能处理分配给自己的工单
)

// 权限点
const (
	TicketPermViewAll  = "tickets.view_all" // 查看全部工单（否则只看分配给自己的）
	TicketPermReply    = "tickets.reply"    // 回复工单
	TicketPermAssign   = "tickets.assign"   // 指派客服
	TicketPermClose    = "tickets.close"    // 解决/关闭/归档/恢复
	TicketPermAgents   = "agents.manage"    // 管理后台账号
	TicketPermSettings = "settings.manage"  // 修改工单设置
)

// 工单后台相关错误码
const (
	TicketCodeAgentCredentials  = "TICKET_AGENT_CREDENTIALS"
	TicketCodeAgentLocked       = "TICKET_AGENT_LOCKED"
	TicketCodeAgentDisabled     = "TICKET_AGENT_DISABLED"
	TicketCodeAgentNotFound     = "TICKET_AGENT_NOT_FOUND"
	TicketCodeAgentUsername     = "TICKET_AGENT_USERNAME_TAKEN"
	TicketCodeAgentInvalidName  = "TICKET_AGENT_INVALID_NAME"
	TicketCodeAgentPassword     = "TICKET_AGENT_INVALID_PASSWORD"
	TicketCodeAgentLastOwner    = "TICKET_AGENT_LAST_OWNER"
	TicketCodeAgentPermission   = "TICKET_AGENT_PERMISSION_DENIED"
	TicketCodeAgentSession      = "TICKET_AGENT_SESSION_EXPIRED"
	TicketCodeAgentBootstrapOff = "TICKET_AGENT_BOOTSTRAP_CLOSED"
)

// 会话有效期与登录锁定策略
const (
	ticketAgentSessionTTL   = 7 * 24 * time.Hour
	ticketAgentMaxFailures  = 5
	ticketAgentLockDuration = 15 * time.Minute
	ticketAgentTokenBytes   = 32
)

// ticketAgentPermissionCatalog 全部权限点，顺序即前端展示顺序
var ticketAgentPermissionCatalog = []string{
	TicketPermViewAll,
	TicketPermReply,
	TicketPermAssign,
	TicketPermClose,
	TicketPermAgents,
	TicketPermSettings,
}

// TicketAgentPermissionCatalog 返回全部权限点
func TicketAgentPermissionCatalog() []string {
	return append([]string{}, ticketAgentPermissionCatalog...)
}

// TicketAgentRolePermissions 角色对应的默认权限
func TicketAgentRolePermissions(role string) []string {
	switch role {
	case TicketAgentRoleOwner:
		return TicketAgentPermissionCatalog()
	case TicketAgentRoleAdmin:
		return []string{TicketPermViewAll, TicketPermReply, TicketPermAssign, TicketPermClose, TicketPermSettings}
	case TicketAgentRoleAgent:
		return []string{TicketPermReply, TicketPermClose}
	default:
		return []string{}
	}
}

// NormalizeTicketAgentRole 收敛角色，未知值回落 agent
func NormalizeTicketAgentRole(role string) string {
	switch role {
	case TicketAgentRoleOwner, TicketAgentRoleAdmin, TicketAgentRoleAgent:
		return role
	default:
		return TicketAgentRoleAgent
	}
}

// TicketAgent 工单后台账号
type TicketAgent struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	Username     string `json:"username" gorm:"type:varchar(64);not null;uniqueIndex:idx_ticket_agent_username"`
	DisplayName  string `json:"display_name" gorm:"type:varchar(64);not null;default:''"`
	PasswordHash string `json:"-" gorm:"type:varchar(255);not null"`
	Role         string `json:"role" gorm:"type:varchar(16);not null;default:'agent'"`
	Permissions  string `json:"-" gorm:"type:text"`
	Enabled      bool   `json:"enabled" gorm:"not null;default:true"`
	LastLoginAt  int64  `json:"last_login_at" gorm:"bigint;not null;default:0"`
	LastLoginIp  string `json:"last_login_ip" gorm:"type:varchar(64);not null;default:''"`
	FailedLogin  int    `json:"-" gorm:"not null;default:0"`
	LockedUntil  int64  `json:"locked_until" gorm:"bigint;not null;default:0"`
	CreatedBy    int    `json:"created_by" gorm:"not null;default:0"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;not null;default:0"`
	UpdatedAt    int64  `json:"updated_at" gorm:"bigint;not null;default:0"`
}

func (TicketAgent) TableName() string {
	return "ticket_agents"
}

// TicketAgentSession 工单后台登录会话，库里只存 token 的哈希
type TicketAgentSession struct {
	Id         int    `json:"id" gorm:"primaryKey;autoIncrement"`
	AgentId    int    `json:"agent_id" gorm:"not null;index:idx_ticket_agent_session_agent"`
	TokenHash  string `json:"-" gorm:"type:varchar(64);not null;uniqueIndex:idx_ticket_agent_session_token"`
	Ip         string `json:"ip" gorm:"type:varchar(64);not null;default:''"`
	UserAgent  string `json:"user_agent" gorm:"type:varchar(255);not null;default:''"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint;not null;default:0"`
	ExpiresAt  int64  `json:"expires_at" gorm:"bigint;not null;default:0;index:idx_ticket_agent_session_expires"`
	LastSeenAt int64  `json:"last_seen_at" gorm:"bigint;not null;default:0"`
}

func (TicketAgentSession) TableName() string {
	return "ticket_agent_sessions"
}

// TicketAgentView 返回给前端的账号信息，附带解析后的权限列表
type TicketAgentView struct {
	Id          int      `json:"id"`
	Username    string   `json:"username"`
	DisplayName string   `json:"display_name"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
	Enabled     bool     `json:"enabled"`
	LastLoginAt int64    `json:"last_login_at"`
	LastLoginIp string   `json:"last_login_ip"`
	CreatedAt   int64    `json:"created_at"`
	LockedUntil int64    `json:"locked_until"`
}

// PermissionList 解析权限列表，owner 始终拥有全部权限
func (agent *TicketAgent) PermissionList() []string {
	if agent.Role == TicketAgentRoleOwner {
		return TicketAgentPermissionCatalog()
	}
	permissions := make([]string, 0, 4)
	if strings.TrimSpace(agent.Permissions) == "" {
		return permissions
	}
	var stored []string
	if err := common.UnmarshalJsonStr(agent.Permissions, &stored); err != nil {
		return permissions
	}
	for _, candidate := range ticketAgentPermissionCatalog {
		for _, granted := range stored {
			if granted == candidate {
				permissions = append(permissions, candidate)
				break
			}
		}
	}
	return permissions
}

// HasPermission 判断是否拥有某个权限
func (agent *TicketAgent) HasPermission(permission string) bool {
	if agent == nil {
		return false
	}
	if agent.Role == TicketAgentRoleOwner {
		return true
	}
	for _, granted := range agent.PermissionList() {
		if granted == permission {
			return true
		}
	}
	return false
}

// ToView 转成前端结构
func (agent *TicketAgent) ToView() TicketAgentView {
	return TicketAgentView{
		Id:          agent.Id,
		Username:    agent.Username,
		DisplayName: agent.DisplayName,
		Role:        agent.Role,
		Permissions: agent.PermissionList(),
		Enabled:     agent.Enabled,
		LastLoginAt: agent.LastLoginAt,
		LastLoginIp: agent.LastLoginIp,
		CreatedAt:   agent.CreatedAt,
		LockedUntil: agent.LockedUntil,
	}
}

// DisplayLabel 工单里展示的客服名
func (agent *TicketAgent) DisplayLabel() string {
	if agent.DisplayName != "" {
		return agent.DisplayName
	}
	return agent.Username
}

func encodeTicketAgentPermissions(permissions []string) (string, error) {
	allowed := make([]string, 0, len(permissions))
	for _, candidate := range ticketAgentPermissionCatalog {
		for _, granted := range permissions {
			if granted == candidate {
				allowed = append(allowed, candidate)
				break
			}
		}
	}
	data, err := common.Marshal(allowed)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func validateTicketAgentUsername(username string) error {
	if len(username) < 3 || len(username) > 32 {
		return newTicketError(TicketCodeAgentInvalidName, "The username must be 3 to 32 characters")
	}
	for _, r := range username {
		isLower := r >= 'a' && r <= 'z'
		isUpper := r >= 'A' && r <= 'Z'
		isDigit := r >= '0' && r <= '9'
		if isLower || isUpper || isDigit || r == '_' || r == '-' || r == '.' {
			continue
		}
		return newTicketError(TicketCodeAgentInvalidName, "Use letters, digits, dot, dash or underscore only")
	}
	return nil
}

func validateTicketAgentPassword(password string) error {
	if utf8.RuneCountInString(password) < 8 {
		return newTicketError(TicketCodeAgentPassword, "The password must be at least 8 characters")
	}
	if utf8.RuneCountInString(password) > 128 {
		return newTicketError(TicketCodeAgentPassword, "The password is too long")
	}
	return nil
}

// CountTicketAgents 已存在的后台账号数
func CountTicketAgents() (int64, error) {
	var count int64
	err := DB.Model(&TicketAgent{}).Count(&count).Error
	return count, err
}

// BootstrapTicketAgent 首个账号自助创建：仅在还没有任何账号时可用
func BootstrapTicketAgent(username, displayName, password string) (*TicketAgent, error) {
	count, err := CountTicketAgents()
	if err != nil {
		return nil, err
	}
	if count > 0 {
		return nil, newTicketError(TicketCodeAgentBootstrapOff, "An account already exists. Sign in instead.")
	}
	return CreateTicketAgent(0, username, displayName, password, TicketAgentRoleOwner, TicketAgentPermissionCatalog())
}

// CreateTicketAgent 新建后台账号
func CreateTicketAgent(createdBy int, username, displayName, password, role string, permissions []string) (*TicketAgent, error) {
	normalized := strings.ToLower(strings.TrimSpace(username))
	if err := validateTicketAgentUsername(normalized); err != nil {
		return nil, err
	}
	if err := validateTicketAgentPassword(password); err != nil {
		return nil, err
	}

	var existing int64
	if err := DB.Model(&TicketAgent{}).Where("username = ?", normalized).Count(&existing).Error; err != nil {
		return nil, err
	}
	if existing > 0 {
		return nil, newTicketError(TicketCodeAgentUsername, "This username is already taken")
	}

	hash, err := common.Password2Hash(password)
	if err != nil {
		return nil, err
	}

	normalizedRole := NormalizeTicketAgentRole(role)
	if len(permissions) == 0 {
		permissions = TicketAgentRolePermissions(normalizedRole)
	}
	encoded, err := encodeTicketAgentPermissions(permissions)
	if err != nil {
		return nil, err
	}

	now := common.GetTimestamp()
	agent := &TicketAgent{
		Username:     normalized,
		DisplayName:  strings.TrimSpace(displayName),
		PasswordHash: hash,
		Role:         normalizedRole,
		Permissions:  encoded,
		Enabled:      true,
		CreatedBy:    createdBy,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	if err := DB.Create(agent).Error; err != nil {
		return nil, err
	}
	return agent, nil
}

// ListTicketAgents 全部后台账号
func ListTicketAgents() ([]TicketAgent, error) {
	var agents []TicketAgent
	err := DB.Order("id asc").Find(&agents).Error
	return agents, err
}

// GetTicketAgent 按 id 读取账号
func GetTicketAgent(id int) (*TicketAgent, error) {
	var agent TicketAgent
	err := DB.Where("id = ?", id).First(&agent).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, newTicketError(TicketCodeAgentNotFound, "This account no longer exists")
	}
	if err != nil {
		return nil, err
	}
	return &agent, nil
}

// UpdateTicketAgent 修改账号资料、角色与权限
func UpdateTicketAgent(id int, displayName, role string, permissions []string, enabled bool) (*TicketAgent, error) {
	agent, err := GetTicketAgent(id)
	if err != nil {
		return nil, err
	}

	normalizedRole := NormalizeTicketAgentRole(role)
	if agent.Role == TicketAgentRoleOwner && normalizedRole != TicketAgentRoleOwner {
		if err := ensureAnotherTicketAgentOwner(agent.Id); err != nil {
			return nil, err
		}
	}
	if !enabled && agent.Role == TicketAgentRoleOwner {
		if err := ensureAnotherTicketAgentOwner(agent.Id); err != nil {
			return nil, err
		}
	}

	encoded, err := encodeTicketAgentPermissions(permissions)
	if err != nil {
		return nil, err
	}

	updates := map[string]any{
		"display_name": strings.TrimSpace(displayName),
		"role":         normalizedRole,
		"permissions":  encoded,
		"enabled":      enabled,
		"updated_at":   common.GetTimestamp(),
	}
	if err := DB.Model(&TicketAgent{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	if !enabled {
		if err := RevokeTicketAgentSessions(id); err != nil {
			return nil, err
		}
	}
	return GetTicketAgent(id)
}

// ensureAnotherTicketAgentOwner 至少保留一个启用的 owner，避免把自己锁在门外
func ensureAnotherTicketAgentOwner(excludeId int) error {
	var count int64
	err := DB.Model(&TicketAgent{}).
		Where("role = ? AND enabled = ? AND id <> ?", TicketAgentRoleOwner, true, excludeId).
		Count(&count).Error
	if err != nil {
		return err
	}
	if count == 0 {
		return newTicketError(TicketCodeAgentLastOwner, "At least one enabled owner account must remain")
	}
	return nil
}

// DeleteTicketAgent 删除账号并清掉它的会话
func DeleteTicketAgent(id int) error {
	agent, err := GetTicketAgent(id)
	if err != nil {
		return err
	}
	if agent.Role == TicketAgentRoleOwner {
		if err := ensureAnotherTicketAgentOwner(agent.Id); err != nil {
			return err
		}
	}
	if err := RevokeTicketAgentSessions(id); err != nil {
		return err
	}
	return DB.Delete(&TicketAgent{}, id).Error
}

// ResetTicketAgentPassword 管理员重置他人密码，同时踢掉旧会话
func ResetTicketAgentPassword(id int, password string) error {
	if err := validateTicketAgentPassword(password); err != nil {
		return err
	}
	hash, err := common.Password2Hash(password)
	if err != nil {
		return err
	}
	result := DB.Model(&TicketAgent{}).Where("id = ?", id).Updates(map[string]any{
		"password_hash": hash,
		"failed_login":  0,
		"locked_until":  0,
		"updated_at":    common.GetTimestamp(),
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return newTicketError(TicketCodeAgentNotFound, "This account no longer exists")
	}
	return RevokeTicketAgentSessions(id)
}

// ChangeTicketAgentPassword 账号自己改密码，需要验证旧密码
func ChangeTicketAgentPassword(id int, oldPassword, newPassword string) error {
	agent, err := GetTicketAgent(id)
	if err != nil {
		return err
	}
	if !common.ValidatePasswordAndHash(oldPassword, agent.PasswordHash) {
		return newTicketError(TicketCodeAgentCredentials, "The current password is incorrect")
	}
	if oldPassword == newPassword {
		return newTicketError(TicketCodeAgentPassword, "Choose a password different from the current one")
	}
	return ResetTicketAgentPassword(id, newPassword)
}

func ticketAgentTokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// dummyPasswordHash 用于账号不存在时也走一次 bcrypt 比对，抹平时间差
var dummyPasswordHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

// LoginTicketAgent 校验账号密码，成功后签发会话 token
func LoginTicketAgent(username, password, ip, userAgent string) (*TicketAgent, string, error) {
	normalized := strings.ToLower(strings.TrimSpace(username))
	if normalized == "" || password == "" {
		return nil, "", newTicketError(TicketCodeAgentCredentials, "Invalid username or password")
	}

	var agent TicketAgent
	err := DB.Where("username = ?", normalized).First(&agent).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		common.ValidatePasswordAndHash(password, dummyPasswordHash)
		return nil, "", newTicketError(TicketCodeAgentCredentials, "Invalid username or password")
	}
	if err != nil {
		return nil, "", err
	}

	now := common.GetTimestamp()
	if agent.LockedUntil > now {
		return nil, "", newTicketError(TicketCodeAgentLocked, "Too many failed attempts. Try again later.")
	}
	if !agent.Enabled {
		return nil, "", newTicketError(TicketCodeAgentDisabled, "This account is disabled")
	}
	if !common.ValidatePasswordAndHash(password, agent.PasswordHash) {
		recordTicketAgentLoginFailure(&agent, now)
		return nil, "", newTicketError(TicketCodeAgentCredentials, "Invalid username or password")
	}

	token, err := newTicketAgentToken()
	if err != nil {
		return nil, "", err
	}
	expiresAt := time.Now().Add(ticketAgentSessionTTL).Unix()
	session := &TicketAgentSession{
		AgentId:    agent.Id,
		TokenHash:  ticketAgentTokenHash(token),
		Ip:         ip,
		UserAgent:  truncateTicketAgentText(userAgent, 255),
		CreatedAt:  now,
		ExpiresAt:  expiresAt,
		LastSeenAt: now,
	}
	if err := DB.Create(session).Error; err != nil {
		return nil, "", err
	}
	if err := DB.Model(&TicketAgent{}).Where("id = ?", agent.Id).Updates(map[string]any{
		"last_login_at": now,
		"last_login_ip": truncateTicketAgentText(ip, 64),
		"failed_login":  0,
		"locked_until":  0,
	}).Error; err != nil {
		return nil, "", err
	}

	agent.LastLoginAt = now
	agent.LastLoginIp = ip
	agent.FailedLogin = 0
	agent.LockedUntil = 0
	return &agent, token, nil
}

func recordTicketAgentLoginFailure(agent *TicketAgent, now int64) {
	failures := agent.FailedLogin + 1
	updates := map[string]any{"failed_login": failures}
	if failures >= ticketAgentMaxFailures {
		updates["locked_until"] = now + int64(ticketAgentLockDuration/time.Second)
		updates["failed_login"] = 0
	}
	_ = DB.Model(&TicketAgent{}).Where("id = ?", agent.Id).Updates(updates).Error
}

func newTicketAgentToken() (string, error) {
	buffer := make([]byte, ticketAgentTokenBytes)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}

func truncateTicketAgentText(value string, limit int) string {
	if utf8.RuneCountInString(value) <= limit {
		return value
	}
	return string([]rune(value)[:limit])
}

// AuthenticateTicketAgentToken 用会话 token 换回账号
func AuthenticateTicketAgentToken(token string) (*TicketAgent, error) {
	trimmed := strings.TrimSpace(token)
	if trimmed == "" {
		return nil, newTicketError(TicketCodeAgentSession, "Sign in to continue")
	}

	var session TicketAgentSession
	err := DB.Where("token_hash = ?", ticketAgentTokenHash(trimmed)).First(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, newTicketError(TicketCodeAgentSession, "Sign in to continue")
	}
	if err != nil {
		return nil, err
	}

	now := common.GetTimestamp()
	if session.ExpiresAt <= now {
		_ = DB.Delete(&TicketAgentSession{}, session.Id).Error
		return nil, newTicketError(TicketCodeAgentSession, "Your session expired. Sign in again.")
	}

	agent, err := GetTicketAgent(session.AgentId)
	if err != nil {
		return nil, err
	}
	if !agent.Enabled {
		return nil, newTicketError(TicketCodeAgentDisabled, "This account is disabled")
	}

	// 一分钟内不重复写 last_seen_at，避免每个请求都产生一次写操作
	if now-session.LastSeenAt > 60 {
		_ = DB.Model(&TicketAgentSession{}).Where("id = ?", session.Id).
			Update("last_seen_at", now).Error
	}
	return agent, nil
}

// RevokeTicketAgentSession 退出登录
func RevokeTicketAgentSession(token string) error {
	trimmed := strings.TrimSpace(token)
	if trimmed == "" {
		return nil
	}
	return DB.Where("token_hash = ?", ticketAgentTokenHash(trimmed)).
		Delete(&TicketAgentSession{}).Error
}

// RevokeTicketAgentSessions 踢掉某个账号的全部会话
func RevokeTicketAgentSessions(agentId int) error {
	return DB.Where("agent_id = ?", agentId).Delete(&TicketAgentSession{}).Error
}

// CleanupExpiredTicketAgentSessions 清理过期会话
func CleanupExpiredTicketAgentSessions() error {
	return DB.Where("expires_at <= ?", common.GetTimestamp()).
		Delete(&TicketAgentSession{}).Error
}

// TicketAgentAuditText 用于日志的账号描述，不含任何凭据
func TicketAgentAuditText(agent *TicketAgent) string {
	if agent == nil {
		return "unknown"
	}
	return fmt.Sprintf("ticket agent %q (id=%d)", agent.Username, agent.Id)
}
