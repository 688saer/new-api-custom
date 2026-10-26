package model

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 我的奖励（管理侧：发放、撤回、明细）
// ---------------------------------------------------------------------------

// 发放范围
const (
	RewardScopeAll      = "all"
	RewardScopeActive   = "active"
	RewardScopeSpend    = "spend"
	RewardScopeSpecific = "specific"
)

// 计算方式
const (
	RewardModeFixed      = "fixed"
	RewardModePercentage = "percentage"
	// RewardModeRandom 每位用户在自己区间内抽取一个额度，抽取结果在发放时固化，
	// 因此活动总额、明细与撤回金额都是确定的，可审计。
	RewardModeRandom = "random"
)

// maxRewardRecipients 单次发放人数上限，避免误操作把整站用户一次性写进来
const maxRewardRecipients = 5000

// RewardAudienceDraft 发放范围草稿
type RewardAudienceDraft struct {
	Scope       string  `json:"scope"`
	ActiveDays  int     `json:"active_days"`
	SpendMinUSD float64 `json:"spend_min_usd"`
	SpendMaxUSD float64 `json:"spend_max_usd"`
	UserIds     []int   `json:"user_ids"`
}

// RewardCampaignDraft 发放活动草稿（预览与正式发放共用）
type RewardCampaignDraft struct {
	Name       string                             `json:"name"`
	Style      string                             `json:"style"`
	Copy       operation_setting.RewardTicketCopy `json:"copy"`
	Audience   RewardAudienceDraft                `json:"audience"`
	RewardMode string                             `json:"reward_mode"`
	FixedQuota int                                `json:"fixed_quota"`
	Percent    int                                `json:"percent"`
	CapQuota   int                                `json:"cap_quota"`
	// RandomMinQuota / RandomMaxQuota 随机模式的每人额度区间
	RandomMinQuota int `json:"random_min_quota"`
	RandomMaxQuota int `json:"random_max_quota"`
	// ClaimStartAt 领取开始时间（Unix 秒），0 表示发放后立即可领
	ClaimStartAt int64 `json:"claim_start_at"`
	ExpiresAt    int64 `json:"expires_at"`
}

// RewardRecipient 解析出的单个接收人
type RewardRecipient struct {
	UserId      int    `json:"user_id"`
	Username    string `json:"username"`
	Email       string `json:"email"`
	AmountQuota int    `json:"amount_quota"`
}

// RewardPreview 发放预览
type RewardPreview struct {
	Count        int               `json:"count"`
	TotalQuota   int               `json:"total_quota"`
	QuotaPerUnit float64           `json:"quota_per_unit"`
	Sample       []RewardRecipient `json:"sample"`
	Truncated    bool              `json:"truncated"`

	// 随机模式下总额无法事先确定：MinQuota/MaxQuota 是每人区间，
	// TotalQuota 按区间中值估算，Estimated 标记该数值只是估算。
	MinQuota  int  `json:"min_quota"`
	MaxQuota  int  `json:"max_quota"`
	Estimated bool `json:"estimated"`
}

// RewardCampaignSummary 发放记录条目
type RewardCampaignSummary struct {
	Id             int     `json:"id"`
	Name           string  `json:"name"`
	Style          string  `json:"style"`
	AudienceScope  string  `json:"audience_scope"`
	RewardMode     string  `json:"reward_mode"`
	FixedQuota     int     `json:"fixed_quota"`
	Percent        int     `json:"percent"`
	CapQuota       int     `json:"cap_quota"`
	RandomMinQuota int     `json:"random_min_quota"`
	RandomMaxQuota int     `json:"random_max_quota"`
	TargetCount    int     `json:"target_count"`
	ClaimedCount   int     `json:"claimed_count"`
	TotalQuota     int     `json:"total_quota"`
	ClaimedQuota   int     `json:"claimed_quota"`
	ClaimStartAt   int64   `json:"claim_start_at"`
	ExpiresAt      int64   `json:"expires_at"`
	CreatedAt      int64   `json:"created_at"`
	Status         string  `json:"status"`
	QuotaPerUnit   float64 `json:"quota_per_unit"`
}

