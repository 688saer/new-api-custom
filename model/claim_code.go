package model

import (
	"crypto/rand"
	"errors"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 口令兑换：后台生成口令，用户输入口令领取实物奖品、虚拟产品、余额或订阅
// ---------------------------------------------------------------------------

// 口令可兑换的奖品类型
const (
	ClaimCodeTypeQuota        = "quota"        // 本站余额
	ClaimCodeTypeSubscription = "subscription" // 订阅套餐
	ClaimCodeTypeCardKey      = "card_key"     // 虚拟产品（后台预置卡密池）
	ClaimCodeTypePhysical     = "physical"     // 实物奖品，需要收货信息
)

// 口令状态
const (
	ClaimCodeStatusEnabled  = 1 // 可领取
	ClaimCodeStatusDisabled = 2 // 已停用
)

// 领取记录状态
const (
	ClaimCodeClaimStatusDelivered = "delivered" // 已发放
	ClaimCodeClaimStatusPending   = "pending"   // 实物：等待填写收货信息
	ClaimCodeClaimStatusReady     = "ready"     // 实物：已填收货信息，等待发货
	ClaimCodeClaimStatusShipped   = "shipped"   // 实物：已发货
	ClaimCodeClaimStatusCancelled = "cancelled" // 已作废
)

// 卡密池状态
const (
	ClaimCodeCardStatusAvailable = "available"
	ClaimCodeCardStatusUsed      = "used"
)

const (
	// ClaimCodeBatchLimit 单次最多生成多少条口令
	ClaimCodeBatchLimit = 200
	// ClaimCodeCountLimit 单条口令最多可被领取的次数
	ClaimCodeCountLimit = 1000000
	// ClaimCodePerUserLimit 单个用户最多可领取的次数上限
	ClaimCodePerUserLimit = 1000
	// ClaimCodeCardBatchLimit 单次最多导入多少条卡密
	ClaimCodeCardBatchLimit = 5000
	// ClaimCodeValueLengthLimit 自定义口令的最大字符数，与 code 列的 varchar(64) 一致
	ClaimCodeValueLengthLimit = 64
)

// 口令字符集：去掉容易混淆的 0/O/1/I，只保留大写字母与数字
const claimCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// claimCodeLength 口令随机部分长度，32^12 足够避免碰撞
const claimCodeLength = 12

// ClaimCode 一条口令（同一次可以生成多条，各自独立计数）
type ClaimCode struct {
	Id     int    `json:"id" gorm:"primaryKey;autoIncrement"`
	Code   string `json:"code" gorm:"type:varchar(64);not null;uniqueIndex"`
	Name   string `json:"name" gorm:"type:varchar(64);not null;default:''"`
	Type   string `json:"type" gorm:"type:varchar(32);not null;default:'quota';index"`
	Status int    `json:"status" gorm:"not null;default:1;index"`

	// Quota 余额类型的额度面额
	Quota int `json:"quota" gorm:"not null;default:0"`
	// PlanId / PlanTitle 订阅类型的套餐
	PlanId    int    `json:"plan_id" gorm:"not null;default:0"`
	PlanTitle string `json:"plan_title" gorm:"type:varchar(128);not null;default:''"`
	// Description 兑换说明，实物可写领取须知，虚拟产品可写使用方法
	Description string `json:"description" gorm:"type:varchar(500);not null;default:''"`

	// TotalCount 最多可领取次数，0 表示不限次数
	TotalCount int `json:"total_count" gorm:"not null;default:1"`
	// UsedCount 已领取次数
	UsedCount int `json:"used_count" gorm:"not null;default:0"`
	// PerUserLimit 每个用户最多领取次数，0 表示不限
	PerUserLimit int `json:"per_user_limit" gorm:"not null;default:1"`
	// GroupLimit 允许领取的用户分组，逗号分隔，空表示不限
	GroupLimit string `json:"group_limit" gorm:"type:varchar(255);not null;default:''"`
	// ExpiredTime 过期时间戳，0 表示不过期
	ExpiredTime int64 `json:"expired_time" gorm:"bigint;not null;default:0"`

	CreatedBy int   `json:"created_by" gorm:"not null;default:0"`
	CreatedAt int64 `json:"created_at" gorm:"bigint;index"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (ClaimCode) TableName() string {
	return "claim_codes"
}

// ClaimCodeCard 虚拟产品的卡密池
type ClaimCodeCard struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ClaimCodeId int    `json:"claim_code_id" gorm:"not null;index"`
	Content     string `json:"content" gorm:"type:varchar(500);not null;default:''"`
	Status      string `json:"status" gorm:"type:varchar(16);not null;default:'available';index"`
	UserId      int    `json:"user_id" gorm:"not null;default:0"`
	UsedAt      int64  `json:"used_at" gorm:"bigint;not null;default:0"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
}

func (ClaimCodeCard) TableName() string {
	return "claim_code_cards"
}

// ClaimCodeClaim 领取记录，口令与奖品字段都做了快照
type ClaimCodeClaim struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ClaimCodeId int    `json:"claim_code_id" gorm:"not null;index"`
	Code        string `json:"code" gorm:"type:varchar(64);not null;default:''"`
	Name        string `json:"name" gorm:"type:varchar(64);not null;default:''"`
	Type        string `json:"type" gorm:"type:varchar(32);not null;default:'quota';index"`

	UserId   int    `json:"user_id" gorm:"not null;index"`
	Username string `json:"username" gorm:"type:varchar(64);not null;default:''"`

	Quota        int    `json:"quota" gorm:"not null;default:0"`
	PlanId       int    `json:"plan_id" gorm:"not null;default:0"`
	PlanTitle    string `json:"plan_title" gorm:"type:varchar(128);not null;default:''"`
	CardContent  string `json:"card_content" gorm:"type:varchar(500);not null;default:''"`
	Description  string `json:"description" gorm:"type:varchar(500);not null;default:''"`
	Subscription int    `json:"subscription_id" gorm:"not null;default:0"`

	Status          string `json:"status" gorm:"type:varchar(16);not null;default:'delivered';index"`
	ReceiverName    string `json:"receiver_name" gorm:"type:varchar(64);not null;default:''"`
	ReceiverPhone   string `json:"receiver_phone" gorm:"type:varchar(32);not null;default:''"`
	ReceiverAddress string `json:"receiver_address" gorm:"type:varchar(255);not null;default:''"`
	TrackingNo      string `json:"tracking_no" gorm:"type:varchar(64);not null;default:''"`
	Note            string `json:"note" gorm:"type:varchar(255);not null;default:''"`

	CreatedAt   int64 `json:"created_at" gorm:"bigint;index"`
	UpdatedAt   int64 `json:"updated_at" gorm:"bigint;not null;default:0"`
	ShippedAt   int64 `json:"shipped_at" gorm:"bigint;not null;default:0"`
	DeliveredAt int64 `json:"delivered_at" gorm:"bigint;not null;default:0"`
}

