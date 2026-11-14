package model

import (
	"errors"
	"fmt"
	"math"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 幸运大转盘
// ---------------------------------------------------------------------------

// 奖品发放方式
const (
	WheelPrizeTypeNone           = "none"            // 谢谢参与
	WheelPrizeTypeQuota          = "quota"           // 本站额度
	WheelPrizeTypeCardKey        = "card_key"        // 虚拟卡密（后台预置卡密池）
	WheelPrizeTypeRedemptionCode = "redemption_code" // 本站兑换码
	WheelPrizeTypePhysical       = "physical"        // 实物奖品
	WheelPrizeTypeSubscription   = "subscription"    // 本站订阅套餐
)

// 中奖记录状态
const (
	WheelWinStatusPending   = "pending"   // 待领取 / 待发货
	WheelWinStatusDelivered = "delivered" // 已发放
	WheelWinStatusShipped   = "shipped"   // 已发货
	WheelWinStatusCancelled = "cancelled" // 已作废
)

// 卡密状态
const (
	WheelCodeStatusAvailable = "available"
	WheelCodeStatusUsed      = "used"
)

// WheelStockUnlimited 不限量库存的哨兵值
const WheelStockUnlimited = -1

// WheelChanceMaxPercent 单个奖品可设置的中奖概率上限（百分比点数）
const WheelChanceMaxPercent = 100.0

// WheelPrize 转盘奖品
type WheelPrize struct {
	Id   int    `json:"id" gorm:"primaryKey;autoIncrement"`
	Name string `json:"name" gorm:"type:varchar(64);not null"` // 展示名称
	Icon string `json:"icon" gorm:"type:varchar(255);default:''"`

	// Type 发放方式：none / quota / card_key / redemption_code / physical / subscription
	Type string `json:"type" gorm:"type:varchar(32);not null;default:'none'"`

	Label       string  `json:"label" gorm:"type:varchar(32);default:''"` // 角标文案，如「爆款」
	Description string  `json:"description" gorm:"type:varchar(255);default:''"`
	Color       string  `json:"color" gorm:"type:varchar(32);default:''"` // 扇区配色标识：gold / rose / mint / violet / sky / amber
	Weight      float64 `json:"weight" gorm:"not null;default:1"`         // 中奖权重

	// Stock 剩余库存，WheelStockUnlimited 表示不限量
	Stock int `json:"stock" gorm:"not null;default:0"`
	// IssuedCount 已发放次数
	IssuedCount int `json:"issued_count" gorm:"not null;default:0"`

	// QuotaValue 额度面额（quota / redemption_code 类型使用）
	QuotaValue int `json:"quota_value" gorm:"not null;default:0"`
	// PlanId 订阅套餐 ID（subscription 类型使用）
	PlanId int `json:"plan_id" gorm:"not null;default:0"`

	Enabled   bool  `json:"enabled"`
	SortOrder int   `json:"sort_order" gorm:"not null;default:0"`
	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (WheelPrize) TableName() string {
	return "wheel_prizes"
}

// WheelPrizeCode 卡密池
type WheelPrizeCode struct {
	Id       int    `json:"id" gorm:"primaryKey;autoIncrement"`
	PrizeId  int    `json:"prize_id" gorm:"not null;index:idx_wheel_code_prize_status,priority:1"`
	Code     string `json:"code" gorm:"type:varchar(255);not null"`
	Status   string `json:"status" gorm:"type:varchar(16);not null;default:'available';index:idx_wheel_code_prize_status,priority:2"`
	WinId    int    `json:"win_id" gorm:"not null;default:0"`
	UserId   int    `json:"user_id" gorm:"not null;default:0;index"`
	UsedAt   int64  `json:"used_at" gorm:"bigint;not null;default:0"`
	CreateAt int64  `json:"created_at" gorm:"bigint"`
}

func (WheelPrizeCode) TableName() string {
	return "wheel_prize_codes"
}

// WheelWin 中奖记录（一次抽奖一行）
type WheelWin struct {
	Id       int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId   int    `json:"user_id" gorm:"not null;index;index:idx_wheel_user_date,priority:1"`
	PrizeId  int    `json:"prize_id" gorm:"not null;index"`
	DrawDate string `json:"draw_date" gorm:"type:varchar(10);not null;index;index:idx_wheel_user_date,priority:2"`

	// 中奖快照，奖品被改名或删除后记录仍然可读
	PrizeName  string `json:"prize_name" gorm:"type:varchar(64);not null;default:''"`
	PrizeIcon  string `json:"prize_icon" gorm:"type:varchar(255);default:''"`
	PrizeType  string `json:"prize_type" gorm:"type:varchar(32);not null;default:'none'"`
	QuotaValue int    `json:"quota_value" gorm:"not null;default:0"`
	PlanId     int    `json:"plan_id" gorm:"not null;default:0"`
	PlanTitle  string `json:"plan_title" gorm:"type:varchar(128);default:''"`

	Status string `json:"status" gorm:"type:varchar(16);not null;default:'pending';index"`

	// 兑换码 / 卡密
	Code         string `json:"code" gorm:"type:varchar(255);default:''"`
	RedemptionId int    `json:"redemption_id" gorm:"not null;default:0"`

	// 实物收货信息
	ReceiverName    string `json:"receiver_name" gorm:"type:varchar(64);default:''"`
	ReceiverPhone   string `json:"receiver_phone" gorm:"type:varchar(32);default:''"`
	ReceiverAddress string `json:"receiver_address" gorm:"type:varchar(255);default:''"`
	TrackingNo      string `json:"tracking_no" gorm:"type:varchar(64);default:''"`
	Note            string `json:"note" gorm:"type:varchar(255);default:''"`

	IsFree    bool  `json:"is_free"`
	CostQuota int   `json:"cost_quota" gorm:"not null;default:0"`
	CreatedAt int64 `json:"created_at" gorm:"bigint;index"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`

	DeliveredAt int64 `json:"delivered_at" gorm:"bigint;not null;default:0"`
	ShippedAt   int64 `json:"shipped_at" gorm:"bigint;not null;default:0"`
}

func (WheelWin) TableName() string {
	return "wheel_wins"
}

// wheelToday 返回本地时区下的今天（YYYY-MM-DD）
func wheelToday() string {
	return time.Now().Format("2006-01-02")
}

// wheelQuotaDisplay 把额度换算成展示金额字符串
func wheelQuotaDisplay(quota int) string {
	unit := common.QuotaPerUnit
	if unit <= 0 {
		return "0.00"
	}
	return fmt.Sprintf("%.2f", float64(quota)/unit)
}

// ---------------------------------------------------------------------------
// 奖品配置（后台）
// ---------------------------------------------------------------------------

// ListWheelPrizes 列出奖品，includeDisabled 为 false 时只返回启用的
func ListWheelPrizes(includeDisabled bool) ([]WheelPrize, error) {
	prizes := make([]WheelPrize, 0)
	q := DB.Model(&WheelPrize{})
	if !includeDisabled {
		q = q.Where("enabled = ?", true)
	}
	err := q.Order("sort_order asc").Order("id asc").Find(&prizes).Error
	return prizes, err
}

// GetWheelPrizeById 按 ID 查奖品
func GetWheelPrizeById(id int) (*WheelPrize, error) {
	if id <= 0 {
		return nil, common.NewMessage("Invalid prize ID")
	}
	prize := &WheelPrize{}
	if err := DB.First(prize, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, common.NewMessage("Prize not found")
		}
		return nil, err
	}
	return prize, nil
}

// NormalizeWheelPrize 收敛并校验奖品字段
func NormalizeWheelPrize(prize *WheelPrize) error {
	prize.Name = strings.TrimSpace(prize.Name)
	prize.Icon = strings.TrimSpace(prize.Icon)
	prize.Label = strings.TrimSpace(prize.Label)
	prize.Description = strings.TrimSpace(prize.Description)
	prize.Color = strings.TrimSpace(prize.Color)

	if prize.Name == "" {
		return common.NewMessage("Prize name cannot be empty")
	}
	if len([]rune(prize.Name)) > 64 {
		return common.NewMessage("Prize name must be at most 64 characters")
	}
	if prize.Weight < 0 || prize.Weight > WheelChanceMaxPercent {
		return common.NewMessage("Prize chance must be between 0 and 100")
	}
	if prize.Stock < WheelStockUnlimited {
		return common.NewMessage("Prize stock cannot be less than -1")
	}

	switch prize.Type {
	case WheelPrizeTypeNone:
		// 谢谢参与不需要面额、套餐与库存
		prize.QuotaValue = 0
		prize.PlanId = 0
		prize.Stock = WheelStockUnlimited
	case WheelPrizeTypeQuota, WheelPrizeTypeRedemptionCode:
		if prize.QuotaValue <= 0 {
			return common.NewMessage("Prize amount must be greater than zero")
		}
		if err := common.ValidateWalletQuota(prize.QuotaValue); err != nil {
			return err
		}
		prize.PlanId = 0
	case WheelPrizeTypeSubscription:
		if prize.PlanId <= 0 {
			return common.NewMessage("Select a subscription plan for this prize")
		}
		plan, err := GetSubscriptionPlanById(prize.PlanId)
		if err != nil {
			return common.NewMessage("Subscription plan not found")
		}
		prize.QuotaValue = 0
		if prize.Label == "" {
			prize.Label = plan.Title
		}
	case WheelPrizeTypeCardKey:
		// 卡密库存由卡密池自动维护，这里不允许手动设为不限量
		if prize.Stock == WheelStockUnlimited {
			var available int64
			if err := DB.Model(&WheelPrizeCode{}).
				Where("prize_id = ? AND status = ?", prize.Id, WheelCodeStatusAvailable).
				Count(&available).Error; err != nil {
				return err
			}
			prize.Stock = int(available)
		}
		prize.QuotaValue = 0
		prize.PlanId = 0
	case WheelPrizeTypePhysical:
		prize.QuotaValue = 0
		prize.PlanId = 0
	default:
		return common.NewMessage("Unsupported prize type")
	}

	if len([]rune(prize.Description)) > 255 {
		return common.NewMessage("Prize description must be at most 255 characters")
	}
	if len([]rune(prize.Label)) > 32 {
		return common.NewMessage("Prize label must be at most 32 characters")
	}
	return nil
}

// CreateWheelPrize 新建奖品
func CreateWheelPrize(prize *WheelPrize) error {
	if err := NormalizeWheelPrize(prize); err != nil {
		return err
	}
	now := common.GetTimestamp()
	prize.CreatedAt = now
	prize.UpdatedAt = now
	prize.IssuedCount = 0
	weight := prize.Weight
	if err := DB.Create(prize).Error; err != nil {
		return err
	}
	// 权重列带默认值，插入 0 会被默认值顶成 1；0 表示永不中奖，这里补一次显式写入
	if weight != 0 {
		return nil
	}
	if err := DB.Model(&WheelPrize{}).Where("id = ?", prize.Id).Update("weight", 0).Error; err != nil {
		return err
	}
	prize.Weight = 0
	return nil
}

// UpdateWheelPrize 更新奖品
func UpdateWheelPrize(prize *WheelPrize) error {
	if err := NormalizeWheelPrize(prize); err != nil {
		return err
	}
	prize.UpdatedAt = common.GetTimestamp()
	return DB.Model(&WheelPrize{}).Where("id = ?", prize.Id).Select(
		"name", "icon", "type", "label", "description", "color", "weight",
		"stock", "quota_value", "plan_id", "enabled", "sort_order", "updated_at",
	).Updates(prize).Error
}

// WheelPrizeChanceInput 一次提交的奖品中奖概率（百分比点数）
type WheelPrizeChanceInput struct {
	Id     int     `json:"id"`
	Weight float64 `json:"weight"`
}

// UpdateWheelPrizeChances 一次保存多个奖品的中奖概率。
// 保存的值直接作为权重，抽取时按合计归一化，所以合计不必等于 100%；
// 权重为 0 的奖品永远不会被抽中。
func UpdateWheelPrizeChances(items []WheelPrizeChanceInput) ([]WheelPrize, error) {
	if len(items) == 0 {
		return nil, common.NewMessage("Select at least one prize")
	}
	seen := make(map[int]struct{}, len(items))
	for _, item := range items {
		if item.Id <= 0 {
			return nil, common.NewMessage("Invalid prize ID")
		}
		if _, duplicate := seen[item.Id]; duplicate {
			return nil, common.NewMessage("Duplicate prize in the chance list")
		}
		seen[item.Id] = struct{}{}
		if math.IsNaN(item.Weight) || math.IsInf(item.Weight, 0) {
			return nil, common.NewMessage("Prize chance must be between 0 and 100")
		}
		if item.Weight < 0 || item.Weight > WheelChanceMaxPercent {
			return nil, common.NewMessage("Prize chance must be between 0 and 100")
		}
	}

	err := DB.Transaction(func(tx *gorm.DB) error {
		// MySQL 在值未变化时返回 RowsAffected=0，所以先确认奖品都存在，再逐条更新
		ids := make([]int, 0, len(items))
		for _, item := range items {
			ids = append(ids, item.Id)
		}
		var found int64
		if err := tx.Model(&WheelPrize{}).Where("id IN ?", ids).Count(&found).Error; err != nil {
			return err
		}
		if found != int64(len(items)) {
			return common.NewMessage("Prize not found")
		}

		now := common.GetTimestamp()
		for _, item := range items {
			if err := tx.Model(&WheelPrize{}).
				Where("id = ?", item.Id).
				Updates(map[string]any{"weight": item.Weight, "updated_at": now}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return ListWheelPrizes(true)
}

// DeleteWheelPrize 删除奖品；已发放过的奖品不允许删除，请改为停用
func DeleteWheelPrize(id int) error {
	var issued int64
	if err := DB.Model(&WheelWin{}).Where("prize_id = ?", id).Count(&issued).Error; err != nil {
		return err
	}
	if issued > 0 {
		return common.NewMessage("This prize has already been awarded; disable it instead of deleting")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("prize_id = ?", id).Delete(&WheelPrizeCode{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", id).Delete(&WheelPrize{}).Error
	})
}

// AdjustWheelPrizeStock 增减库存（不受限量奖品不允许调整）
func AdjustWheelPrizeStock(id int, delta int) (*WheelPrize, error) {
	prize, err := GetWheelPrizeById(id)
	if err != nil {
		return nil, err
	}
	if delta == 0 {
		return prize, nil
	}
	if prize.Stock == WheelStockUnlimited {
		return nil, common.NewMessage("This prize has unlimited stock")
	}
	if delta < 0 && prize.Stock+delta < 0 {
		return nil, common.NewMessage("Stock cannot be negative")
	}
	if err := DB.Model(&WheelPrize{}).Where("id = ?", id).
		UpdateColumn("stock", gorm.Expr("stock + ?", delta)).Error; err != nil {
		return nil, err
	}
	return GetWheelPrizeById(id)
}

// AddWheelPrizeCodes 批量导入卡密，返回新增数量
func AddWheelPrizeCodes(prizeId int, codes []string) (int, error) {
	prize, err := GetWheelPrizeById(prizeId)
	if err != nil {
		return 0, err
	}
	if prize.Type != WheelPrizeTypeCardKey {
		return 0, common.NewMessage("Only card key prizes accept card keys")
	}
	now := common.GetTimestamp()
	added := 0
	err = DB.Transaction(func(tx *gorm.DB) error {
		seen := make(map[string]struct{}, len(codes))
		for _, raw := range codes {
			code := strings.TrimSpace(raw)
			if code == "" {
				continue
			}
			if len(code) > 255 {
				continue
			}
			if _, dup := seen[code]; dup {
				continue
			}
			seen[code] = struct{}{}
			var exists int64
			if err := tx.Model(&WheelPrizeCode{}).
				Where("prize_id = ? AND code = ?", prizeId, code).
				Count(&exists).Error; err != nil {
				return err
			}
			if exists > 0 {
				continue
			}
			if err := tx.Create(&WheelPrizeCode{
				PrizeId:  prizeId,
				Code:     code,
				Status:   WheelCodeStatusAvailable,
				CreateAt: now,
			}).Error; err != nil {
				return err
			}
			added++
		}
		if added == 0 {
			return nil
		}
		return tx.Model(&WheelPrize{}).Where("id = ?", prizeId).
			UpdateColumn("stock", gorm.Expr("stock + ?", added)).Error
	})
	if err != nil {
		return 0, err
	}
	return added, nil
}

// ListWheelPrizeCodes 分页列出卡密
func ListWheelPrizeCodes(prizeId int, status string, page int, pageSize int) ([]WheelPrizeCode, int64, error) {
	if prizeId <= 0 {
		return nil, 0, common.NewMessage("Invalid prize ID")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 200 {
		pageSize = 20
	}
	q := DB.Model(&WheelPrizeCode{}).Where("prize_id = ?", prizeId)
	if status == WheelCodeStatusAvailable || status == WheelCodeStatusUsed {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	codes := make([]WheelPrizeCode, 0, pageSize)
	err := q.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).Find(&codes).Error
	return codes, total, err
}

// DeleteWheelPrizeCode 删除未被使用的卡密
func DeleteWheelPrizeCode(prizeId int, codeId int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var code WheelPrizeCode
		if err := tx.First(&code, "id = ? AND prize_id = ?", codeId, prizeId).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return common.NewMessage("Card key not found")
			}
			return err
		}
		if code.Status == WheelCodeStatusUsed {
			return common.NewMessage("A used card key cannot be deleted")
		}
		if err := tx.Delete(&code).Error; err != nil {
			return err
		}
		return tx.Model(&WheelPrize{}).
			Where("id = ? AND stock > 0", prizeId).
			UpdateColumn("stock", gorm.Expr("stock - 1")).Error
	})
}

// ---------------------------------------------------------------------------
// 用户抽奖
// ---------------------------------------------------------------------------

// GetUserWheelUsedToday 返回用户今日已使用的大转盘次数
func GetUserWheelUsedToday(userId int) (int, error) {
	var total int64
	err := DB.Model(&WheelWin{}).
		Where("user_id = ? AND draw_date = ?", userId, wheelToday()).
		Count(&total).Error
	return int(total), err
}

// WheelSpinResult 抽奖结果
type WheelSpinResult struct {
	WinId      int    `json:"win_id"`
	PrizeIndex int    `json:"prize_index"`
	PrizeId    int    `json:"prize_id"`
	PrizeName  string `json:"prize_name"`
	PrizeIcon  string `json:"prize_icon"`
	PrizeType  string `json:"prize_type"`
	PrizeLabel string `json:"prize_label"`
	Status     string `json:"status"`

	QuotaValue   int    `json:"quota_value"`
	QuotaDisplay string `json:"quota_display"`
	Code         string `json:"code"`
	PlanTitle    string `json:"plan_title"`
	NeedAddress  bool   `json:"need_address"`

	IsFree         bool   `json:"is_free"`
	CostQuota      int    `json:"cost_quota"`
	CostDisplay    string `json:"cost_display"`
	RemainingDraws int    `json:"remaining_draws"`
	DrawsUsedToday int    `json:"draws_used_today"`
	Quota          int    `json:"quota"`
	DrawDate       string `json:"draw_date"`
}

// wheelPrizeAvailable 奖品是否还有库存
func wheelPrizeAvailable(prize *WheelPrize) bool {
	if prize.Type == WheelPrizeTypeNone {
		return true
	}
	return prize.Stock == WheelStockUnlimited || prize.Stock > 0
}

// weightedPickWheelPrize 在候选奖品中按权重抽取下标，权重全为 0 时等概率
func weightedPickWheelPrize(prizes []WheelPrize, rnd *rand.Rand) int {
	if len(prizes) == 0 {
		return -1
	}
	total := 0.0
	for i := range prizes {
		if prizes[i].Weight > 0 {
			total += prizes[i].Weight
		}
	}
	if total <= 0 {
		return rnd.Intn(len(prizes))
	}
	r := rnd.Float64() * total
	acc := 0.0
	for i := range prizes {
		if prizes[i].Weight <= 0 {
			continue
		}
		acc += prizes[i].Weight
		if r < acc {
			return i
		}
	}
	for i := len(prizes) - 1; i >= 0; i-- {
		if prizes[i].Weight > 0 {
			return i
		}
	}
	return len(prizes) - 1
}

// consumeWheelPrizeTx 在新事务内占住一个奖品名额并按类型发放奖励。
// 返回 nil 表示该奖品已被抢空，调用方可继续尝试下一个候选奖品。
func consumeWheelPrizeTx(tx *gorm.DB, prize *WheelPrize, win *WheelWin, userId int, now int64) (*WheelWin, error) {
	setting := operation_setting.GetWheelSetting()

	// 卡密奖品先确认池子里还有可用卡密，避免占住库存后发不出来
	if prize.Type == WheelPrizeTypeCardKey {
		var available int64
		if err := tx.Model(&WheelPrizeCode{}).
			Where("prize_id = ? AND status = ?", prize.Id, WheelCodeStatusAvailable).
			Count(&available).Error; err != nil {
			return nil, err
		}
		if available <= 0 {
			return nil, nil
		}
	}

	// 条件更新保证并发下不会超发
	res := tx.Model(&WheelPrize{}).
		Where("id = ? AND (stock = ? OR stock > 0)", prize.Id, WheelStockUnlimited).
		Updates(map[string]any{
			"stock":        gorm.Expr("CASE WHEN stock = ? THEN stock ELSE stock - 1 END", WheelStockUnlimited),
			"issued_count": gorm.Expr("issued_count + 1"),
		})
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, nil
	}

	win.Status = WheelWinStatusDelivered

	switch prize.Type {
	case WheelPrizeTypeNone:
		win.Status = WheelWinStatusDelivered
	case WheelPrizeTypeQuota:
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", prize.QuotaValue)).Error; err != nil {
			return nil, err
		}
		win.DeliveredAt = now
	case WheelPrizeTypeRedemptionCode:
		expiredAt := int64(0)
		if setting.RedemptionExpireDays > 0 {
			expiredAt = now + int64(setting.RedemptionExpireDays)*24*3600
		}
		redemption := &Redemption{
			UserId:      userId,
			Key:         common.GetUUID(),
			Status:      common.RedemptionCodeStatusEnabled,
			Name:        "Lucky wheel: " + prize.Name,
			Quota:       prize.QuotaValue,
			CreatedTime: now,
			ExpiredTime: expiredAt,
		}
		if err := tx.Create(redemption).Error; err != nil {
			return nil, err
		}
		win.Code = redemption.Key
		win.RedemptionId = redemption.Id
		win.DeliveredAt = now
	case WheelPrizeTypeCardKey:
		var code WheelPrizeCode
		if err := lockForUpdate(tx).
			Where("prize_id = ? AND status = ?", prize.Id, WheelCodeStatusAvailable).
			Order("id asc").First(&code).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				// 释放刚占住的库存
				if err := tx.Model(&WheelPrize{}).Where("id = ?", prize.Id).Updates(map[string]any{
					"stock":        gorm.Expr("stock + 1"),
					"issued_count": gorm.Expr("issued_count - 1"),
				}).Error; err != nil {
					return nil, err
				}
				return nil, nil
			}
			return nil, err
		}
		updated := tx.Model(&WheelPrizeCode{}).
			Where("id = ? AND status = ?", code.Id, WheelCodeStatusAvailable).
			Updates(map[string]any{
				"status":  WheelCodeStatusUsed,
				"user_id": userId,
				"used_at": now,
			})
		if updated.Error != nil {
			return nil, updated.Error
		}
		if updated.RowsAffected == 0 {
			if err := tx.Model(&WheelPrize{}).Where("id = ?", prize.Id).Updates(map[string]any{
				"stock":        gorm.Expr("stock + 1"),
				"issued_count": gorm.Expr("issued_count - 1"),
			}).Error; err != nil {
				return nil, err
			}
			return nil, nil
		}
		win.Code = code.Code
		win.DeliveredAt = now
	case WheelPrizeTypePhysical:
		// 实物奖品等待中奖用户填写收货信息，之后由后台发货
		win.Status = WheelWinStatusPending
	case WheelPrizeTypeSubscription:
		plan, err := getSubscriptionPlanByIdTx(tx, prize.PlanId)
		if err != nil {
			return nil, common.NewMessage("Subscription plan not found")
		}
		sub, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "lottery")
		if err != nil {
			return nil, err
		}
		win.PlanId = plan.Id
		win.PlanTitle = plan.Title
		win.Status = WheelWinStatusDelivered
		win.DeliveredAt = now
		win.Note = fmt.Sprintf("subscription #%d", sub.Id)
	default:
		return nil, common.NewMessage("Unsupported prize type")
	}

	return win, nil
}

