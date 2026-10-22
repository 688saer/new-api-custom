package model

import (
	"errors"
	"fmt"
	"math"
	"math/rand"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 福利宝箱
// ---------------------------------------------------------------------------

// WelfareChestClaim 每周福利宝箱领取记录
type WelfareChestClaim struct {
	Id             int     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId         int     `json:"user_id" gorm:"not null;uniqueIndex:idx_welfare_user_week,priority:1"`
	WeekKey        string  `json:"week_key" gorm:"type:varchar(12);not null;uniqueIndex:idx_welfare_user_week,priority:2"` // 例如 2026-W36
	Chest          string  `json:"chest" gorm:"type:varchar(32);not null"`
	RewardQuota    int     `json:"reward_quota" gorm:"not null;default:0"`
	RewardUSD      float64 `json:"reward_usd" gorm:"not null;default:0"`
	ConsumptionUSD float64 `json:"consumption_usd" gorm:"not null;default:0"` // 领取时的周消费快照
	CreatedAt      int64   `json:"created_at" gorm:"bigint"`
}

func (WelfareChestClaim) TableName() string {
	return "welfare_chest_claims"
}

// 宝箱相关错误码（前端依据 code 展示对应文案）
const (
	WelfareChestCodeAlreadyOpened    = "ALREADY_OPENED"
	WelfareChestCodeNotEligible      = "NOT_ELIGIBLE"
	WelfareChestCodeLogUnavailable   = "LOG_UNAVAILABLE"
	WelfareChestCodeQuotaUnavailable = "QUOTA_UNAVAILABLE"
	WelfareChestCodeQuotaExceeded    = "QUOTA_LIMIT_EXCEEDED"
	WelfareChestCodeInvalidChest     = "INVALID_CHEST"
	WelfareChestCodeNotEnabled       = "NOT_ENABLED"
)

// WelfareChestError 带错误码的错误，控制器会将其 code 一并返回
type WelfareChestError struct {
	Code    string
	Message string
}

func (e *WelfareChestError) Error() string { return e.Message }

func newWelfareChestError(code, msg string) *WelfareChestError {
	return &WelfareChestError{Code: code, Message: msg}
}

// WelfareWeekRange 返回本周（周一为起点）起止时间与周标识 2026-W36
func WelfareWeekRange(now time.Time) (start, end time.Time, key string) {
	loc := now.Location()
	weekday := int(now.Weekday())
	if weekday == 0 {
		weekday = 7 // 周日算第 7 天
	}
	start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).
		AddDate(0, 0, -(weekday - 1))
	end = start.AddDate(0, 0, 7)
	year, week := now.ISOWeek()
	return start, end, fmt.Sprintf("%d-W%02d", year, week)
}

// GetUserWeeklyConsumptionUSD 统计用户本周消费额度并折算美元
func GetUserWeeklyConsumptionUSD(userId int) (float64, error) {
	if LOG_DB == nil {
		return 0, newWelfareChestError(WelfareChestCodeLogUnavailable, "Log database is not available")
	}
	start, _, _ := WelfareWeekRange(time.Now())
	var total int64
	err := LOG_DB.Model(&Log{}).
		Where("user_id = ? AND type = ? AND created_at >= ?", userId, LogTypeConsume, start.Unix()).
		Select("COALESCE(SUM(quota), 0)").
		Scan(&total).Error
	if err != nil {
		return 0, newWelfareChestError(WelfareChestCodeLogUnavailable, "Consumption records are temporarily unavailable")
	}
	unit := common.QuotaPerUnit
	if unit <= 0 {
		return 0, newWelfareChestError(WelfareChestCodeQuotaUnavailable, "Quota configuration is temporarily unavailable")
	}
	return float64(total) / unit, nil
}

// GetUserWelfareClaim 获取用户本周已领取的宝箱
func GetUserWelfareClaim(userId int) (*WelfareChestClaim, error) {
	_, _, weekKey := WelfareWeekRange(time.Now())
	var claim WelfareChestClaim
	err := DB.Where("user_id = ? AND week_key = ?", userId, weekKey).Order("id desc").First(&claim).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &claim, nil
}

// WelfareBoxStatus 单个宝箱的状态
type WelfareBoxStatus struct {
	Key          string  `json:"key"`
	Eligible     bool    `json:"eligible"`
	Code         string  `json:"code,omitempty"`
	Reason       string  `json:"reason,omitempty"`
	ThresholdUSD float64 `json:"threshold_usd"`
	RewardMinUSD float64 `json:"reward_min_usd"`
	RewardMaxUSD float64 `json:"reward_max_usd"`
	MedianUSD    float64 `json:"median_usd"`
	ClosedImage  string  `json:"closed_image,omitempty"`
	OpenedImage  string  `json:"opened_image,omitempty"`
}