func (ClaimCodeClaim) TableName() string {
	return "claim_code_claims"
}

// normalizeClaimCode 收敛用户输入：去掉首尾空白并统一大写。口令可以是汉字、
// 字母或数字，统一大写只影响拉丁字母，因此自定义口令同样不区分大小写。
func normalizeClaimCode(raw string) string {
	return strings.ToUpper(strings.TrimSpace(raw))
}

// normalizeCustomClaimCode 收敛并校验后台手工填写的口令值
func normalizeCustomClaimCode(raw string) (string, error) {
	value := normalizeClaimCode(raw)
	if value == "" {
		return "", common.NewMessage("Claim code value cannot be empty")
	}
	if len([]rune(value)) > ClaimCodeValueLengthLimit {
		return "", common.NewMessage("Claim code value must be at most 64 characters")
	}
	for _, char := range value {
		if char < 0x20 || char == 0x7f {
			return "", common.NewMessage("Claim code value cannot contain control characters")
		}
	}
	return value, nil
}

// claimCodeGroups 解析允许领取的分组列表
func claimCodeGroups(limit string) []string {
	groups := make([]string, 0, 4)
	for group := range strings.SplitSeq(limit, ",") {
		group = strings.TrimSpace(group)
		if group != "" {
			groups = append(groups, group)
		}
	}
	return groups
}

// generateClaimCode 生成一条随机口令，形如 XXXX-XXXX-XXXX
func generateClaimCode() (string, error) {
	buf := make([]byte, claimCodeLength)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	var builder strings.Builder
	builder.Grow(claimCodeLength + claimCodeLength/4)
	for i, value := range buf {
		if i > 0 && i%4 == 0 {
			builder.WriteByte('-')
		}
		// 字符集长度是 32，正好整除 256，取模不会引入偏差
		builder.WriteByte(claimCodeChars[int(value)%len(claimCodeChars)])
	}
	return builder.String(), nil
}

// NormalizeClaimCode 收敛并校验口令配置
func NormalizeClaimCode(code *ClaimCode) error {
	code.Name = strings.TrimSpace(code.Name)
	code.Description = strings.TrimSpace(code.Description)
	code.GroupLimit = strings.TrimSpace(code.GroupLimit)

	if code.Name == "" {
		return common.NewMessage("Claim code name cannot be empty")
	}
	if len([]rune(code.Name)) > 64 {
		return common.NewMessage("Claim code name must be at most 64 characters")
	}
	if len([]rune(code.Description)) > 500 {
		return common.NewMessage("Claim code description is too long")
	}
	if code.TotalCount < 0 || code.TotalCount > ClaimCodeCountLimit {
		return common.NewMessage("Claim count must be between 0 and 1000000")
	}
	if code.PerUserLimit < 0 || code.PerUserLimit > ClaimCodePerUserLimit {
		return common.NewMessage("Per-user claim limit must be between 0 and 1000")
	}
	if code.ExpiredTime < 0 {
		return common.NewMessage("Expiry time cannot be negative")
	}
	groups := claimCodeGroups(code.GroupLimit)
	for _, group := range groups {
		if len([]rune(group)) > 64 {
			return common.NewMessage("Group name is too long")
		}
	}
	code.GroupLimit = strings.Join(groups, ",")

	switch code.Type {
	case ClaimCodeTypeQuota:
		if code.Quota <= 0 {
			return common.NewMessage("Quota amount must be greater than zero")
		}
		if err := common.ValidateWalletQuota(code.Quota); err != nil {
			return err
		}
		code.PlanId = 0
		code.PlanTitle = ""
	case ClaimCodeTypeSubscription:
		if code.PlanId <= 0 {
			return common.NewMessage("Select a subscription plan")
		}
		plan, err := GetSubscriptionPlanById(code.PlanId)
		if err != nil {
			return common.NewMessage("Subscription plan not found")
		}
		code.PlanTitle = plan.Title
		code.Quota = 0
	case ClaimCodeTypeCardKey:
		code.Quota = 0
		code.PlanId = 0
		code.PlanTitle = ""
	case ClaimCodeTypePhysical:
		code.Quota = 0
		code.PlanId = 0
		code.PlanTitle = ""
	default:
		return common.NewMessage("Unsupported claim code type")
	}
	return nil
}