// RewardCampaignList 发放记录分页
type RewardCampaignList struct {
	Items    []RewardCampaignSummary `json:"items"`
	Total    int                     `json:"total"`
	Page     int                     `json:"page"`
	PageSize int                     `json:"page_size"`
}

// RewardGrantRow 领取明细条目
type RewardGrantRow struct {
	Id           int    `json:"id"`
	UserId       int    `json:"user_id"`
	Username     string `json:"username"`
	Email        string `json:"email"`
	AmountQuota  int    `json:"amount_quota"`
	Status       string `json:"status"`
	ClaimStartAt int64  `json:"claim_start_at"`
	ClaimedAt    int64  `json:"claimed_at"`
	ExpiresAt    int64  `json:"expires_at"`
}

// RewardGrantList 领取明细分页
type RewardGrantList struct {
	Items    []RewardGrantRow `json:"items"`
	Total    int              `json:"total"`
	Page     int              `json:"page"`
	PageSize int              `json:"page_size"`
}

// RewardUserOption 指定用户选择器的候选项
type RewardUserOption struct {
	Id       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Quota    int    `json:"quota"`
}

// normalizeRewardDraft 校验并收敛草稿字段
func normalizeRewardDraft(draft *RewardCampaignDraft) error {
	draft.Name = strings.TrimSpace(draft.Name)
	if draft.Name == "" {
		return newRewardError("REWARD_INVALID_NAME", "Campaign name is required")
	}
	if len(draft.Name) > 80 {
		return newRewardError("REWARD_INVALID_NAME", "Campaign name is too long")
	}
	draft.Style = operation_setting.NormalizeRewardStyle(draft.Style)
	draft.Copy = operation_setting.NormalizeRewardTicketCopy(draft.Copy)

	if draft.ClaimStartAt < 0 {
		draft.ClaimStartAt = 0
	}
	if draft.ExpiresAt < 0 {
		draft.ExpiresAt = 0
	}
	if draft.ExpiresAt > 0 && draft.ExpiresAt <= time.Now().Unix() {
		return newRewardError("REWARD_INVALID_EXPIRY", "Claim deadline must be in the future")
	}
	if draft.ClaimStartAt > 0 && draft.ExpiresAt > 0 && draft.ClaimStartAt >= draft.ExpiresAt {
		return newRewardError("REWARD_INVALID_CLAIM_WINDOW", "Claim start time must be earlier than the deadline")
	}

	switch draft.RewardMode {
	case RewardModeFixed:
		if draft.FixedQuota <= 0 {
			return newRewardError("REWARD_INVALID_AMOUNT", "Reward amount must be greater than zero")
		}
	case RewardModePercentage:
		if draft.Percent <= 0 || draft.Percent > 100 {
			return newRewardError("REWARD_INVALID_AMOUNT", "Reward percentage must be between 1 and 100")
		}
		if draft.CapQuota <= 0 {
			return newRewardError("REWARD_INVALID_AMOUNT", "A per-user cap is required for percentage rewards")
		}
	case RewardModeRandom:
		if draft.RandomMinQuota <= 0 {
			return newRewardError("REWARD_INVALID_AMOUNT", "The minimum random amount must be greater than zero")
		}
		if draft.RandomMaxQuota < draft.RandomMinQuota {
			return newRewardError("REWARD_INVALID_AMOUNT", "The maximum random amount must not be lower than the minimum")
		}
	default:
		return newRewardError("REWARD_INVALID_AMOUNT", "Unsupported reward calculation")
	}

	switch draft.Audience.Scope {
	case RewardScopeAll, RewardScopeSpecific:
	case RewardScopeActive:
		if draft.Audience.ActiveDays <= 0 {
			draft.Audience.ActiveDays = 30
		}
	case RewardScopeSpend:
		if draft.Audience.SpendMinUSD < 0 {
			draft.Audience.SpendMinUSD = 0
		}
		if draft.Audience.SpendMaxUSD > 0 && draft.Audience.SpendMaxUSD < draft.Audience.SpendMinUSD {
			return newRewardError("REWARD_INVALID_AUDIENCE", "Maximum spend must not be lower than the minimum")
		}
	default:
		return newRewardError("REWARD_INVALID_AUDIENCE", "Unsupported reward audience")
	}
	if draft.Audience.Scope == RewardScopeSpecific && len(draft.Audience.UserIds) == 0 {
		return newRewardError("REWARD_INVALID_AUDIENCE", "Select at least one user")
	}
	return nil
}

