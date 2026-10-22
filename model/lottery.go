package model

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 幸运抽奖
// ---------------------------------------------------------------------------

// LotteryDraw 单次抽奖记录（一行 = 一次抽奖动作）
type LotteryDraw struct {
	Id         int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId     int    `json:"user_id" gorm:"not null;index:idx_lottery_user_date,priority:1;index"`
	DrawDate   string `json:"draw_date" gorm:"type:varchar(10);not null;index:idx_lottery_user_date,priority:2;index"`
	Mode       string `json:"mode" gorm:"type:varchar(10);not null;default:'single'"` // single | multi
	DrawCount  int    `json:"draw_count" gorm:"not null;default:1"`                   // 本次抽数（1 或 10）
	TotalPrize int    `json:"total_prize" gorm:"not null;default:0"`                  // 本次总奖励额度
	CostQuota  int    `json:"cost_quota" gorm:"not null;default:0"`                   // 本次消耗额度（免费为 0）
	IsFree     bool   `json:"is_free" gorm:"not null"`                                // 是否使用免费次数
	CreatedAt  int64  `json:"created_at" gorm:"bigint;index"`
}

func (LotteryDraw) TableName() string {
	return "lottery_draws"
}

// LotteryRound 单次抽奖中单个奖品的开奖结果
type LotteryRound struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	DrawId    int    `json:"draw_id" gorm:"not null;index"`
	UserId    int    `json:"user_id" gorm:"not null;index:idx_lottery_round_user_date,priority:1"`
	PrizeIdx  int    `json:"prize_idx" gorm:"not null;default:0"` // 命中的奖池档位下标
	Prize     int    `json:"prize" gorm:"not null;default:0"`     // 奖励额度
	DrawDate  string `json:"draw_date" gorm:"type:varchar(10);not null;index:idx_lottery_round_user_date,priority:2;index"`
	CreatedAt int64  `json:"created_at" gorm:"bigint;index"`
}

func (LotteryRound) TableName() string {
	return "lottery_rounds"
}

// lotteryToday 返回本地时区下的今天（YYYY-MM-DD）
func lotteryToday() string {
	return time.Now().Format("2006-01-02")
}

// GetUserLotteryUsedToday 返回用户今日已使用的抽奖次数
func GetUserLotteryUsedToday(userId int) (int, error) {
	var total int64
	err := DB.Model(&LotteryDraw{}).
		Where("user_id = ? AND draw_date = ?", userId, lotteryToday()).
		Select("COALESCE(SUM(draw_count), 0)").
		Scan(&total).Error
	return int(total), err
}

// GetUserLotteryDrawnRoundsToday 返回用户今日已命中过的奖池档位下标
func GetUserLotteryDrawnRoundsToday(userId int) ([]int, error) {
	var rounds []LotteryRound
	err := DB.Where("user_id = ? AND draw_date = ?", userId, lotteryToday()).
		Order("id asc").Find(&rounds).Error
	if err != nil {
		return nil, err
	}
	out := make([]int, 0, len(rounds))
	for _, r := range rounds {
		out = append(out, r.PrizeIdx)
	}
	return out, nil
}

// GetUserLotteryTotalPrize 返回用户今日累计奖励额度
func GetUserLotteryTotalPrize(userId int) (int, error) {
	var total int64
	err := DB.Model(&LotteryRound{}).
		Where("user_id = ? AND draw_date = ?", userId, lotteryToday()).
		Select("COALESCE(SUM(prize), 0)").
		Scan(&total).Error
	return int(total), err
}

// weightedPick 按权重从奖池中抽取一个档位下标
func weightedPick(prizes []operation_setting.LotteryPrizeTier, rnd *rand.Rand) int {
	if len(prizes) == 0 {
		return 0
	}
	total := 0.0
	for _, p := range prizes {
		if p.Weight > 0 {
			total += p.Weight
		}
	}
	if total <= 0 {
		return rnd.Intn(len(prizes))
	}
	r := rnd.Float64() * total
	acc := 0.0
	for i, p := range prizes {
		if p.Weight <= 0 {
			continue
		}
		acc += p.Weight
		if r < acc {
			return i
		}
	}
	// 浮点兜底：返回最后一个非零权重档位
	for i := len(prizes) - 1; i >= 0; i-- {
		if prizes[i].Weight > 0 {
			return i
		}
	}
	return 0
}