// CreateClaimCodes 按同一份配置生成 count 条独立口令；code.Code 非空表示后台
// 自定义了口令值，此时只能生成一条，否则会出现重复口令。
func CreateClaimCodes(code ClaimCode, count int) ([]ClaimCode, error) {
	custom := strings.TrimSpace(code.Code)
	if custom != "" {
		value, err := normalizeCustomClaimCode(custom)
		if err != nil {
			return nil, err
		}
		code.Code = value
		if count > 1 {
			return nil, common.NewMessage("A custom claim code can only be created once at a time")
		}
		count = 1
	} else {
		code.Code = ""
	}
	if err := NormalizeClaimCode(&code); err != nil {
		return nil, err
	}
	if count < 1 || count > ClaimCodeBatchLimit {
		return nil, common.NewMessage("Generate between 1 and 200 claim codes at a time")
	}

	now := common.GetTimestamp()
	created := make([]ClaimCode, 0, count)
	for range count {
		item := code
		item.Status = ClaimCodeStatusEnabled
		item.UsedCount = 0
		item.CreatedAt = now
		item.UpdatedAt = now
		if item.Code != "" {
			item.Id = 0
			if err := item.createWithCustomCode(); err != nil {
				return created, err
			}
			created = append(created, item)
			continue
		}
		if err := item.createWithGeneratedCode(); err != nil {
			return created, err
		}
		created = append(created, item)
	}
	return created, nil
}

// createWithCustomCode 用后台填写的口令值入库，重复时直接报错而不是悄悄改写
func (code *ClaimCode) createWithCustomCode() error {
	err := DB.Create(code).Error
	if err == nil {
		return nil
	}
	if isDuplicateKeyError(err) {
		return common.NewMessage("This claim code already exists")
	}
	return err
}

// isDuplicateKeyError 判断是否撞上了唯一索引
func isDuplicateKeyError(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "unique") || strings.Contains(message, "duplicate")
}

// createWithGeneratedCode 生成随机口令并入库；撞上已有口令时重新生成
func (code *ClaimCode) createWithGeneratedCode() error {
	for range 5 {
		value, err := generateClaimCode()
		if err != nil {
			return err
		}
		code.Code = value
		err = DB.Create(code).Error
		if err == nil {
			return nil
		}
		if !isDuplicateKeyError(err) {
			return err
		}
		code.Id = 0
	}
	return common.NewMessage("Failed to generate a unique claim code, please retry")
}

// UpdateClaimCode 更新口令配置；口令值只有在还没有人领取时才能改，
// 已领取的口令保留原值，避免用户手上的口令突然失效。
func UpdateClaimCode(id int, patch ClaimCode) (*ClaimCode, error) {
	if id <= 0 {
		return nil, common.NewMessage("Invalid claim code ID")
	}
	existing := &ClaimCode{}
	if err := DB.First(existing, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, common.NewMessage("Claim code not found")
		}
		return nil, err
	}

	codeChanged := false
	if custom := strings.TrimSpace(patch.Code); custom != "" {
		value, err := normalizeCustomClaimCode(custom)
		if err != nil {
			return nil, err
		}
		if value != existing.Code {
			if existing.UsedCount > 0 {
				return nil, common.NewMessage("A claimed code cannot change its value")
			}
			existing.Code = value
			codeChanged = true
		}
	}

	existing.Name = patch.Name
	existing.Type = patch.Type
	existing.Description = patch.Description
	existing.TotalCount = patch.TotalCount
	existing.PerUserLimit = patch.PerUserLimit
	existing.GroupLimit = patch.GroupLimit
	existing.ExpiredTime = patch.ExpiredTime
	existing.Quota = patch.Quota
	existing.PlanId = patch.PlanId
	if existing.Type != ClaimCodeTypeSubscription {
		existing.PlanTitle = ""
	}
	if patch.Status == ClaimCodeStatusDisabled {
		existing.Status = ClaimCodeStatusDisabled
	} else {
		existing.Status = ClaimCodeStatusEnabled
	}
	if err := NormalizeClaimCode(existing); err != nil {
		return nil, err
	}
	if existing.TotalCount > 0 && existing.UsedCount > existing.TotalCount {
		return nil, common.NewMessage("Claim count cannot be less than the number of claims already made")
	}

	existing.UpdatedAt = common.GetTimestamp()
	updates := map[string]any{
		"name":           existing.Name,
		"type":           existing.Type,
		"description":    existing.Description,
		"total_count":    existing.TotalCount,
		"per_user_limit": existing.PerUserLimit,
		"group_limit":    existing.GroupLimit,
		"expired_time":   existing.ExpiredTime,
		"quota":          existing.Quota,
		"plan_id":        existing.PlanId,
		"plan_title":     existing.PlanTitle,
		"status":         existing.Status,
		"updated_at":     existing.UpdatedAt,
	}
	if codeChanged {
		updates["code"] = existing.Code
	}
	if err := DB.Model(&ClaimCode{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		if isDuplicateKeyError(err) {
			return nil, common.NewMessage("This claim code already exists")
		}
		return nil, err
	}
	return existing, nil
}