// WelfareChestStatus 福利宝箱页状态
type WelfareChestStatus struct {
	Enabled              bool                         `json:"enabled"`
	WeekKey              string                       `json:"week_key"`
	WeekStart            int64                        `json:"week_start"`
	WeekEnd              int64                        `json:"week_end"`
	WeeklyConsumptionUSD float64                      `json:"weekly_consumption_usd"`
	CanOpenAny           bool                         `json:"can_open_any"`
	UnlimitedOpen        bool                         `json:"unlimited_open"`
	OpenedChest          string                       `json:"opened_chest"`
	OpenedRewardUSD      float64                      `json:"opened_reward_usd"`
	OpenedRewardQuota    int                          `json:"opened_reward_quota"`
	Boxes                map[string]*WelfareBoxStatus `json:"boxes"`
	Code                 string                       `json:"code,omitempty"`
	Reason               string                       `json:"reason,omitempty"`
}

// GetWelfareChestStatus 组装福利宝箱页状态
func GetWelfareChestStatus(userId int) (*WelfareChestStatus, error) {
	setting := operation_setting.GetWelfareChestSetting()
	start, end, weekKey := WelfareWeekRange(time.Now())

	status := &WelfareChestStatus{
		Enabled:       setting.Enabled,
		WeekKey:       weekKey,
		WeekStart:     start.Unix(),
		WeekEnd:       end.Unix(),
		CanOpenAny:    setting.CanOpenAny,
		UnlimitedOpen: setting.UnlimitedOpen,
		Boxes:         map[string]*WelfareBoxStatus{},
	}

	if !setting.Enabled {
		status.Code = WelfareChestCodeNotEnabled
		status.Reason = "Welfare chest feature is not enabled"
		return status, nil
	}

	consumption, err := GetUserWeeklyConsumptionUSD(userId)
	if err != nil {
		var we *WelfareChestError
		if errors.As(err, &we) {
			status.Code = we.Code
			status.Reason = we.Message
		} else {
			status.Code = WelfareChestCodeLogUnavailable
			status.Reason = err.Error()
		}
		status.CanOpenAny = false
		consumption = 0
	}
	status.WeeklyConsumptionUSD = consumption

	claim, err := GetUserWelfareClaim(userId)
	if err != nil {
		return nil, err
	}
	if claim != nil {
		status.OpenedChest = claim.Chest
		status.OpenedRewardUSD = claim.RewardUSD
		status.OpenedRewardQuota = claim.RewardQuota
	}

	for _, box := range []*operation_setting.WelfareChestBox{&setting.XiaoshuaiGe, &setting.HeiDashuai} {
		bs := &WelfareBoxStatus{
			Key:          box.Key,
			ThresholdUSD: box.ThresholdUSD,
			RewardMinUSD: box.RewardMinUSD,
			RewardMaxUSD: box.RewardMaxUSD,
			MedianUSD:    box.MedianUSD,
			ClosedImage:  box.ClosedImage,
			OpenedImage:  box.OpenedImage,
		}
		switch {
		case !box.Enabled:
			bs.Code = WelfareChestCodeInvalidChest
			bs.Reason = "This chest is not available"
		case consumption < box.ThresholdUSD:
			bs.Code = WelfareChestCodeNotEligible
			bs.Reason = "Weekly consumption threshold not met"
		default:
			bs.Eligible = true
		}
		status.Boxes[box.Key] = bs
	}

	return status, nil
}

// WelfareChestOpenResult 开箱结果
type WelfareChestOpenResult struct {
	Chest                string  `json:"chest"`
	RewardUSD            float64 `json:"reward_usd"`
	RewardQuota          int     `json:"reward_quota"`
	WeeklyConsumptionUSD float64 `json:"weekly_consumption_usd"`
	NewQuota             int     `json:"new_quota"`
	WeekKey              string  `json:"week_key"`
}

// welfareChestRewardUSD 在配置区间内按三角形分布抽取奖励金额
func welfareChestRewardUSD(box *operation_setting.WelfareChestBox, rnd *rand.Rand) float64 {
	minV := box.RewardMinUSD
	maxV := box.RewardMaxUSD
	if maxV <= minV {
		return minV
	}
	med := box.MedianUSD
	if med <= minV || med >= maxV {
		med = (minV + maxV) / 2
	}
	r := rnd.Float64()
	if r < 0.5 {
		return minV + math.Sqrt(2*r)*(med-minV)
	}
	return med + math.Sqrt(2*(1-r))*(maxV-med)
}