// LotteryDrawResult 抽奖结果
type LotteryDrawResult struct {
	DrawId         int    `json:"draw_id"`
	Mode           string `json:"mode"`
	Prizes         []int  `json:"prizes"`        // 每个奖品额度
	RoundIds       []int  `json:"round_ids"`     // 每个奖品对应的 round id
	PrizeIndexes   []int  `json:"prize_indexes"` // 每个奖品对应的奖池档位下标
	SlotIndexes    []int  `json:"slot_indexes"`  // 前端动画停靠槽位（= prize_indexes）
	TotalPrize     int    `json:"total_prize"`
	CostQuota      int    `json:"cost_quota"`
	TotalPrizeText string `json:"total_prize_display"`
	CostText       string `json:"cost_display"`
	RemainingDraws int    `json:"remaining_draws"`
	DrawsUsedToday int    `json:"draws_used_today"`
	Quota          int    `json:"quota"`
	DrawDate       string `json:"draw_date"`
	IsFree         bool   `json:"is_free"`
	BigWins        []int  `json:"big_wins"`
}

// formatQuotaDisplay 把额度换算成展示金额字符串
func formatQuotaDisplay(quota int) string {
	unit := common.QuotaPerUnit
	if unit <= 0 {
		return "0.00"
	}
	return fmt.Sprintf("%.2f", float64(quota)/unit)
}