// rewardScopeUserIds 解析发放范围对应的用户 id
func rewardScopeUserIds(audience RewardAudienceDraft) ([]int, error) {
	switch audience.Scope {
	case RewardScopeSpecific:
		unique := make([]int, 0, len(audience.UserIds))
		seen := make(map[int]struct{}, len(audience.UserIds))
		for _, id := range audience.UserIds {
			if id <= 0 {
				continue
			}
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			unique = append(unique, id)
		}
		if len(unique) > maxRewardRecipients {
			return nil, newRewardError("REWARD_TOO_MANY", "Too many recipients for a single campaign")
		}
		var existing []int
		if err := DB.Model(&User{}).Where("id IN ?", unique).Pluck("id", &existing).Error; err != nil {
			return nil, err
		}
		return existing, nil

	case RewardScopeActive:
		if LOG_DB == nil {
			return nil, newRewardError(RewardCodeQuotaInvalid, "Log database is not available")
		}
		since := time.Now().AddDate(0, 0, -audience.ActiveDays).Unix()
		var ids []int
		err := LOG_DB.Model(&Log{}).
			Where("type = ? AND created_at >= ?", LogTypeConsume, since).
			Distinct("user_id").
			Pluck("user_id", &ids).Error
		return ids, err

	case RewardScopeSpend:
		if LOG_DB == nil {
			return nil, newRewardError(RewardCodeQuotaInvalid, "Log database is not available")
		}
		unit := common.QuotaPerUnit
		if unit <= 0 {
			return nil, newRewardError(RewardCodeQuotaInvalid, "Quota configuration is temporarily unavailable")
		}
		query := LOG_DB.Model(&Log{}).
			Select("user_id").
			Where("type = ?", LogTypeConsume).
			Group("user_id").
			Having("SUM(quota) >= ?", int(audience.SpendMinUSD*unit))
		if audience.SpendMaxUSD > 0 {
			query = query.Having("SUM(quota) <= ?", int(audience.SpendMaxUSD*unit))
		}
		var ids []int
		err := query.Pluck("user_id", &ids).Error
		return ids, err

	default:
		var ids []int
		err := DB.Model(&User{}).Pluck("id", &ids).Error
		return ids, err
	}
}

// loadRewardConsumptionQuota 批量查询用户累计消费额度
func loadRewardConsumptionQuota(userIds []int) (map[int]int64, error) {
	consumed := make(map[int]int64, len(userIds))
	if len(userIds) == 0 || LOG_DB == nil {
		return consumed, nil
	}
	var rows []struct {
		UserId     int
		TotalQuota int64
	}
	err := LOG_DB.Model(&Log{}).
		Select("user_id, SUM(quota) AS total_quota").
		Where("type = ? AND user_id IN ?", LogTypeConsume, userIds).
		Group("user_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for i := range rows {
		consumed[rows[i].UserId] = rows[i].TotalQuota
	}
	return consumed, nil
}

// rewardRandomMidpoint 随机模式的估算额度（区间中值）
func rewardRandomMidpoint(draft *RewardCampaignDraft) int {
	return (draft.RandomMinQuota + draft.RandomMaxQuota) / 2
}

// rewardRandomAmount 在区间内均匀抽取一个额度。区间退化为单点时不抽签。
func rewardRandomAmount(draft *RewardCampaignDraft, rnd *rand.Rand) int {
	if draft.RandomMaxQuota <= draft.RandomMinQuota {
		return draft.RandomMinQuota
	}
	span := draft.RandomMaxQuota - draft.RandomMinQuota + 1
	return draft.RandomMinQuota + int(rnd.Int63n(int64(span)))
}

// rewardAmountFor 按计算方式得出单人额度，0 表示不发放。
// rnd 仅在随机模式下使用，为 nil 时取区间中值（用于预览估算）。
func rewardAmountFor(draft *RewardCampaignDraft, consumedQuota int64, rnd *rand.Rand) int {
	switch draft.RewardMode {
	case RewardModeFixed:
		return draft.FixedQuota
	case RewardModeRandom:
		if rnd == nil {
			return rewardRandomMidpoint(draft)
		}
		return rewardRandomAmount(draft, rnd)
	}
	amount := int(float64(consumedQuota) * float64(draft.Percent) / 100)
	if draft.CapQuota > 0 && amount > draft.CapQuota {
		amount = draft.CapQuota
	}
	if amount < 0 {
		return 0
	}
	return amount
}

