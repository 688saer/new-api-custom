package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 我的奖励（用户侧）
// ---------------------------------------------------------------------------

// 领取状态（前端依据 status 展示徽章）
const (
	RewardGrantPending   = "pending"
	RewardGrantClaimed   = "claimed"
	RewardGrantCancelled = "cancelled"
	RewardGrantExpired   = "expired"
)

// 发放活动状态
const (
	RewardCampaignActive  = "active"
	RewardCampaignRevoked = "revoked"
)

// 奖励相关错误码（前端依据 code 展示对应文案）
const (
	RewardCodeNotEnabled     = "REWARD_NOT_ENABLED"
	RewardCodeNotFound       = "REWARD_NOT_FOUND"
	RewardCodeAlreadyClaimed = "REWARD_ALREADY_CLAIMED"
	RewardCodeCancelled      = "REWARD_CANCELLED"
	RewardCodeExpired        = "REWARD_EXPIRED"
	RewardCodeQuotaExceeded  = "REWARD_QUOTA_LIMIT_EXCEEDED"
	RewardCodeQuotaInvalid   = "REWARD_QUOTA_UNAVAILABLE"
)

// RewardError 带错误码的错误，控制器会将其 code 一并返回
type RewardError struct {
	Code    string
	Message string
}

func (e *RewardError) Error() string { return e.Message }

func newRewardError(code, msg string) *RewardError {
	return &RewardError{Code: code, Message: msg}
}

// RewardCampaign 一次奖励发放活动
type RewardCampaign struct {
	Id    int    `json:"id" gorm:"primaryKey;autoIncrement"`
	Name  string `json:"name" gorm:"type:varchar(80);not null"`
	Style string `json:"style" gorm:"type:varchar(24);not null;default:'aurora'"`

	// Copy 券面文案快照（JSON），发放时固化，后续改默认值不影响已发出的券
	Copy string `json:"copy" gorm:"type:text"`

	// AudienceScope 发放范围：all | active | spend | specific
	AudienceScope string `json:"audience_scope" gorm:"type:varchar(16);not null;default:'all'"`

	// RewardMode 计算方式：fixed（每人固定）| percentage（按累计消费比例）| random（每人随机）
	RewardMode string `json:"reward_mode" gorm:"type:varchar(16);not null;default:'fixed'"`

	FixedQuota int `json:"fixed_quota" gorm:"not null;default:0"` // 每人固定额度
	Percent    int `json:"percent" gorm:"not null;default:0"`     // 比例（%）
	CapQuota   int `json:"cap_quota" gorm:"not null;default:0"`   // 比例模式每人封顶额度

	// RandomMinQuota / RandomMaxQuota 随机模式的每人额度区间（含端点）
	RandomMinQuota int `json:"random_min_quota" gorm:"not null;default:0"`
	RandomMaxQuota int `json:"random_max_quota" gorm:"not null;default:0"`

	// ExpiresAt 领取截止时间（Unix 秒），0 表示长期有效
	ExpiresAt int64 `json:"expires_at" gorm:"bigint;not null;default:0"`

	TargetCount  int   `json:"target_count" gorm:"not null;default:0"`
	ClaimedCount int   `json:"claimed_count" gorm:"not null;default:0"`
	TotalQuota   int   `json:"total_quota" gorm:"not null;default:0"`
	CreatedBy    int   `json:"created_by" gorm:"not null;default:0"`
	CreatedAt    int64 `json:"created_at" gorm:"bigint;index"`

	Status    string `json:"status" gorm:"type:varchar(16);not null;default:'active';index"`
	RevokedAt int64  `json:"revoked_at" gorm:"bigint;not null;default:0"`
}

func (RewardCampaign) TableName() string {
	return "reward_campaigns"
}

// RewardGrant 单条待领取/已领取奖励
type RewardGrant struct {
	Id         int `json:"id" gorm:"primaryKey;autoIncrement"`
	CampaignId int `json:"campaign_id" gorm:"not null;uniqueIndex:idx_reward_grant_campaign_user,priority:1;index"`
	UserId     int `json:"user_id" gorm:"not null;uniqueIndex:idx_reward_grant_campaign_user,priority:2;index:idx_reward_grant_user_status,priority:1"`

	Status string `json:"status" gorm:"type:varchar(16);not null;default:'pending';index:idx_reward_grant_user_status,priority:2"`

	AmountQuota int   `json:"amount_quota" gorm:"not null;default:0"`
	ExpiresAt   int64 `json:"expires_at" gorm:"bigint;not null;default:0"`

	CreatedAt   int64 `json:"created_at" gorm:"bigint;index"`
	ClaimedAt   int64 `json:"claimed_at" gorm:"bigint;not null;default:0"`
	CancelledAt int64 `json:"cancelled_at" gorm:"bigint;not null;default:0"`
}

func (RewardGrant) TableName() string {
	return "reward_grants"
}