// DeleteClaimCode 删除口令；有领取记录时改为停用，避免记录失去归属
func DeleteClaimCode(id int) error {
	if id <= 0 {
		return common.NewMessage("Invalid claim code ID")
	}
	var claims int64
	if err := DB.Model(&ClaimCodeClaim{}).Where("claim_code_id = ?", id).Count(&claims).Error; err != nil {
		return err
	}
	if claims > 0 {
		return DB.Model(&ClaimCode{}).Where("id = ?", id).
			Updates(map[string]any{
				"status":     ClaimCodeStatusDisabled,
				"updated_at": common.GetTimestamp(),
			}).Error
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("claim_code_id = ?", id).Delete(&ClaimCodeCard{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", id).Delete(&ClaimCode{}).Error
	})
}

// ClaimCodeFilter 后台口令列表筛选条件
type ClaimCodeFilter struct {
	Keyword  string
	Type     string
	Status   int
	Page     int
	PageSize int
}

// ClaimCodeView 后台口令列表项
type ClaimCodeView struct {
	ClaimCode
	// RemainingCount 剩余可领取次数，-1 表示不限
	RemainingCount int    `json:"remaining_count"`
	AvailableCards int64  `json:"available_cards"`
	ClaimedUsers   int64  `json:"claimed_users"`
	Expired        bool   `json:"expired"`
	QuotaDisplay   string `json:"quota_display"`
}

// ListClaimCodes 分页列出后台口令
func ListClaimCodes(filter ClaimCodeFilter) ([]ClaimCodeView, int64, error) {
	page, pageSize := normalizeClaimCodePage(filter.Page, filter.PageSize)

	query := DB.Model(&ClaimCode{})
	keyword := strings.TrimSpace(filter.Keyword)
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("code LIKE ? OR name LIKE ?", like, like)
	}
	switch filter.Type {
	case ClaimCodeTypeQuota, ClaimCodeTypeSubscription, ClaimCodeTypeCardKey, ClaimCodeTypePhysical:
		query = query.Where("type = ?", filter.Type)
	}
	if filter.Status == ClaimCodeStatusEnabled || filter.Status == ClaimCodeStatusDisabled {
		query = query.Where("status = ?", filter.Status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	codes := make([]ClaimCode, 0)
	if err := query.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&codes).Error; err != nil {
		return nil, 0, err
	}
	return buildClaimCodeViews(codes), total, nil
}

// buildClaimCodeViews 补齐口令列表的统计字段
func buildClaimCodeViews(codes []ClaimCode) []ClaimCodeView {
	views := make([]ClaimCodeView, 0, len(codes))
	if len(codes) == 0 {
		return views
	}

	now := common.GetTimestamp()
	cardCodes := make([]int, 0, len(codes))
	for _, code := range codes {
		if code.Type == ClaimCodeTypeCardKey {
			cardCodes = append(cardCodes, code.Id)
		}
	}

	availableCards := map[int]int64{}
	if len(cardCodes) > 0 {
		type cardCount struct {
			ClaimCodeId int
			Total       int64
		}
		counts := make([]cardCount, 0, len(cardCodes))
		if err := DB.Model(&ClaimCodeCard{}).
			Select("claim_code_id, COUNT(*) AS total").
			Where("claim_code_id IN ? AND status = ?", cardCodes, ClaimCodeCardStatusAvailable).
			Group("claim_code_id").
			Scan(&counts).Error; err == nil {
			for _, item := range counts {
				availableCards[item.ClaimCodeId] = item.Total
			}
		}
	}

	claimedUsers := map[int]int64{}
	ids := make([]int, 0, len(codes))
	for _, code := range codes {
		ids = append(ids, code.Id)
	}
	type userCount struct {
		ClaimCodeId int
		Total       int64
	}
	userCounts := make([]userCount, 0, len(codes))
	if err := DB.Model(&ClaimCodeClaim{}).
		Select("claim_code_id, COUNT(DISTINCT user_id) AS total").
		Where("claim_code_id IN ? AND status <> ?", ids, ClaimCodeClaimStatusCancelled).
		Group("claim_code_id").
		Scan(&userCounts).Error; err == nil {
		for _, item := range userCounts {
			claimedUsers[item.ClaimCodeId] = item.Total
		}
	}

	for _, code := range codes {
		remaining := -1
		if code.TotalCount > 0 {
			remaining = max(code.TotalCount-code.UsedCount, 0)
		}
		views = append(views, ClaimCodeView{
			ClaimCode:      code,
			RemainingCount: remaining,
			AvailableCards: availableCards[code.Id],
			ClaimedUsers:   claimedUsers[code.Id],
			Expired:        code.ExpiredTime != 0 && code.ExpiredTime < now,
			QuotaDisplay:   logger.FormatQuota(code.Quota),
		})
	}
	return views
}

// GetClaimCodeById 按 ID 查口令
func GetClaimCodeById(id int) (*ClaimCode, error) {
	if id <= 0 {
		return nil, common.NewMessage("Invalid claim code ID")
	}
	code := &ClaimCode{}
	if err := DB.First(code, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, common.NewMessage("Claim code not found")
		}
		return nil, err
	}
	return code, nil
}