// resolveRewardRecipients 解析接收人及其额度。rnd 为 nil 时随机模式按区间中值
// 估算，用于预览；正式发放必须传入真实随机源，使每人额度当场固化。
func resolveRewardRecipients(draft *RewardCampaignDraft, rnd *rand.Rand) ([]RewardRecipient, error) {
	userIds, err := rewardScopeUserIds(draft.Audience)
	if err != nil {
		return nil, err
	}
	if len(userIds) == 0 {
		return []RewardRecipient{}, nil
	}
	if len(userIds) > maxRewardRecipients {
		return nil, newRewardError("REWARD_TOO_MANY", fmt.Sprintf("This campaign would reach more than %d users", maxRewardRecipients))
	}

	var consumers map[int]int64
	if draft.RewardMode == RewardModePercentage {
		consumers, err = loadRewardConsumptionQuota(userIds)
		if err != nil {
			return nil, err
		}
	}

	recipients := make([]RewardRecipient, 0, len(userIds))
	for i := range userIds {
		amount := rewardAmountFor(draft, consumers[userIds[i]], rnd)
		if amount <= 0 {
			continue
		}
		recipients = append(recipients, RewardRecipient{UserId: userIds[i], AmountQuota: amount})
	}
	if len(recipients) == 0 {
		return recipients, nil
	}

	ids := make([]int, 0, len(recipients))
	for i := range recipients {
		ids = append(ids, recipients[i].UserId)
	}
	var users []User
	if err := DB.Select("id", "username", "email").Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
	}
	byId := make(map[int]*User, len(users))
	for i := range users {
		byId[users[i].Id] = &users[i]
	}
	for i := range recipients {
		if user, ok := byId[recipients[i].UserId]; ok {
			recipients[i].Username = user.Username
			recipients[i].Email = user.Email
		}
	}
	return recipients, nil
}

// rewardCampaignSummaryOf 把活动行映射为对外的摘要结构。
// 发放、列表、撤回三处都要输出同一份字段，集中在这里避免各写一遍。
func rewardCampaignSummaryOf(campaign *RewardCampaign, claimedQuota int) RewardCampaignSummary {
	return RewardCampaignSummary{
		Id:             campaign.Id,
		Name:           campaign.Name,
		Style:          campaign.Style,
		AudienceScope:  campaign.AudienceScope,
		RewardMode:     campaign.RewardMode,
		FixedQuota:     campaign.FixedQuota,
		Percent:        campaign.Percent,
		CapQuota:       campaign.CapQuota,
		RandomMinQuota: campaign.RandomMinQuota,
		RandomMaxQuota: campaign.RandomMaxQuota,
		TargetCount:    campaign.TargetCount,
		ClaimedCount:   campaign.ClaimedCount,
		TotalQuota:     campaign.TotalQuota,
		ClaimedQuota:   claimedQuota,
		ClaimStartAt:   campaign.ClaimStartAt,
		ExpiresAt:      campaign.ExpiresAt,
		CreatedAt:      campaign.CreatedAt,
		Status:         campaign.Status,
		QuotaPerUnit:   common.QuotaPerUnit,
	}
}

// PreviewRewardCampaign 预览发放人数、总额与前若干位名单
func PreviewRewardCampaign(draft RewardCampaignDraft) (*RewardPreview, error) {
	if err := normalizeRewardDraft(&draft); err != nil {
		return nil, err
	}
	// 预览用区间中值估算随机额度，不消耗真实随机源。
	recipients, err := resolveRewardRecipients(&draft, nil)
	if err != nil {
		return nil, err
	}

	preview := &RewardPreview{
		Count:        len(recipients),
		QuotaPerUnit: common.QuotaPerUnit,
		Sample:       []RewardRecipient{},
	}
	for i := range recipients {
		preview.TotalQuota += recipients[i].AmountQuota
	}
	if draft.RewardMode == RewardModeRandom {
		preview.MinQuota = draft.RandomMinQuota
		preview.MaxQuota = draft.RandomMaxQuota
		preview.Estimated = draft.RandomMaxQuota > draft.RandomMinQuota
	}
	const sampleSize = 20
	if len(recipients) > sampleSize {
		preview.Truncated = true
		preview.Sample = recipients[:sampleSize]
	} else {
		preview.Sample = recipients
	}
	return preview, nil
}