// UserWheelSpin 执行一次大转盘抽奖
//
// 规则：每日前 DailyFreeDraws 次免费；此后每次消耗 SingleCostQuota；
// DailyDrawLimit 大于 0 时限制每人每日总次数。
func UserWheelSpin(userId int) (*WheelSpinResult, error) {
	setting := operation_setting.GetWheelSetting()
	if !setting.Enabled {
		return nil, common.NewMessage("Lucky wheel is not enabled")
	}

	prizes, err := ListWheelPrizes(false)
	if err != nil {
		return nil, err
	}
	if len(prizes) == 0 {
		return nil, common.NewMessage("The lucky wheel has no prize configured")
	}

	usedToday, err := GetUserWheelUsedToday(userId)
	if err != nil {
		return nil, err
	}
	if setting.DailyDrawLimit > 0 && usedToday >= setting.DailyDrawLimit {
		return nil, common.NewMessage("You have reached today's draw limit")
	}

	freeLeft := setting.DailyFreeDraws - usedToday
	isFree := freeLeft > 0
	cost := 0
	if !isFree {
		cost = setting.SingleCostQuota
	}

	drawDate := wheelToday()
	now := common.GetTimestamp()
	rnd := rand.New(rand.NewSource(time.Now().UnixNano() ^ int64(userId)<<17))
	tried := make(map[int]struct{}, len(prizes))

	var finalQuota int
	var win *WheelWin
	var picked *WheelPrize

	err = DB.Transaction(func(tx *gorm.DB) error {
		if cost > 0 {
			res := tx.Model(&User{}).
				Where("id = ? AND quota >= ?", userId, cost).
				Update("quota", gorm.Expr("quota - ?", cost))
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return common.NewMessage("Insufficient quota")
			}
		}

		for range prizes {
			candidates := make([]WheelPrize, 0, len(prizes))
			for i := range prizes {
				if _, done := tried[prizes[i].Id]; done {
					continue
				}
				if !wheelPrizeAvailable(&prizes[i]) {
					tried[prizes[i].Id] = struct{}{}
					continue
				}
				candidates = append(candidates, prizes[i])
			}
			if len(candidates) == 0 {
				return common.NewMessage("All prizes have been claimed, please try again later")
			}
			pick := weightedPickWheelPrize(candidates, rnd)
			if pick < 0 {
				return common.NewMessage("All prizes have been claimed, please try again later")
			}
			candidate := candidates[pick]

			record := &WheelWin{
				UserId:     userId,
				PrizeId:    candidate.Id,
				DrawDate:   drawDate,
				PrizeName:  candidate.Name,
				PrizeIcon:  candidate.Icon,
				PrizeType:  candidate.Type,
				QuotaValue: candidate.QuotaValue,
				PlanId:     candidate.PlanId,
				IsFree:     isFree,
				CostQuota:  cost,
				CreatedAt:  now,
				UpdatedAt:  now,
			}
			delivered, err := consumeWheelPrizeTx(tx, &candidate, record, userId, now)
			if err != nil {
				return err
			}
			if delivered == nil {
				tried[candidate.Id] = struct{}{}
				continue
			}
			if err := tx.Create(delivered).Error; err != nil {
				return err
			}
			win = delivered
			picked = &candidate
			break
		}

		if win == nil || picked == nil {
			return common.NewMessage("All prizes have been claimed, please try again later")
		}

		return tx.Model(&User{}).Where("id = ?", userId).Select("quota").Scan(&finalQuota).Error
	})
	if err != nil {
		return nil, err
	}

	delta := int64(0)
	if picked.Type == WheelPrizeTypeQuota {
		delta += int64(picked.QuotaValue)
	}
	delta -= int64(cost)
	if delta != 0 {
		if err := cacheIncrUserQuota(userId, delta); err != nil {
			common.SysError(common.LogText("failed to refresh user quota cache for user %d: %v", userId, err))
		}
	}
	if picked.Type == WheelPrizeTypeSubscription {
		refreshSubscriptionUserGroupCache(userId, "lucky wheel subscription prize")
	}

	prizeIndex := 0
	for i := range prizes {
		if prizes[i].Id == picked.Id {
			prizeIndex = i
			break
		}
	}

	remaining := setting.DailyFreeDraws - usedToday - 1
	if remaining < 0 {
		remaining = 0
	}

	return &WheelSpinResult{
		WinId:          win.Id,
		PrizeIndex:     prizeIndex,
		PrizeId:        picked.Id,
		PrizeName:      picked.Name,
		PrizeIcon:      picked.Icon,
		PrizeType:      picked.Type,
		PrizeLabel:     picked.Label,
		Status:         win.Status,
		QuotaValue:     picked.QuotaValue,
		QuotaDisplay:   wheelQuotaDisplay(picked.QuotaValue),
		Code:           win.Code,
		PlanTitle:      win.PlanTitle,
		NeedAddress:    picked.Type == WheelPrizeTypePhysical,
		IsFree:         isFree,
		CostQuota:      cost,
		CostDisplay:    wheelQuotaDisplay(cost),
		RemainingDraws: remaining,
		DrawsUsedToday: usedToday + 1,
		Quota:          finalQuota,
		DrawDate:       drawDate,
	}, nil
}