// normalizeClaimCodePage 收敛分页参数
func normalizeClaimCodePage(page int, pageSize int) (int, int) {
	page = max(page, 1)
	if pageSize < 1 {
		pageSize = 20
	}
	return page, min(pageSize, 100)
}

// ListClaimCodeCards 分页列出某条口令的卡密
func ListClaimCodeCards(claimCodeId int, status string, page int, pageSize int) ([]ClaimCodeCard, int64, error) {
	if _, err := GetClaimCodeById(claimCodeId); err != nil {
		return nil, 0, err
	}
	page, pageSize = normalizeClaimCodePage(page, pageSize)

	query := DB.Model(&ClaimCodeCard{}).Where("claim_code_id = ?", claimCodeId)
	if status == ClaimCodeCardStatusAvailable || status == ClaimCodeCardStatusUsed {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	cards := make([]ClaimCodeCard, 0)
	if err := query.Order("id asc").Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&cards).Error; err != nil {
		return nil, 0, err
	}
	return cards, total, nil
}

// AddClaimCodeCards 往卡密池里导入卡密，按行拆分并跳过重复
func AddClaimCodeCards(claimCodeId int, raw string) (int, error) {
	code, err := GetClaimCodeById(claimCodeId)
	if err != nil {
		return 0, err
	}
	if code.Type != ClaimCodeTypeCardKey {
		return 0, common.NewMessage("This claim code does not use a card key pool")
	}

	contents := make([]string, 0, 64)
	seen := make(map[string]struct{}, 64)
	for line := range strings.SplitSeq(raw, "\n") {
		content := strings.TrimSpace(line)
		if content == "" {
			continue
		}
		if len([]rune(content)) > 500 {
			return 0, common.NewMessage("Card key must be at most 500 characters")
		}
		if _, ok := seen[content]; ok {
			continue
		}
		seen[content] = struct{}{}
		contents = append(contents, content)
	}
	if len(contents) == 0 {
		return 0, common.NewMessage("Paste at least one card key")
	}
	if len(contents) > ClaimCodeCardBatchLimit {
		return 0, common.NewMessage("Import at most 5000 card keys at a time")
	}

	// 已经存在的卡密直接跳过，重复导入不会产生重复库存
	existing := make([]string, 0, len(contents))
	if err := DB.Model(&ClaimCodeCard{}).
		Where("claim_code_id = ? AND content IN ?", claimCodeId, contents).
		Pluck("content", &existing).Error; err != nil {
		return 0, err
	}
	exists := make(map[string]struct{}, len(existing))
	for _, content := range existing {
		exists[content] = struct{}{}
	}

	now := common.GetTimestamp()
	cards := make([]ClaimCodeCard, 0, len(contents))
	for _, content := range contents {
		if _, ok := exists[content]; ok {
			continue
		}
		cards = append(cards, ClaimCodeCard{
			ClaimCodeId: claimCodeId,
			Content:     content,
			Status:      ClaimCodeCardStatusAvailable,
			CreatedAt:   now,
		})
	}
	if len(cards) == 0 {
		return 0, nil
	}
	if err := DB.Create(&cards).Error; err != nil {
		return 0, err
	}
	return len(cards), nil
}

// DeleteClaimCodeCard 删除未使用的卡密，已发放的卡密不允许删除
func DeleteClaimCodeCard(claimCodeId int, cardId int) error {
	card := &ClaimCodeCard{}
	if err := DB.First(card, "id = ? AND claim_code_id = ?", cardId, claimCodeId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return common.NewMessage("Card key not found")
		}
		return err
	}
	if card.Status == ClaimCodeCardStatusUsed {
		return common.NewMessage("Card keys already claimed cannot be deleted")
	}
	return DB.Delete(&ClaimCodeCard{}, card.Id).Error
}

// ClaimCodeClaimView 领取记录展示项
type ClaimCodeClaimView struct {
	Id              int    `json:"id"`
	ClaimCodeId     int    `json:"claim_code_id"`
	Code            string `json:"code"`
	Name            string `json:"name"`
	Type            string `json:"type"`
	Status          string `json:"status"`
	Description     string `json:"description"`
	UserId          int    `json:"user_id"`
	Username        string `json:"username"`
	Quota           int    `json:"quota"`
	QuotaDisplay    string `json:"quota_display"`
	PlanId          int    `json:"plan_id"`
	PlanTitle       string `json:"plan_title"`
	CardContent     string `json:"card_content"`
	SubscriptionId  int    `json:"subscription_id"`
	ReceiverName    string `json:"receiver_name"`
	ReceiverPhone   string `json:"receiver_phone"`
	ReceiverAddress string `json:"receiver_address"`
	TrackingNo      string `json:"tracking_no"`
	Note            string `json:"note"`
	NeedAddress     bool   `json:"need_address"`
	CreatedAt       int64  `json:"created_at"`
	UpdatedAt       int64  `json:"updated_at"`
	ShippedAt       int64  `json:"shipped_at"`
	DeliveredAt     int64  `json:"delivered_at"`
}