// IssueRewardCampaign 正式发放奖励：一次事务写入活动与全部待领取记录
func IssueRewardCampaign(draft RewardCampaignDraft, adminId int) (*RewardCampaignSummary, error) {
	if err := normalizeRewardDraft(&draft); err != nil {
		return nil, err
	}
	// 随机模式在发放这一刻抽定每人额度并写进 reward_grants，
	// 之后的活动总额、明细与撤回金额都以落库值为准，不随重算变化。
	var rnd *rand.Rand
	if draft.RewardMode == RewardModeRandom {
		rnd = rand.New(rand.NewSource(time.Now().UnixNano() ^ int64(adminId)<<17))
	}
	recipients, err := resolveRewardRecipients(&draft, rnd)
	if err != nil {
		return nil, err
	}
	if len(recipients) == 0 {
		return nil, newRewardError("REWARD_NO_RECIPIENTS", "No user matches this audience")
	}

	copyBytes, err := common.Marshal(draft.Copy)
	if err != nil {
		return nil, err
	}

	now := time.Now().Unix()
	campaign := &RewardCampaign{
		Name:           draft.Name,
		Style:          draft.Style,
		Copy:           string(copyBytes),
		AudienceScope:  draft.Audience.Scope,
		RewardMode:     draft.RewardMode,
		FixedQuota:     draft.FixedQuota,
		Percent:        draft.Percent,
		CapQuota:       draft.CapQuota,
		RandomMinQuota: draft.RandomMinQuota,
		RandomMaxQuota: draft.RandomMaxQuota,
		ClaimStartAt:   draft.ClaimStartAt,
		ExpiresAt:      draft.ExpiresAt,
		TargetCount:    len(recipients),
		CreatedBy:      adminId,
		CreatedAt:      now,
		Status:         RewardCampaignActive,
	}
	for i := range recipients {
		campaign.TotalQuota += recipients[i].AmountQuota
	}

	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(campaign).Error; err != nil {
			return err
		}
		grants := make([]RewardGrant, 0, len(recipients))
		for i := range recipients {
			grants = append(grants, RewardGrant{
				CampaignId:   campaign.Id,
				UserId:       recipients[i].UserId,
				Status:       RewardGrantPending,
				AmountQuota:  recipients[i].AmountQuota,
				ClaimStartAt: draft.ClaimStartAt,
				ExpiresAt:    draft.ExpiresAt,
				CreatedAt:    now,
			})
		}
		return tx.CreateInBatches(grants, 200).Error
	})
	if err != nil {
		return nil, err
	}

	summary := rewardCampaignSummaryOf(campaign, 0)
	return &summary, nil
}

// ListRewardCampaigns 发放记录分页
func ListRewardCampaigns(page, pageSize int) (*RewardCampaignList, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	result := &RewardCampaignList{Items: []RewardCampaignSummary{}, Page: page, PageSize: pageSize}
	var total int64
	if err := DB.Model(&RewardCampaign{}).Count(&total).Error; err != nil {
		return nil, err
	}
	result.Total = int(total)

	var campaigns []RewardCampaign
	err := DB.Order("id DESC").Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&campaigns).Error
	if err != nil {
		return nil, err
	}

	claimedQuota := make(map[int]int, len(campaigns))
	if len(campaigns) > 0 {
		ids := make([]int, 0, len(campaigns))
		for i := range campaigns {
			ids = append(ids, campaigns[i].Id)
		}
		var rows []struct {
			CampaignId int
			TotalQuota int
		}
		err := DB.Model(&RewardGrant{}).
			Select("campaign_id, SUM(amount_quota) AS total_quota").
			Where("campaign_id IN ? AND status = ?", ids, RewardGrantClaimed).
			Group("campaign_id").
			Scan(&rows).Error
		if err != nil {
			return nil, err
		}
		for i := range rows {
			claimedQuota[rows[i].CampaignId] = rows[i].TotalQuota
		}
	}

	for i := range campaigns {
		campaign := campaigns[i]
		result.Items = append(result.Items,
			rewardCampaignSummaryOf(&campaign, claimedQuota[campaign.Id]))
	}
	return result, nil
}