// ---------------------------------------------------------------------------
// 查询：状态、记录、概览
// ---------------------------------------------------------------------------

// WheelPrizeView 用户侧展示的奖品
type WheelPrizeView struct {
	Id           int    `json:"id"`
	Name         string `json:"name"`
	Icon         string `json:"icon"`
	Label        string `json:"label"`
	Description  string `json:"description"`
	Type         string `json:"type"`
	Color        string `json:"color"`
	Quota        int    `json:"quota"`
	QuotaDisplay string `json:"quota_display"`
	PlanId       int    `json:"plan_id"`
	PlanTitle    string `json:"plan_title"`
	Stock        int    `json:"stock"`
	Available    bool   `json:"available"`
}

// wheelPlanTitles 一次查出多个套餐标题，避免每个订阅奖品各查一次。
func wheelPlanTitles(planIds []int) map[int]string {
	titles := make(map[int]string, len(planIds))
	ids := make([]int, 0, len(planIds))
	seen := make(map[int]struct{}, len(planIds))
	for _, id := range planIds {
		if id <= 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) == 0 {
		return titles
	}
	type planTitleRow struct {
		Id    int
		Title string
	}
	rows := make([]planTitleRow, 0, len(ids))
	if err := DB.Model(&SubscriptionPlan{}).Select("id, title").Where("id IN ?", ids).Scan(&rows).Error; err != nil {
		return titles
	}
	for _, row := range rows {
		titles[row.Id] = row.Title
	}
	return titles
}