// buildClaimCodeClaimView 把领取记录转成展示项
func buildClaimCodeClaimView(claim ClaimCodeClaim) ClaimCodeClaimView {
	return ClaimCodeClaimView{
		Id:              claim.Id,
		ClaimCodeId:     claim.ClaimCodeId,
		Code:            claim.Code,
		Name:            claim.Name,
		Type:            claim.Type,
		Status:          claim.Status,
		Description:     claim.Description,
		UserId:          claim.UserId,
		Username:        claim.Username,
		Quota:           claim.Quota,
		QuotaDisplay:    logger.FormatQuota(claim.Quota),
		PlanId:          claim.PlanId,
		PlanTitle:       claim.PlanTitle,
		CardContent:     claim.CardContent,
		SubscriptionId:  claim.Subscription,
		ReceiverName:    claim.ReceiverName,
		ReceiverPhone:   claim.ReceiverPhone,
		ReceiverAddress: claim.ReceiverAddress,
		TrackingNo:      claim.TrackingNo,
		Note:            claim.Note,
		NeedAddress:     claim.Type == ClaimCodeTypePhysical && claim.ReceiverAddress == "",
		CreatedAt:       claim.CreatedAt,
		UpdatedAt:       claim.UpdatedAt,
		ShippedAt:       claim.ShippedAt,
		DeliveredAt:     claim.DeliveredAt,
	}
}

// RedeemClaimCode 用户输入口令领取奖品
func RedeemClaimCode(userId int, rawCode string) (*ClaimCodeClaimView, error) {
	code := normalizeClaimCode(rawCode)
	if code == "" {
		return nil, common.NewMessage("Enter a claim code")
	}
	if len([]rune(code)) > 64 {
		return nil, common.NewMessage("Claim code not found")
	}
	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, common.NewMessage("User not found")
	}

	var claim ClaimCodeClaim
	err = DB.Transaction(func(tx *gorm.DB) error {
		record := &ClaimCode{}
		if err := lockForUpdate(tx).Where("code = ?", code).First(record).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return common.NewMessage("Claim code not found")
			}
			return err
		}
		if record.Status != ClaimCodeStatusEnabled {
			return common.NewMessage("This claim code has been disabled")
		}
		now := common.GetTimestamp()
		if record.ExpiredTime != 0 && record.ExpiredTime < now {
			return common.NewMessage("This claim code has expired")
		}
		if record.GroupLimit != "" && !slices.Contains(claimCodeGroups(record.GroupLimit), user.Group) {
			return common.NewMessage("This claim code is not available for your account group")
		}
		if record.PerUserLimit > 0 {
			var mine int64
			if err := tx.Model(&ClaimCodeClaim{}).
				Where("claim_code_id = ? AND user_id = ? AND status <> ?", record.Id, userId, ClaimCodeClaimStatusCancelled).
				Count(&mine).Error; err != nil {
				return err
			}
			if mine >= int64(record.PerUserLimit) {
				return common.NewMessage("You have reached the claim limit for this code")
			}
		}

		// 条件更新保证并发下不会超发
		update := tx.Model(&ClaimCode{}).Where("id = ? AND status = ?", record.Id, ClaimCodeStatusEnabled)
		if record.TotalCount > 0 {
			update = update.Where("used_count < ?", record.TotalCount)
		}
		res := update.Updates(map[string]any{
			"used_count": gorm.Expr("used_count + 1"),
			"updated_at": now,
		})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return common.NewMessage("This claim code has been fully claimed")
		}

		claim = ClaimCodeClaim{
			ClaimCodeId: record.Id,
			Code:        record.Code,
			Name:        record.Name,
			Type:        record.Type,
			Description: record.Description,
			UserId:      userId,
			Username:    user.Username,
			Status:      ClaimCodeClaimStatusDelivered,
			CreatedAt:   now,
			UpdatedAt:   now,
		}

		switch record.Type {
		case ClaimCodeTypeQuota:
			if err := creditTopUpQuota(tx, userId, record.Quota, nil); err != nil {
				return err
			}
			claim.Quota = record.Quota
			claim.DeliveredAt = now
		case ClaimCodeTypeSubscription:
			plan, err := getSubscriptionPlanByIdTx(tx, record.PlanId)
			if err != nil {
				return common.NewMessage("Subscription plan not found")
			}
			subscription, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "claim_code")
			if err != nil {
				return err
			}
			claim.PlanId = plan.Id
			claim.PlanTitle = plan.Title
			claim.Subscription = subscription.Id
			claim.DeliveredAt = now
		case ClaimCodeTypeCardKey:
			card := &ClaimCodeCard{}
			if err := lockForUpdate(tx).
				Where("claim_code_id = ? AND status = ?", record.Id, ClaimCodeCardStatusAvailable).
				Order("id asc").First(card).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return common.NewMessage("This claim code has no card keys left")
				}
				return err
			}
			taken := tx.Model(&ClaimCodeCard{}).
				Where("id = ? AND status = ?", card.Id, ClaimCodeCardStatusAvailable).
				Updates(map[string]any{
					"status":  ClaimCodeCardStatusUsed,
					"user_id": userId,
					"used_at": now,
				})
			if taken.Error != nil {
				return taken.Error
			}
			if taken.RowsAffected == 0 {
				return common.NewMessage("This claim code has no card keys left")
			}
			claim.CardContent = card.Content
			claim.DeliveredAt = now
		case ClaimCodeTypePhysical:
			claim.Status = ClaimCodeClaimStatusPending
		default:
			return common.NewMessage("Unsupported claim code type")
		}

		return tx.Create(&claim).Error
	})
	if err != nil {
		return nil, err
	}

	if claim.Type == ClaimCodeTypeQuota {
		syncCreditUserQuotaCache(userId, claim.Quota, common.LogText("claim code"))
	}
	view := buildClaimCodeClaimView(claim)
	return &view, nil
}