// UserLotteryDraw 执行一次抽奖（single / multi）
//
// 规则：
//   - 每日前 DailyFreeDraws 次免费；
//   - 免费次数用尽后按 SingleCostQuota / MultiCostQuota 扣费；
//   - 十连抽要求当日尚未抽过（若 RequireNoDrawTodayForMulti 为 true）。
func UserLotteryDraw(userId int, mode string) (*LotteryDrawResult, error) {
	setting := operation_setting.GetLotterySetting()
	if !setting.Enabled {
		return nil, common.NewMessage("Lottery feature is not enabled")
	}
	if mode != "single" && mode != "multi" {
		return nil, common.NewMessage("Invalid lottery mode")
	}
	if mode == "multi" && !setting.EnableMulti {
		return nil, common.NewMessage("Multi-draw is not enabled")
	}
	if len(setting.Prizes) == 0 {
		return nil, common.NewMessage("Lottery prize pool is empty")
	}

	drawCount := 1
	if mode == "multi" {
		drawCount = 10
	}

	usedToday, err := GetUserLotteryUsedToday(userId)
	if err != nil {
		return nil, err
	}
	if mode == "multi" && setting.RequireNoDrawTodayForMulti && usedToday > 0 {
		return nil, common.NewMessage("Multi-draw requires no draw today")
	}

	freeLeft := setting.DailyFreeDraws - usedToday
	if freeLeft < 0 {
		freeLeft = 0
	}

	isFree := false
	cost := 0
	if mode == "multi" {
		// 十连：仅当免费次数覆盖全部次数时才算免费
		if freeLeft >= drawCount {
			isFree = true
		} else {
			cost = setting.MultiCostQuota
		}
	} else {
		if freeLeft >= 1 {
			isFree = true
		} else {
			cost = setting.SingleCostQuota
		}
	}

	drawDate := lotteryToday()
	rnd := rand.New(rand.NewSource(time.Now().UnixNano() ^ int64(userId)<<17))

	prizes := make([]int, drawCount)
	indexes := make([]int, drawCount)
	totalPrize := 0
	for i := 0; i < drawCount; i++ {
		idx := weightedPick(setting.Prizes, rnd)
		indexes[i] = idx
		prizes[i] = setting.Prizes[idx].Quota
		totalPrize += prizes[i]
	}

	draw := &LotteryDraw{
		UserId:     userId,
		DrawDate:   drawDate,
		Mode:       mode,
		DrawCount:  drawCount,
		TotalPrize: totalPrize,
		CostQuota:  cost,
		IsFree:     isFree,
		CreatedAt:  time.Now().Unix(),
	}
	rounds := make([]LotteryRound, drawCount)
	now := time.Now().Unix()

	var finalQuota int
	err = DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(draw).Error; err != nil {
			return err
		}

		if cost > 0 {
			// 条件更新保证余额不会被扣成负数（并发安全）
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

		if totalPrize > 0 {
			if err := tx.Model(&User{}).Where("id = ?", userId).
				Update("quota", gorm.Expr("quota + ?", totalPrize)).Error; err != nil {
				return err
			}
		}

		if err := tx.Model(&User{}).Where("id = ?", userId).
			Select("quota").Scan(&finalQuota).Error; err != nil {
			return err
		}

		for i := 0; i < drawCount; i++ {
			rounds[i] = LotteryRound{
				DrawId:    draw.Id,
				UserId:    userId,
				PrizeIdx:  indexes[i],
				Prize:     prizes[i],
				DrawDate:  drawDate,
				CreatedAt: now,
			}
		}
		return tx.Create(&rounds).Error
	})
	if err != nil {
		return nil, err
	}

	// 事务成功后刷新额度缓存
	delta := int64(totalPrize - cost)
	if delta != 0 {
		go func() {
			_ = cacheIncrUserQuota(userId, delta)
		}()
	}

	roundIds := make([]int, drawCount)
	for i := range rounds {
		roundIds[i] = rounds[i].Id
	}

	bigWins := make([]int, 0)
	if setting.MinWinQuotaForPublic > 0 {
		for _, p := range prizes {
			if p >= setting.MinWinQuotaForPublic {
				bigWins = append(bigWins, p)
			}
		}
	}

	remaining := setting.DailyFreeDraws - usedToday - drawCount
	if remaining < 0 {
		remaining = 0
	}

	return &LotteryDrawResult{
		DrawId:         draw.Id,
		Mode:           mode,
		Prizes:         prizes,
		RoundIds:       roundIds,
		PrizeIndexes:   indexes,
		SlotIndexes:    indexes,
		TotalPrize:     totalPrize,
		CostQuota:      cost,
		TotalPrizeText: formatQuotaDisplay(totalPrize),
		CostText:       formatQuotaDisplay(cost),
		RemainingDraws: remaining,
		DrawsUsedToday: usedToday + drawCount,
		Quota:          finalQuota,
		DrawDate:       drawDate,
		IsFree:         isFree,
		BigWins:        bigWins,
	}, nil
}

// LotteryRankItem 榜单条目
type LotteryRankItem struct {
	Rank     int    `json:"rank"`
	UserId   int    `json:"user_id"`
	Username string `json:"username"`
	Award    int    `json:"award"`
	IsMe     bool   `json:"is_me"`
}

// LotteryRankBoard 榜单
type LotteryRankBoard struct {
	Items []LotteryRankItem `json:"items"`
	Me    *LotteryRankItem  `json:"me"`
}

// GetLotteryTodayRanking 今日抽奖排行榜
func GetLotteryTodayRanking(userId int, limit int) (*LotteryRankBoard, error) {
	if limit <= 0 {
		limit = 10
	}
	type row struct {
		UserId int
		Total  int
	}
	var rows []row
	err := DB.Model(&LotteryRound{}).
		Select("user_id, COALESCE(SUM(prize),0) as total").
		Where("draw_date = ?", lotteryToday()).
		Group("user_id").
		Order("total desc").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	board := &LotteryRankBoard{Items: make([]LotteryRankItem, 0, len(rows))}
	for i, r := range rows {
		name, _ := GetUsernameById(r.UserId, false)
		board.Items = append(board.Items, LotteryRankItem{
			Rank:     i + 1,
			UserId:   r.UserId,
			Username: name,
			Award:    r.Total,
			IsMe:     r.UserId == userId,
		})
	}

	// 我的排名
	var mine row
	q := DB.Model(&LotteryRound{}).
		Select("user_id, COALESCE(SUM(prize),0) as total").
		Where("draw_date = ? AND user_id = ?", lotteryToday(), userId).
		Group("user_id").
		Scan(&mine)
	if q.Error == nil && q.RowsAffected > 0 {
		var better int64
		DB.Model(&LotteryRound{}).
			Select("COUNT(DISTINCT user_id)").
			Where("draw_date = ?", lotteryToday()).
			Group("user_id").
			Having("COALESCE(SUM(prize),0) > ?", mine.Total).
			Scan(&better)
		name, _ := GetUsernameById(userId, false)
		board.Me = &LotteryRankItem{
			Rank:     int(better) + 1,
			UserId:   userId,
			Username: name,
			Award:    mine.Total,
			IsMe:     true,
		}
	}
	return board, nil
}