// wheelUsernames 批量取用户名：命中缓存的不再查库，其余一次 IN 查询。
func wheelUsernames(userIds []int) map[int]string {
	names := make(map[int]string, len(userIds))
	missing := make([]int, 0, len(userIds))
	seen := make(map[int]struct{}, len(userIds))
	for _, id := range userIds {
		if id <= 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		if common.RedisEnabled {
			if name, err := getUserNameCache(id); err == nil {
				names[id] = name
				continue
			}
		}
		missing = append(missing, id)
	}
	if len(missing) == 0 {
		return names
	}
	type userNameRow struct {
		Id       int
		Username string
	}
	rows := make([]userNameRow, 0, len(missing))
	if err := DB.Model(&User{}).Select("id, username").Where("id IN ?", missing).Scan(&rows).Error; err != nil {
		return names
	}
	for _, row := range rows {
		names[row.Id] = row.Username
	}
	return names
}

// GetWheelStatus 大转盘页面所需的用户状态
func GetWheelStatus(userId int) (map[string]any, error) {
	setting := operation_setting.GetWheelSetting()

	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	usedToday, err := GetUserWheelUsedToday(userId)
	if err != nil {
		return nil, err
	}
	prizes, err := ListWheelPrizes(false)
	if err != nil {
		return nil, err
	}

	views := make([]WheelPrizeView, 0, len(prizes))
	planIds := make([]int, 0, len(prizes))
	for i := range prizes {
		planIds = append(planIds, prizes[i].PlanId)
	}
	planTitles := wheelPlanTitles(planIds)
	for i := range prizes {
		prize := &prizes[i]
		views = append(views, WheelPrizeView{
			Id:           prize.Id,
			Name:         prize.Name,
			Icon:         prize.Icon,
			Label:        prize.Label,
			Description:  prize.Description,
			Type:         prize.Type,
			Color:        prize.Color,
			Quota:        prize.QuotaValue,
			QuotaDisplay: wheelQuotaDisplay(prize.QuotaValue),
			PlanId:       prize.PlanId,
			PlanTitle:    planTitles[prize.PlanId],
			Stock:        prize.Stock,
			Available:    wheelPrizeAvailable(prize),
		})
	}

	remaining := setting.DailyFreeDraws - usedToday
	if remaining < 0 {
		remaining = 0
	}
	limitReached := setting.DailyDrawLimit > 0 && usedToday >= setting.DailyDrawLimit

	var todayWins int64
	if err := DB.Model(&WheelWin{}).
		Where("user_id = ? AND draw_date = ?", userId, wheelToday()).
		Count(&todayWins).Error; err != nil {
		return nil, err
	}
	var todayQuota int64
	if err := DB.Model(&WheelWin{}).
		Where("user_id = ? AND draw_date = ? AND prize_type = ?", userId, wheelToday(), WheelPrizeTypeQuota).
		Select("COALESCE(SUM(quota_value), 0)").Scan(&todayQuota).Error; err != nil {
		return nil, err
	}
	var totalWins int64
	if err := DB.Model(&WheelWin{}).Where("user_id = ?", userId).Count(&totalWins).Error; err != nil {
		return nil, err
	}

	return map[string]any{
		"enabled":                setting.Enabled,
		"title":                  setting.Title,
		"subtitle":               setting.Subtitle,
		"rules_text":             setting.RulesText,
		"quota":                  user.Quota,
		"quota_per_unit":         common.QuotaPerUnit,
		"daily_free_draws":       setting.DailyFreeDraws,
		"daily_draw_limit":       setting.DailyDrawLimit,
		"remaining_draws":        remaining,
		"draws_used_today":       usedToday,
		"draw_date":              wheelToday(),
		"single_cost":            setting.SingleCostQuota,
		"single_cost_display":    wheelQuotaDisplay(setting.SingleCostQuota),
		"can_spin":               setting.Enabled && len(views) > 0 && !limitReached,
		"prizes":                 views,
		"today_win_count":        todayWins,
		"today_prize_quota":      todayQuota,
		"today_prize_display":    wheelQuotaDisplay(int(todayQuota)),
		"total_win_count":        totalWins,
		"show_public_wins":       setting.ShowPublicWins,
		"redemption_expire_days": setting.RedemptionExpireDays,
	}, nil
}