// ListMyClaimCodeClaims 我的领取记录
func ListMyClaimCodeClaims(userId int, page int, pageSize int) ([]ClaimCodeClaimView, int64, error) {
	page, pageSize = normalizeClaimCodePage(page, pageSize)

	query := DB.Model(&ClaimCodeClaim{}).Where("user_id = ?", userId)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	claims := make([]ClaimCodeClaim, 0)
	if err := query.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&claims).Error; err != nil {
		return nil, 0, err
	}
	views := make([]ClaimCodeClaimView, 0, len(claims))
	for _, claim := range claims {
		views = append(views, buildClaimCodeClaimView(claim))
	}
	return views, total, nil
}

// ClaimCodeClaimFilter 后台领取记录筛选条件
type ClaimCodeClaimFilter struct {
	Keyword     string
	Type        string
	Status      string
	ClaimCodeId int
	Page        int
	PageSize    int
}

// ListClaimCodeClaims 后台分页列出领取记录
func ListClaimCodeClaims(filter ClaimCodeClaimFilter) ([]ClaimCodeClaimView, int64, error) {
	page, pageSize := normalizeClaimCodePage(filter.Page, filter.PageSize)

	query := DB.Model(&ClaimCodeClaim{})
	keyword := strings.TrimSpace(filter.Keyword)
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("username LIKE ? OR code LIKE ? OR name LIKE ?", like, like, like)
	}
	switch filter.Type {
	case ClaimCodeTypeQuota, ClaimCodeTypeSubscription, ClaimCodeTypeCardKey, ClaimCodeTypePhysical:
		query = query.Where("type = ?", filter.Type)
	}
	switch filter.Status {
	case ClaimCodeClaimStatusDelivered, ClaimCodeClaimStatusPending, ClaimCodeClaimStatusReady,
		ClaimCodeClaimStatusShipped, ClaimCodeClaimStatusCancelled:
		query = query.Where("status = ?", filter.Status)
	}
	if filter.ClaimCodeId > 0 {
		query = query.Where("claim_code_id = ?", filter.ClaimCodeId)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	claims := make([]ClaimCodeClaim, 0)
	if err := query.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&claims).Error; err != nil {
		return nil, 0, err
	}
	views := make([]ClaimCodeClaimView, 0, len(claims))
	for _, claim := range claims {
		views = append(views, buildClaimCodeClaimView(claim))
	}
	return views, total, nil
}

// SubmitClaimCodeAddress 用户填写实物收货信息
func SubmitClaimCodeAddress(userId int, claimId int, receiverName string, receiverPhone string, receiverAddress string) (*ClaimCodeClaimView, error) {
	receiverName = strings.TrimSpace(receiverName)
	receiverPhone = strings.TrimSpace(receiverPhone)
	receiverAddress = strings.TrimSpace(receiverAddress)
	if receiverName == "" || receiverPhone == "" || receiverAddress == "" {
		return nil, common.NewMessage("Fill in the recipient name, phone number and address")
	}
	if len([]rune(receiverName)) > 64 || len([]rune(receiverPhone)) > 32 || len([]rune(receiverAddress)) > 255 {
		return nil, common.NewMessage("Shipping information is too long")
	}

	claim := &ClaimCodeClaim{}
	if err := DB.First(claim, "id = ? AND user_id = ?", claimId, userId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, common.NewMessage("Claim record not found")
		}
		return nil, err
	}
	if claim.Type != ClaimCodeTypePhysical {
		return nil, common.NewMessage("This claim does not need a shipping address")
	}
	if claim.Status == ClaimCodeClaimStatusShipped {
		return nil, common.NewMessage("This claim has already been shipped")
	}
	if claim.Status == ClaimCodeClaimStatusCancelled {
		return nil, common.NewMessage("This claim has been cancelled")
	}

	now := common.GetTimestamp()
	if err := DB.Model(&ClaimCodeClaim{}).Where("id = ?", claim.Id).Updates(map[string]any{
		"receiver_name":    receiverName,
		"receiver_phone":   receiverPhone,
		"receiver_address": receiverAddress,
		"status":           ClaimCodeClaimStatusReady,
		"updated_at":       now,
	}).Error; err != nil {
		return nil, err
	}
	claim.ReceiverName = receiverName
	claim.ReceiverPhone = receiverPhone
	claim.ReceiverAddress = receiverAddress
	claim.Status = ClaimCodeClaimStatusReady
	claim.UpdatedAt = now
	view := buildClaimCodeClaimView(*claim)
	return &view, nil
}