// UserOpenWelfareChest 开启福利宝箱
func UserOpenWelfareChest(userId int, chestKey string) (*WelfareChestOpenResult, error) {
	setting := operation_setting.GetWelfareChestSetting()
	if !setting.Enabled {
		return nil, newWelfareChestError(WelfareChestCodeNotEnabled, "Welfare chest feature is not enabled")
	}
	box := operation_setting.GetWelfareChestBox(chestKey)
	if box == nil || !box.Enabled {
		return nil, newWelfareChestError(WelfareChestCodeInvalidChest, "Invalid welfare chest")
	}

	consumption, err := GetUserWeeklyConsumptionUSD(userId)
	if err != nil {
		return nil, err
	}
	if consumption < box.ThresholdUSD {
		return nil, newWelfareChestError(WelfareChestCodeNotEligible, "Weekly consumption threshold not met")
	}

	// 每周只能开一个（除非 unlimited_open）
	existing, err := GetUserWelfareClaim(userId)
	if err != nil {
		return nil, err
	}
	if existing != nil && setting.ChooseOnePerWeek && !setting.UnlimitedOpen {
		return nil, newWelfareChestError(WelfareChestCodeAlreadyOpened, "You have already claimed a welfare chest this week")
	}

	unit := common.QuotaPerUnit
	if unit <= 0 {
		return nil, newWelfareChestError(WelfareChestCodeQuotaUnavailable, "Quota configuration is temporarily unavailable")
	}

	rnd := rand.New(rand.NewSource(time.Now().UnixNano() ^ int64(userId)<<13))
	rewardQuota := int(welfareChestRewardUSD(box, rnd)*unit + 0.5)
	if rewardQuota <= 0 {
		rewardQuota = 1
	}

	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	if setting.MaxQuotaLimit > 0 && user.Quota+rewardQuota > setting.MaxQuotaLimit {
		return nil, newWelfareChestError(WelfareChestCodeQuotaExceeded, "Your quota has reached the maximum limit")
	}

	_, _, weekKey := WelfareWeekRange(time.Now())
	claim := &WelfareChestClaim{
		UserId:         userId,
		WeekKey:        weekKey,
		Chest:          chestKey,
		RewardQuota:    rewardQuota,
		RewardUSD:      float64(rewardQuota) / unit,
		ConsumptionUSD: consumption,
		CreatedAt:      time.Now().Unix(),
	}

	var newQuota int
	err = DB.Transaction(func(tx *gorm.DB) error {
		// 唯一索引 (user_id, week_key) 防止并发重复领取
		if err := tx.Create(claim).Error; err != nil {
			return newWelfareChestError(WelfareChestCodeAlreadyOpened, "You have already claimed a welfare chest this week")
		}
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", rewardQuota)).Error; err != nil {
			return err
		}
		return tx.Model(&User{}).Where("id = ?", userId).Select("quota").Scan(&newQuota).Error
	})
	if err != nil {
		return nil, err
	}

	go func() {
		_ = cacheIncrUserQuota(userId, int64(rewardQuota))
	}()

	return &WelfareChestOpenResult{
		Chest:                chestKey,
		RewardUSD:            float64(rewardQuota) / unit,
		RewardQuota:          rewardQuota,
		WeeklyConsumptionUSD: consumption,
		NewQuota:             newQuota,
		WeekKey:              weekKey,
	}, nil
}

// WelfareChestRankItem 榜单条目
type WelfareChestRankItem struct {
	Rank     int     `json:"rank"`
	UserId   int     `json:"user_id"`
	Username string  `json:"username"`
	Award    float64 `json:"award"` // 美元
	IsMe     bool    `json:"is_me"`
}

// WelfareChestRankBoard 榜单
type WelfareChestRankBoard struct {
	Items []WelfareChestRankItem `json:"items"`
	Me    *WelfareChestRankItem  `json:"me"`
}

// GetWelfareChestRanking 本周各宝箱的开箱奖励榜
func GetWelfareChestRanking(userId int, limit int) (map[string]*WelfareChestRankBoard, error) {
	if limit <= 0 {
		limit = 10
	}
	_, _, weekKey := WelfareWeekRange(time.Now())
	out := map[string]*WelfareChestRankBoard{
		"xiaoshuai_ge": {Items: []WelfareChestRankItem{}},
		"hei_dashuai":  {Items: []WelfareChestRankItem{}},
	}

	type row struct {
		UserId    int
		RewardUSD float64
	}

	for _, key := range []string{"xiaoshuai_ge", "hei_dashuai"} {
		var rows []row
		err := DB.Model(&WelfareChestClaim{}).
			Select("user_id, reward_usd").
			Where("week_key = ? AND chest = ?", weekKey, key).
			Order("reward_usd desc").
			Limit(limit).
			Scan(&rows).Error
		if err != nil {
			return nil, err
		}
		board := out[key]
		for i, r := range rows {
			name, _ := GetUsernameById(r.UserId, false)
			board.Items = append(board.Items, WelfareChestRankItem{
				Rank:     i + 1,
				UserId:   r.UserId,
				Username: name,
				Award:    r.RewardUSD,
				IsMe:     r.UserId == userId,
			})
		}

		var mine WelfareChestClaim
		q := DB.Where("week_key = ? AND chest = ? AND user_id = ?", weekKey, key, userId).First(&mine)
		if q.Error == nil {
			var better int64
			DB.Model(&WelfareChestClaim{}).
				Where("week_key = ? AND chest = ? AND reward_usd > ?", weekKey, key, mine.RewardUSD).
				Count(&better)
			name, _ := GetUsernameById(userId, false)
			board.Me = &WelfareChestRankItem{
				Rank:     int(better) + 1,
				UserId:   userId,
				Username: name,
				Award:    mine.RewardUSD,
				IsMe:     true,
			}
		}
	}
	return out, nil
}