// WheelWinView 中奖记录视图
type WheelWinView struct {
	Id           int    `json:"id"`
	UserId       int    `json:"user_id"`
	Username     string `json:"username"`
	PrizeId      int    `json:"prize_id"`
	PrizeName    string `json:"prize_name"`
	PrizeIcon    string `json:"prize_icon"`
	PrizeType    string `json:"prize_type"`
	Status       string `json:"status"`
	QuotaValue   int    `json:"quota_value"`
	QuotaDisplay string `json:"quota_display"`
	PlanTitle    string `json:"plan_title"`
	Code         string `json:"code"`
	TrackingNo   string `json:"tracking_no"`
	Note         string `json:"note"`
	DrawDate     string `json:"draw_date"`
	CreatedAt    int64  `json:"created_at"`
	ShippedAt    int64  `json:"shipped_at"`
	// 收货信息只在用户本人和后台可见
	ReceiverName    string `json:"receiver_name"`
	ReceiverPhone   string `json:"receiver_phone"`
	ReceiverAddress string `json:"receiver_address"`
	HasAddress      bool   `json:"has_address"`
}

// wheelMaskName 中奖动态里隐藏用户名中间部分
func wheelMaskName(name string) string {
	runes := []rune(name)
	if len(runes) <= 2 {
		return string(runes) + "***"
	}
	return string(runes[:2]) + "***" + string(runes[len(runes)-1:])
}