// ShipClaimCodeClaim 后台发货并登记运单号
func ShipClaimCodeClaim(claimId int, trackingNo string, note string) error {
	trackingNo = strings.TrimSpace(trackingNo)
	note = strings.TrimSpace(note)
	if len([]rune(trackingNo)) > 64 || len([]rune(note)) > 255 {
		return common.NewMessage("Shipping information is too long")
	}

	claim := &ClaimCodeClaim{}
	if err := DB.First(claim, "id = ?", claimId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return common.NewMessage("Claim record not found")
		}
		return err
	}
	if claim.Type != ClaimCodeTypePhysical {
		return common.NewMessage("Only physical claims can be shipped")
	}
	if claim.Status == ClaimCodeClaimStatusCancelled {
		return common.NewMessage("This claim has been cancelled")
	}
	if claim.ReceiverAddress == "" {
		return common.NewMessage("The user has not filled in the shipping address yet")
	}

	now := common.GetTimestamp()
	return DB.Model(&ClaimCodeClaim{}).Where("id = ?", claimId).Updates(map[string]any{
		"status":       ClaimCodeClaimStatusShipped,
		"tracking_no":  trackingNo,
		"note":         note,
		"shipped_at":   now,
		"delivered_at": now,
		"updated_at":   now,
	}).Error
}

// DeliverClaimCodeClaim 后台手动把记录标记为已发放
func DeliverClaimCodeClaim(claimId int, note string) error {
	note = strings.TrimSpace(note)
	if len([]rune(note)) > 255 {
		return common.NewMessage("Remark is too long")
	}

	claim := &ClaimCodeClaim{}
	if err := DB.First(claim, "id = ?", claimId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return common.NewMessage("Claim record not found")
		}
		return err
	}
	if claim.Status == ClaimCodeClaimStatusCancelled {
		return common.NewMessage("This claim has been cancelled")
	}

	now := common.GetTimestamp()
	return DB.Model(&ClaimCodeClaim{}).Where("id = ?", claimId).Updates(map[string]any{
		"status":       ClaimCodeClaimStatusDelivered,
		"note":         note,
		"delivered_at": now,
		"updated_at":   now,
	}).Error
}

// CancelClaimCodeClaim 作废领取记录（已发放的额度与卡密不回收）
func CancelClaimCodeClaim(claimId int, note string) error {
	note = strings.TrimSpace(note)
	if len([]rune(note)) > 255 {
		return common.NewMessage("Remark is too long")
	}

	claim := &ClaimCodeClaim{}
	if err := DB.First(claim, "id = ?", claimId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return common.NewMessage("Claim record not found")
		}
		return err
	}
	return DB.Model(&ClaimCodeClaim{}).Where("id = ?", claimId).Updates(map[string]any{
		"status":     ClaimCodeClaimStatusCancelled,
		"note":       note,
		"updated_at": common.GetTimestamp(),
	}).Error
}

// GetClaimCodeOverview 后台口令概览
type ClaimCodeOverview struct {
	TotalCodes         int64 `json:"total_codes"`
	ActiveCodes        int64 `json:"active_codes"`
	TotalClaims        int64 `json:"total_claims"`
	PendingShipment    int64 `json:"pending_shipment"`
	QuotaDistributed   int64 `json:"quota_distributed"`
	CardIssued         int64 `json:"card_issued"`
	SubscriptionIssued int64 `json:"subscription_issued"`
	PhysicalIssued     int64 `json:"physical_issued"`
}

// GetClaimCodeOverview 统计口令与领取情况
func GetClaimCodeOverview() (*ClaimCodeOverview, error) {
	overview := &ClaimCodeOverview{}
	now := common.GetTimestamp()

	if err := DB.Model(&ClaimCode{}).Count(&overview.TotalCodes).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&ClaimCode{}).
		Where("status = ? AND (expired_time = 0 OR expired_time >= ?)", ClaimCodeStatusEnabled, now).
		Count(&overview.ActiveCodes).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&ClaimCodeClaim{}).
		Where("status <> ?", ClaimCodeClaimStatusCancelled).
		Count(&overview.TotalClaims).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&ClaimCodeClaim{}).
		Where("type = ? AND status IN ?", ClaimCodeTypePhysical,
			[]string{ClaimCodeClaimStatusPending, ClaimCodeClaimStatusReady}).
		Count(&overview.PendingShipment).Error; err != nil {
		return nil, err
	}

	type typeSum struct {
		Type  string
		Total int64
		Quota int64
	}
	sums := make([]typeSum, 0, 4)
	if err := DB.Model(&ClaimCodeClaim{}).
		Select("type, COUNT(*) AS total, COALESCE(SUM(quota), 0) AS quota").
		Where("status <> ?", ClaimCodeClaimStatusCancelled).
		Group("type").
		Scan(&sums).Error; err != nil {
		return nil, err
	}
	for _, sum := range sums {
		switch sum.Type {
		case ClaimCodeTypeQuota:
			overview.QuotaDistributed = sum.Quota
		case ClaimCodeTypeCardKey:
			overview.CardIssued = sum.Total
		case ClaimCodeTypeSubscription:
			overview.SubscriptionIssued = sum.Total
		case ClaimCodeTypePhysical:
			overview.PhysicalIssued = sum.Total
		}
	}
	return overview, nil
}