// RewardItem 用户侧一条奖励（券面所需字段已展开）
type RewardItem struct {
	Id          int                                `json:"id"`
	Status      string                             `json:"status"`
	Name        string                             `json:"campaign_name"`
	Style       string                             `json:"style"`
	Copy        operation_setting.RewardTicketCopy `json:"copy"`
	AmountQuota int                                `json:"amount_quota"`
	ExpiresAt   int64                              `json:"expires_at"`
	CreatedAt   int64                              `json:"created_at"`
	ClaimedAt   int64                              `json:"claimed_at"`
}

// RewardPendingResult 待领取奖励汇总
type RewardPendingResult struct {
	Enabled      bool         `json:"enabled"`
	Count        int          `json:"count"`
	TotalQuota   int          `json:"total_quota"`
	Items        []RewardItem `json:"items"`
	QuotaPerUnit float64      `json:"quota_per_unit"`
}

// RewardHistoryResult 领取记录分页
type RewardHistoryResult struct {
	Items    []RewardItem `json:"items"`
	Total    int          `json:"total"`
	Page     int          `json:"page"`
	PageSize int          `json:"page_size"`
}

// expireRewardGrants 惰性结算过期奖励，避免依赖后台定时任务
func expireRewardGrants(userId int) error {
	now := time.Now().Unix()
	query := DB.Model(&RewardGrant{}).
		Where("status = ? AND expires_at > 0 AND expires_at < ?", RewardGrantPending, now)
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	return query.Update("status", RewardGrantExpired).Error
}

// rewardCampaignCopy 把活动上的券面文案解析出来
func rewardCampaignCopy(campaign *RewardCampaign) operation_setting.RewardTicketCopy {
	copyValue := operation_setting.RewardTicketCopy{}
	if campaign != nil && campaign.Copy != "" {
		_ = common.UnmarshalJsonStr(campaign.Copy, &copyValue)
	}
	return operation_setting.NormalizeRewardTicketCopy(copyValue)
}

// buildRewardItems 把授权记录与活动拼成前端券面
func buildRewardItems(grants []RewardGrant) ([]RewardItem, error) {
	items := make([]RewardItem, 0, len(grants))
	if len(grants) == 0 {
		return items, nil
	}

	campaignIds := make([]int, 0, len(grants))
	for i := range grants {
		campaignIds = append(campaignIds, grants[i].CampaignId)
	}
	var campaigns []RewardCampaign
	if err := DB.Where("id IN ?", campaignIds).Find(&campaigns).Error; err != nil {
		return nil, err
	}
	byId := make(map[int]*RewardCampaign, len(campaigns))
	for i := range campaigns {
		byId[campaigns[i].Id] = &campaigns[i]
	}

	for i := range grants {
		grant := grants[i]
		campaign := byId[grant.CampaignId]
		item := RewardItem{
			Id:          grant.Id,
			Status:      grant.Status,
			Style:       operation_setting.RewardStyleAurora,
			AmountQuota: grant.AmountQuota,
			ExpiresAt:   grant.ExpiresAt,
			CreatedAt:   grant.CreatedAt,
			ClaimedAt:   grant.ClaimedAt,
		}
		if campaign != nil {
			item.Name = campaign.Name
			item.Style = operation_setting.NormalizeRewardStyle(campaign.Style)
		}
		item.Copy = rewardCampaignCopy(campaign)
		items = append(items, item)
	}
	return items, nil
}

// GetUserPendingRewards 获取用户待领取奖励
func GetUserPendingRewards(userId int) (*RewardPendingResult, error) {
	setting := operation_setting.GetRewardSetting()
	result := &RewardPendingResult{
		Enabled:      setting.Enabled,
		Items:        []RewardItem{},
		QuotaPerUnit: common.QuotaPerUnit,
	}
	if !setting.Enabled {
		return result, nil
	}

	if err := expireRewardGrants(userId); err != nil {
		return nil, err
	}

	var grants []RewardGrant
	err := DB.Where("user_id = ? AND status = ?", userId, RewardGrantPending).
		Order("expires_at = 0 ASC, expires_at ASC, id ASC").
		Find(&grants).Error
	if err != nil {
		return nil, err
	}

	items, err := buildRewardItems(grants)
	if err != nil {
		return nil, err
	}
	result.Items = items
	result.Count = len(items)
	for i := range items {
		result.TotalQuota += items[i].AmountQuota
	}
	return result, nil
}