// buildWheelWinViews 把中奖记录转成视图；maskName 为 true 时隐藏用户名
func buildWheelWinViews(wins []WheelWin, withUsername bool, maskName bool) []WheelWinView {
	views := make([]WheelWinView, 0, len(wins))
	usernames := map[int]string{}
	if withUsername {
		userIds := make([]int, 0, len(wins))
		for i := range wins {
			userIds = append(userIds, wins[i].UserId)
		}
		usernames = wheelUsernames(userIds)
	}
	for i := range wins {
		win := &wins[i]
		view := WheelWinView{
			Id:              win.Id,
			UserId:          win.UserId,
			PrizeId:         win.PrizeId,
			PrizeName:       win.PrizeName,
			PrizeIcon:       win.PrizeIcon,
			PrizeType:       win.PrizeType,
			Status:          win.Status,
			QuotaValue:      win.QuotaValue,
			QuotaDisplay:    wheelQuotaDisplay(win.QuotaValue),
			PlanTitle:       win.PlanTitle,
			Code:            win.Code,
			TrackingNo:      win.TrackingNo,
			Note:            win.Note,
			DrawDate:        win.DrawDate,
			CreatedAt:       win.CreatedAt,
			ShippedAt:       win.ShippedAt,
			ReceiverName:    win.ReceiverName,
			ReceiverPhone:   win.ReceiverPhone,
			ReceiverAddress: win.ReceiverAddress,
			HasAddress:      win.ReceiverName != "" && win.ReceiverAddress != "",
		}
		if withUsername {
			view.Username = usernames[win.UserId]
			if maskName {
				view.Username = wheelMaskName(view.Username)
			}
		}
		views = append(views, view)
	}
	return views
}