// ListRewardGrants 某次发放的领取明细分页
func ListRewardGrants(campaignId, page, pageSize int) (*RewardGrantList, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}

	result := &RewardGrantList{Items: []RewardGrantRow{}, Page: page, PageSize: pageSize}
	var total int64
	if err := DB.Model(&RewardGrant{}).Where("campaign_id = ?", campaignId).
		Count(&total).Error; err != nil {
		return nil, err
	}
	result.Total = int(total)

	var grants []RewardGrant
	err := DB.Where("campaign_id = ?", campaignId).
		Order("id ASC").Limit(pageSize).Offset((page - 1) * pageSize).
		Find(&grants).Error
	if err != nil {
		return nil, err
	}
	if len(grants) == 0 {
		return result, nil
	}

	ids := make([]int, 0, len(grants))
	for i := range grants {
		ids = append(ids, grants[i].UserId)
	}
	var users []User
	if err := DB.Select("id", "username", "email").Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
	}
	byId := make(map[int]*User, len(users))
	for i := range users {
		byId[users[i].Id] = &users[i]
	}

	for i := range grants {
		grant := grants[i]
		row := RewardGrantRow{
			Id:           grant.Id,
			UserId:       grant.UserId,
			AmountQuota:  grant.AmountQuota,
			Status:       grant.Status,
			ClaimStartAt: grant.ClaimStartAt,
			ClaimedAt:    grant.ClaimedAt,
			ExpiresAt:    grant.ExpiresAt,
		}
		if user, ok := byId[grant.UserId]; ok {
			row.Username = user.Username
			row.Email = user.Email
		}
		result.Items = append(result.Items, row)
	}
	return result, nil
}

// RevokeRewardCampaign 撤回尚未领取的奖励
func RevokeRewardCampaign(campaignId int) (*RewardCampaignSummary, error) {
	var campaign RewardCampaign
	if err := DB.Where("id = ?", campaignId).First(&campaign).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, newRewardError(RewardCodeNotFound, "Campaign not found")
		}
		return nil, err
	}
	if campaign.Status == RewardCampaignRevoked {
		return nil, newRewardError("REWARD_ALREADY_REVOKED", "This campaign has already been withdrawn")
	}

	now := time.Now().Unix()
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&RewardGrant{}).
			Where("campaign_id = ? AND status = ?", campaignId, RewardGrantPending).
			Updates(map[string]any{"status": RewardGrantCancelled, "cancelled_at": now}).Error; err != nil {
			return err
		}
		return tx.Model(&RewardCampaign{}).Where("id = ?", campaignId).
			Updates(map[string]any{"status": RewardCampaignRevoked, "revoked_at": now}).Error
	})
	if err != nil {
		return nil, err
	}

	campaign.Status = RewardCampaignRevoked
	campaign.RevokedAt = now
	var claimedQuota int
	if err := DB.Model(&RewardGrant{}).
		Select("COALESCE(SUM(amount_quota), 0)").
		Where("campaign_id = ? AND status = ?", campaignId, RewardGrantClaimed).
		Scan(&claimedQuota).Error; err != nil {
		return nil, err
	}

	summary := rewardCampaignSummaryOf(&campaign, claimedQuota)
	return &summary, nil
}

// SearchRewardUsers 按邮箱或用户名搜索可选用户
func SearchRewardUsers(keyword string, limit int) ([]RewardUserOption, error) {
	keyword = strings.TrimSpace(keyword)
	if limit <= 0 || limit > 50 {
		limit = 20
	}

	query := DB.Model(&User{}).Select("id", "username", "email", "quota")
	if keyword != "" {
		pattern := "%" + keyword + "%"
		query = query.Where("username LIKE ? OR email LIKE ?", pattern, pattern)
	}

	var users []RewardUserOption
	if err := query.Order("id DESC").Limit(limit).Find(&users).Error; err != nil {
		return nil, err
	}
	if users == nil {
		users = []RewardUserOption{}
	}
	return users, nil
}