// GetUserRewardHistory 获取用户领取记录
func GetUserRewardHistory(userId, page, pageSize int) (*RewardHistoryResult, error) {
	setting := operation_setting.GetRewardSetting()
	if pageSize <= 0 {
		pageSize = setting.HistoryPageSize
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	if page <= 0 {
		page = 1
	}

	if err := expireRewardGrants(userId); err != nil {
		return nil, err
	}

	result := &RewardHistoryResult{Items: []RewardItem{}, Page: page, PageSize: pageSize}
	var total int64
	if err := DB.Model(&RewardGrant{}).
		Where("user_id = ? AND status <> ?", userId, RewardGrantPending).
		Count(&total).Error; err != nil {
		return nil, err
	}
	result.Total = int(total)

	// 待领取的券已经在待领取列表里展示，领取记录只保留已进入终态的条目，
	// 避免同一张券在两处重复出现。
	var grants []RewardGrant
	err := DB.Where("user_id = ? AND status <> ?", userId, RewardGrantPending).
		Order("id DESC").
		Limit(pageSize).
		Offset((page - 1) * pageSize).
		Find(&grants).Error
	if err != nil {
		return nil, err
	}
	items, err := buildRewardItems(grants)
	if err != nil {
		return nil, err
	}
	result.Items = items
	return result, nil
}

// ClaimRewardResult 领取结果
type ClaimRewardResult struct {
	AlreadyClaimed bool    `json:"already_claimed"`
	AmountQuota    int     `json:"amount_quota"`
	Balance        int     `json:"balance"`
	QuotaPerUnit   float64 `json:"quota_per_unit"`
}

// ClaimRewardGrant 领取一条奖励，成功后额度立即到账
func ClaimRewardGrant(userId, grantId int) (*ClaimRewardResult, error) {
	setting := operation_setting.GetRewardSetting()
	if !setting.Enabled {
		return nil, newRewardError(RewardCodeNotEnabled, "Reward feature is not enabled")
	}
	if grantId <= 0 {
		return nil, newRewardError(RewardCodeNotFound, "Reward not found")
	}
	if common.QuotaPerUnit <= 0 {
		return nil, newRewardError(RewardCodeQuotaInvalid, "Quota configuration is temporarily unavailable")
	}

	now := time.Now().Unix()
	var (
		result      *ClaimRewardResult
		amountQuota int
	)

	err := DB.Transaction(func(tx *gorm.DB) error {
		var grant RewardGrant
		err := lockForUpdate(tx).
			Where("id = ? AND user_id = ?", grantId, userId).
			First(&grant).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return newRewardError(RewardCodeNotFound, "Reward not found")
			}
			return err
		}

		switch grant.Status {
		case RewardGrantClaimed:
			// 重复点击不算失败，直接把余额带回去
			var balance int
			if err := tx.Model(&User{}).Where("id = ?", userId).Select("quota").Scan(&balance).Error; err != nil {
				return err
			}
			result = &ClaimRewardResult{
				AlreadyClaimed: true,
				AmountQuota:    grant.AmountQuota,
				Balance:        balance,
				QuotaPerUnit:   common.QuotaPerUnit,
			}
			return nil
		case RewardGrantCancelled:
			return newRewardError(RewardCodeCancelled, "This reward has been withdrawn")
		case RewardGrantExpired:
			return newRewardError(RewardCodeExpired, "This reward has expired")
		}

		if grant.ExpiresAt > 0 && grant.ExpiresAt < now {
			if err := tx.Model(&RewardGrant{}).Where("id = ?", grant.Id).
				Update("status", RewardGrantExpired).Error; err != nil {
				return err
			}
			return newRewardError(RewardCodeExpired, "This reward has expired")
		}

		var user User
		if err := lockForUpdate(tx).Where("id = ?", userId).First(&user).Error; err != nil {
			return err
		}
		if setting.MaxQuotaLimit > 0 && user.Quota+grant.AmountQuota > setting.MaxQuotaLimit {
			return newRewardError(RewardCodeQuotaExceeded, "Your quota has reached the maximum limit")
		}

		// 条件更新保证同一张券只入账一次
		res := tx.Model(&RewardGrant{}).
			Where("id = ? AND status = ?", grant.Id, RewardGrantPending).
			Updates(map[string]any{"status": RewardGrantClaimed, "claimed_at": now})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return newRewardError(RewardCodeAlreadyClaimed, "This reward has already been claimed")
		}

		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", grant.AmountQuota)).Error; err != nil {
			return err
		}
		if err := tx.Model(&RewardCampaign{}).Where("id = ?", grant.CampaignId).
			Update("claimed_count", gorm.Expr("claimed_count + ?", 1)).Error; err != nil {
			return err
		}

		var balance int
		if err := tx.Model(&User{}).Where("id = ?", userId).Select("quota").Scan(&balance).Error; err != nil {
			return err
		}
		amountQuota = grant.AmountQuota
		result = &ClaimRewardResult{
			AmountQuota:  grant.AmountQuota,
			Balance:      balance,
			QuotaPerUnit: common.QuotaPerUnit,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	if amountQuota > 0 {
		go func() {
			_ = cacheIncrUserQuota(userId, int64(amountQuota))
		}()
	}
	return result, nil
}