// ListMyWheelWins 用户自己的中奖记录
func ListMyWheelWins(userId int, page int, pageSize int) ([]WheelWinView, int64, error) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 10
	}
	q := DB.Model(&WheelWin{}).Where("user_id = ?", userId)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	wins := make([]WheelWin, 0, pageSize)
	if err := q.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).Find(&wins).Error; err != nil {
		return nil, 0, err
	}
	return buildWheelWinViews(wins, false, false), total, nil
}

// WheelWinQuery 后台中奖记录筛选条件
type WheelWinQuery struct {
	Keyword   string
	Status    string
	PrizeId   int
	PrizeType string
	Page      int
	PageSize  int
}

// ListWheelWins 后台中奖记录
func ListWheelWins(query WheelWinQuery) ([]WheelWinView, int64, error) {
	page := query.Page
	if page <= 0 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 || pageSize > 200 {
		pageSize = 20
	}

	q := DB.Model(&WheelWin{})
	if query.Status != "" {
		q = q.Where("status = ?", query.Status)
	}
	if query.PrizeId > 0 {
		q = q.Where("prize_id = ?", query.PrizeId)
	}
	if query.PrizeType != "" {
		q = q.Where("prize_type = ?", query.PrizeType)
	}
	if query.Keyword != "" {
		userId, err := strconv.Atoi(query.Keyword)
		if err == nil {
			q = q.Where("user_id = ? OR prize_name LIKE ?", userId, query.Keyword+"%")
		} else {
			q = q.Where("prize_name LIKE ? OR code LIKE ? OR tracking_no LIKE ?",
				query.Keyword+"%", query.Keyword+"%", query.Keyword+"%")
		}
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	wins := make([]WheelWin, 0, pageSize)
	if err := q.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).Find(&wins).Error; err != nil {
		return nil, 0, err
	}
	return buildWheelWinViews(wins, true, false), total, nil
}

// GetWheelPublicWins 公开中奖动态
func GetWheelPublicWins(limit int) ([]WheelWinView, error) {
	setting := operation_setting.GetWheelSetting()
	if !setting.ShowPublicWins {
		return []WheelWinView{}, nil
	}
	if limit <= 0 {
		limit = setting.PublicWinsLimit
	}
	if limit <= 0 || limit > 50 {
		limit = 12
	}
	wins := make([]WheelWin, 0, limit)
	err := DB.Where("prize_type <> ?", WheelPrizeTypeNone).
		Order("id desc").Limit(limit).Find(&wins).Error
	if err != nil {
		return nil, err
	}
	return buildWheelWinViews(wins, true, true), nil
}

// SubmitWheelWinAddress 中奖用户填写实物收货信息
func SubmitWheelWinAddress(userId int, winId int, receiverName string, receiverPhone string, receiverAddress string) (*WheelWinView, error) {
	receiverName = strings.TrimSpace(receiverName)
	receiverPhone = strings.TrimSpace(receiverPhone)
	receiverAddress = strings.TrimSpace(receiverAddress)
	if receiverName == "" || receiverPhone == "" || receiverAddress == "" {
		return nil, common.NewMessage("Fill in the recipient name, phone number and address")
	}
	if len([]rune(receiverName)) > 64 || len([]rune(receiverPhone)) > 32 || len([]rune(receiverAddress)) > 255 {
		return nil, common.NewMessage("Shipping information is too long")
	}

	var win WheelWin
	if err := DB.First(&win, "id = ? AND user_id = ?", winId, userId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, common.NewMessage("Prize record not found")
		}
		return nil, err
	}
	if win.PrizeType != WheelPrizeTypePhysical {
		return nil, common.NewMessage("This prize does not need a shipping address")
	}
	if win.Status == WheelWinStatusShipped {
		return nil, common.NewMessage("This prize has already been shipped")
	}
	if win.Status == WheelWinStatusCancelled {
		return nil, common.NewMessage("This prize record has been cancelled")
	}

	err := DB.Model(&WheelWin{}).Where("id = ?", win.Id).Updates(map[string]any{
		"receiver_name":    receiverName,
		"receiver_phone":   receiverPhone,
		"receiver_address": receiverAddress,
		"updated_at":       common.GetTimestamp(),
	}).Error
	if err != nil {
		return nil, err
	}
	win.ReceiverName = receiverName
	win.ReceiverPhone = receiverPhone
	win.ReceiverAddress = receiverAddress
	views := buildWheelWinViews([]WheelWin{win}, false, false)
	return &views[0], nil
}

// ShipWheelWin 后台标记发货
func ShipWheelWin(winId int, trackingNo string, note string) error {
	trackingNo = strings.TrimSpace(trackingNo)
	note = strings.TrimSpace(note)
	if len([]rune(trackingNo)) > 64 || len([]rune(note)) > 255 {
		return common.NewMessage("Shipping information is too long")
	}

	var win WheelWin
	if err := DB.First(&win, "id = ?", winId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return common.NewMessage("Prize record not found")
		}
		return err
	}
	if win.PrizeType != WheelPrizeTypePhysical {
		return common.NewMessage("Only physical prizes can be shipped")
	}
	if win.Status == WheelWinStatusCancelled {
		return common.NewMessage("This prize record has been cancelled")
	}
	if win.ReceiverAddress == "" {
		return common.NewMessage("The winner has not filled in the shipping address yet")
	}

	now := common.GetTimestamp()
	return DB.Model(&WheelWin{}).Where("id = ?", winId).Updates(map[string]any{
		"status":      WheelWinStatusShipped,
		"tracking_no": trackingNo,
		"note":        note,
		"shipped_at":  now,
		"updated_at":  now,
	}).Error
}

// DeliverWheelWin 后台手动把记录标记为已发放（例如线下发货、人工补发卡密）
func DeliverWheelWin(winId int, note string, code string) error {
	note = strings.TrimSpace(note)
	code = strings.TrimSpace(code)
	if len([]rune(note)) > 255 || len([]rune(code)) > 255 {
		return common.NewMessage("Remark is too long")
	}

	var win WheelWin
	if err := DB.First(&win, "id = ?", winId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return common.NewMessage("Prize record not found")
		}
		return err
	}
	if win.Status == WheelWinStatusCancelled {
		return common.NewMessage("This prize record has been cancelled")
	}

	now := common.GetTimestamp()
	updates := map[string]any{
		"status":       WheelWinStatusDelivered,
		"note":         note,
		"delivered_at": now,
		"updated_at":   now,
	}
	if code != "" {
		updates["code"] = code
	}
	return DB.Model(&WheelWin{}).Where("id = ?", winId).Updates(updates).Error
}