// LotteryPublicWin 公开中奖记录
type LotteryPublicWin struct {
	Date     string `json:"date"`
	Username string `json:"username"`
	Prize    int    `json:"prize"`
	IsMe     bool   `json:"is_me"`
}

// GetLotteryPublicWins 近期公开中奖记录（高于阈值的大奖）
func GetLotteryPublicWins(userId int) ([]LotteryPublicWin, error) {
	setting := operation_setting.GetLotterySetting()
	limit := setting.PublicWinsLimit
	if limit <= 0 {
		limit = 20
	}
	q := DB.Where("prize > 0")
	if setting.MinWinQuotaForPublic > 0 {
		q = q.Where("prize >= ?", setting.MinWinQuotaForPublic)
	}
	var rounds []LotteryRound
	if err := q.Order("id desc").Limit(limit).Find(&rounds).Error; err != nil {
		return nil, err
	}
	out := make([]LotteryPublicWin, 0, len(rounds))
	for _, r := range rounds {
		name, _ := GetUsernameById(r.UserId, false)
		out = append(out, LotteryPublicWin{
			Date:     r.DrawDate,
			Username: name,
			Prize:    r.Prize,
			IsMe:     r.UserId == userId,
		})
	}
	return out, nil
}

// GetLotteryStatus 抽奖页所需状态
func GetLotteryStatus(userId int) (map[string]any, error) {
	setting := operation_setting.GetLotterySetting()

	user, err := GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	usedToday, err := GetUserLotteryUsedToday(userId)
	if err != nil {
		return nil, err
	}
	slots, err := GetUserLotteryDrawnRoundsToday(userId)
	if err != nil {
		return nil, err
	}
	totalPrize, err := GetUserLotteryTotalPrize(userId)
	if err != nil {
		return nil, err
	}

	remaining := setting.DailyFreeDraws - usedToday
	if remaining < 0 {
		remaining = 0
	}

	prizes := make([]map[string]any, 0, len(setting.Prizes))
	for i, p := range setting.Prizes {
		prizes = append(prizes, map[string]any{
			"index":   i,
			"quota":   p.Quota,
			"weight":  p.Weight,
			"display": formatQuotaDisplay(p.Quota),
		})
	}

	return map[string]any{
		"enabled":                         setting.Enabled,
		"quota":                           user.Quota,
		"daily_draw_limit":                setting.DailyFreeDraws,
		"remaining_draws":                 remaining,
		"draws_used_today":                usedToday,
		"draw_date":                       lotteryToday(),
		"prizes":                          prizes,
		"slot_indexes_today":              slots,
		"total_prize_today":               totalPrize,
		"total_prize_display":             formatQuotaDisplay(totalPrize),
		"single_cost":                     setting.SingleCostQuota,
		"single_cost_display":             formatQuotaDisplay(setting.SingleCostQuota),
		"multi_draws":                     10,
		"multi_cost":                      setting.MultiCostQuota,
		"multi_cost_display":              formatQuotaDisplay(setting.MultiCostQuota),
		"enable_multi":                    setting.EnableMulti,
		"require_no_draw_today_for_multi": setting.RequireNoDrawTodayForMulti,
		"can_single":                      true,
		"can_multi":                       setting.EnableMulti && (!setting.RequireNoDrawTodayForMulti || usedToday == 0),
		"min_win_for_public":              setting.MinWinQuotaForPublic,
		"timezone":                        time.Now().Location().String(),
	}, nil
}