// CancelWheelWin 后台作废中奖记录（不回收已发放的额度）
func CancelWheelWin(winId int, note string) error {
	note = strings.TrimSpace(note)
	if len([]rune(note)) > 255 {
		return common.NewMessage("Remark is too long")
	}
	var win WheelWin
	if err := DB.First(&win, "id = ?", winId).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return common.NewMessage("Prize record not found")
		}
		return err
	}
	return DB.Model(&WheelWin{}).Where("id = ?", winId).Updates(map[string]any{
		"status":     WheelWinStatusCancelled,
		"note":       note,
		"updated_at": common.GetTimestamp(),
	}).Error
}

// WheelPrizeStat 概览里的单个奖品统计
type WheelPrizeStat struct {
	Id           int    `json:"id"`
	Name         string `json:"name"`
	Icon         string `json:"icon"`
	Type         string `json:"type"`
	Enabled      bool   `json:"enabled"`
	Stock        int    `json:"stock"`
	IssuedCount  int    `json:"issued_count"`
	TodayIssued  int64  `json:"today_issued"`
	QuotaValue   int    `json:"quota_value"`
	QuotaDisplay string `json:"quota_display"`
}

// WheelDayStat 概览里的按天走势
type WheelDayStat struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// WheelOverview 后台概览
type WheelOverview struct {
	TotalWins            int64            `json:"total_wins"`
	TodayWins            int64            `json:"today_wins"`
	UniqueUsers          int64            `json:"unique_users"`
	PendingShipments     int64            `json:"pending_shipments"`
	QuotaDistributed     int64            `json:"quota_distributed"`
	QuotaDistributedText string           `json:"quota_distributed_display"`
	CodeIssued           int64            `json:"code_issued"`
	SubscriptionIssued   int64            `json:"subscription_issued"`
	Prizes               []WheelPrizeStat `json:"prizes"`
	Trend                []WheelDayStat   `json:"trend"`
	StockAlerts          int              `json:"stock_alerts"`
}

// GetWheelOverview 后台概览统计
func GetWheelOverview() (*WheelOverview, error) {
	overview := &WheelOverview{Prizes: []WheelPrizeStat{}, Trend: []WheelDayStat{}}

	// 一次聚合出全部计数，避免对 wheel_wins 反复做全表 COUNT。
	type wheelWinAggregate struct {
		TotalWins          int64
		TodayWins          int64
		UniqueUsers        int64
		PendingShipments   int64
		QuotaDistributed   int64
		CodeIssued         int64
		SubscriptionIssued int64
	}
	aggregate := wheelWinAggregate{}
	aggregateColumns := strings.Join([]string{
		"COUNT(*) AS total_wins",
		"COALESCE(SUM(CASE WHEN draw_date = ? THEN 1 ELSE 0 END), 0) AS today_wins",
		"COUNT(DISTINCT user_id) AS unique_users",
		"COALESCE(SUM(CASE WHEN prize_type = ? AND status = ? THEN 1 ELSE 0 END), 0) AS pending_shipments",
		"COALESCE(SUM(CASE WHEN prize_type IN (?, ?) THEN quota_value ELSE 0 END), 0) AS quota_distributed",
		"COALESCE(SUM(CASE WHEN prize_type = ? THEN 1 ELSE 0 END), 0) AS code_issued",
		"COALESCE(SUM(CASE WHEN prize_type = ? THEN 1 ELSE 0 END), 0) AS subscription_issued",
	}, ", ")
	if err := DB.Model(&WheelWin{}).
		Select(aggregateColumns,
			wheelToday(),
			WheelPrizeTypePhysical, WheelWinStatusPending,
			WheelPrizeTypeQuota, WheelPrizeTypeRedemptionCode,
			WheelPrizeTypeRedemptionCode,
			WheelPrizeTypeSubscription,
		).
		Scan(&aggregate).Error; err != nil {
		return nil, err
	}
	overview.TotalWins = aggregate.TotalWins
	overview.TodayWins = aggregate.TodayWins
	overview.UniqueUsers = aggregate.UniqueUsers
	overview.PendingShipments = aggregate.PendingShipments
	overview.QuotaDistributed = aggregate.QuotaDistributed
	overview.CodeIssued = aggregate.CodeIssued
	overview.SubscriptionIssued = aggregate.SubscriptionIssued
	overview.QuotaDistributedText = wheelQuotaDisplay(int(overview.QuotaDistributed))

	prizes, err := ListWheelPrizes(true)
	if err != nil {
		return nil, err
	}
	today := wheelToday()
	todayCounts := make(map[int]int64, len(prizes))
	type prizeDayRow struct {
		PrizeId int
		Count   int64
	}
	dayRows := make([]prizeDayRow, 0, len(prizes))
	if err := DB.Model(&WheelWin{}).
		Select("prize_id, COUNT(*) as count").
		Where("draw_date = ?", today).
		Group("prize_id").
		Scan(&dayRows).Error; err != nil {
		return nil, err
	}
	for _, row := range dayRows {
		todayCounts[row.PrizeId] = row.Count
	}
	for i := range prizes {
		prize := &prizes[i]
		todayIssued := todayCounts[prize.Id]
		if prize.Enabled && prize.Type != WheelPrizeTypeNone && prize.Stock == 0 {
			overview.StockAlerts++
		}
		overview.Prizes = append(overview.Prizes, WheelPrizeStat{
			Id:           prize.Id,
			Name:         prize.Name,
			Icon:         prize.Icon,
			Type:         prize.Type,
			Enabled:      prize.Enabled,
			Stock:        prize.Stock,
			IssuedCount:  prize.IssuedCount,
			TodayIssued:  todayIssued,
			QuotaValue:   prize.QuotaValue,
			QuotaDisplay: wheelQuotaDisplay(prize.QuotaValue),
		})
	}

	type trendRow struct {
		DrawDate string
		Count    int64
	}
	rows := make([]trendRow, 0, 7)
	since := time.Now().AddDate(0, 0, -6).Format("2006-01-02")
	if err := DB.Model(&WheelWin{}).
		Select("draw_date, COUNT(*) as count").
		Where("draw_date >= ?", since).
		Group("draw_date").
		Order("draw_date asc").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	counts := make(map[string]int64, len(rows))
	for _, row := range rows {
		counts[row.DrawDate] = row.Count
	}
	for i := 6; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		overview.Trend = append(overview.Trend, WheelDayStat{Date: date, Count: counts[date]})
	}

	return overview, nil
}
