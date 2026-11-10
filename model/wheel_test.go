package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupWheelTestState(t *testing.T, freeDraws int, costQuota int) {
	t.Helper()

	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&WheelPrize{}, &WheelPrizeCode{}, &WheelWin{}, &Redemption{}, &SubscriptionPlan{}))

	oldUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	oldSetting := *operation_setting.GetWheelSetting()
	setting := operation_setting.GetWheelSetting()
	setting.Enabled = true
	setting.DailyFreeDraws = freeDraws
	setting.DailyDrawLimit = 0
	setting.SingleCostQuota = costQuota
	setting.RedemptionExpireDays = 30
	setting.ShowPublicWins = true
	setting.PublicWinsLimit = 10

	t.Cleanup(func() {
		*operation_setting.GetWheelSetting() = oldSetting
		common.QuotaPerUnit = oldUnit
		for _, table := range []string{"wheel_wins", "wheel_prizes", "wheel_prize_codes", "redemptions"} {
			DB.Exec("DELETE FROM " + table)
		}
	})
}

func createWheelTestUser(t *testing.T, quota int) User {
	t.Helper()

	user := User{
		Username:    "wheel-user",
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
		Quota:       quota,
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func createWheelTestPrize(t *testing.T, prize WheelPrize) WheelPrize {
	t.Helper()

	prize.Enabled = true
	require.NoError(t, CreateWheelPrize(&prize))
	return prize
}

func countWheelWins(t *testing.T, userId int) int64 {
	t.Helper()

	var total int64
	require.NoError(t, DB.Model(&WheelWin{}).Where("user_id = ?", userId).Count(&total).Error)
	return total
}

// 额度奖品：中奖即时到账、库存扣减、并写入中奖记录。
func TestUserWheelSpinQuotaPrizeCreditsQuota(t *testing.T) {
	setupWheelTestState(t, 1, 500000)
	user := createWheelTestUser(t, 0)
	prize := createWheelTestPrize(t, WheelPrize{
		Name:       "1 USD",
		Type:       WheelPrizeTypeQuota,
		Weight:     1,
		Stock:      5,
		QuotaValue: 500000,
	})

	result, err := UserWheelSpin(user.Id)
	require.NoError(t, err)
	assert.Equal(t, WheelPrizeTypeQuota, result.PrizeType)
	assert.True(t, result.IsFree)
	assert.Equal(t, 500000, result.QuotaValue)
	assert.Equal(t, 500000, result.Quota)
	assert.Equal(t, WheelWinStatusDelivered, result.Status)

	var stored User
	require.NoError(t, DB.First(&stored, "id = ?", user.Id).Error)
	assert.Equal(t, 500000, stored.Quota)

	var afterPrize WheelPrize
	require.NoError(t, DB.First(&afterPrize, "id = ?", prize.Id).Error)
	assert.Equal(t, 4, afterPrize.Stock)
	assert.Equal(t, 1, afterPrize.IssuedCount)

	var win WheelWin
	require.NoError(t, DB.First(&win, "id = ?", result.WinId).Error)
	assert.Equal(t, prize.Id, win.PrizeId)
	assert.Equal(t, user.Id, win.UserId)
	assert.Equal(t, WheelWinStatusDelivered, win.Status)

	// 免费次数用完后开始扣额度
	second, err := UserWheelSpin(user.Id)
	require.NoError(t, err)
	assert.False(t, second.IsFree)
	assert.Equal(t, 500000, second.CostQuota)
	assert.Equal(t, 500000, second.Quota)
	assert.Equal(t, 2, second.DrawsUsedToday)
}

// 概览统计：一次聚合出的各项计数要与中奖记录一致。
func TestGetWheelOverviewAggregatesWins(t *testing.T) {
	setupWheelTestState(t, 1, 0)
	user := createWheelTestUser(t, 0)
	prize := createWheelTestPrize(t, WheelPrize{
		Name:       "1 USD",
		Type:       WheelPrizeTypeQuota,
		Weight:     1,
		Stock:      5,
		QuotaValue: 500000,
	})
	createWheelTestPrize(t, WheelPrize{
		Name:   "Poster",
		Type:   WheelPrizeTypePhysical,
		Weight: 1,
		Stock:  0,
	})

	_, err := UserWheelSpin(user.Id)
	require.NoError(t, err)

	overview, err := GetWheelOverview()
	require.NoError(t, err)
	assert.Equal(t, int64(1), overview.TotalWins)
	assert.Equal(t, int64(1), overview.TodayWins)
	assert.Equal(t, int64(1), overview.UniqueUsers)
	assert.Equal(t, int64(0), overview.PendingShipments)
	assert.Equal(t, int64(500000), overview.QuotaDistributed)
	assert.Equal(t, int64(0), overview.CodeIssued)
	assert.Equal(t, int64(0), overview.SubscriptionIssued)
	assert.Equal(t, 1, overview.StockAlerts)

	require.Len(t, overview.Prizes, 2)
	assert.Equal(t, prize.Id, overview.Prizes[0].Id)
	assert.Equal(t, int64(1), overview.Prizes[0].TodayIssued)
	assert.Equal(t, int64(0), overview.Prizes[1].TodayIssued)
}

// 售罄奖品的权重再高也不会被抽中。
func TestUserWheelSpinSkipsSoldOutPrize(t *testing.T) {
	setupWheelTestState(t, 1, 0)
	user := createWheelTestUser(t, 0)
	createWheelTestPrize(t, WheelPrize{
		Name:       "sold out",
		Type:       WheelPrizeTypeQuota,
		Weight:     1000,
		Stock:      0,
		QuotaValue: 500000,
	})
	available := createWheelTestPrize(t, WheelPrize{
		Name:       "in stock",
		Type:       WheelPrizeTypeQuota,
		Weight:     0.001,
		Stock:      3,
		QuotaValue: 100000,
	})

	result, err := UserWheelSpin(user.Id)
	require.NoError(t, err)
	assert.Equal(t, available.Id, result.PrizeId)

	var afterPrize WheelPrize
	require.NoError(t, DB.First(&afterPrize, "id = ?", available.Id).Error)
	assert.Equal(t, 2, afterPrize.Stock)
}

// 卡密奖品：中奖即占用一张卡密并回显给用户；卡密池空时报错且不产生记录。
func TestUserWheelSpinCardKeyConsumesCode(t *testing.T) {
	setupWheelTestState(t, 2, 0)
	user := createWheelTestUser(t, 0)
	prize := createWheelTestPrize(t, WheelPrize{
		Name:   "Steam key",
		Type:   WheelPrizeTypeCardKey,
		Weight: 1,
		Stock:  0,
	})
	added, err := AddWheelPrizeCodes(prize.Id, []string{"KEY-AAA", "KEY-BBB"})
	require.NoError(t, err)
	assert.Equal(t, 2, added)

	result, err := UserWheelSpin(user.Id)
	require.NoError(t, err)
	assert.Equal(t, WheelPrizeTypeCardKey, result.PrizeType)
	assert.Equal(t, "KEY-AAA", result.Code)
	assert.Equal(t, WheelWinStatusDelivered, result.Status)

	var code WheelPrizeCode
	require.NoError(t, DB.First(&code, "code = ?", "KEY-AAA").Error)
	assert.Equal(t, WheelCodeStatusUsed, code.Status)
	assert.Equal(t, user.Id, code.UserId)

	var afterPrize WheelPrize
	require.NoError(t, DB.First(&afterPrize, "id = ?", prize.Id).Error)
	assert.Equal(t, 1, afterPrize.Stock)

	// 第二个可用卡密被抽走后再抽一次就会用尽
	_, err = UserWheelSpin(user.Id)
	require.NoError(t, err)
	_, err = UserWheelSpin(user.Id)
	require.Error(t, err)
	assert.Equal(t, int64(2), countWheelWins(t, user.Id))
}

// 兑换码奖品：自动生成一张本站兑换码，面额与奖品一致。
func TestUserWheelSpinIssuesRedemptionCode(t *testing.T) {
	setupWheelTestState(t, 1, 0)
	user := createWheelTestUser(t, 0)
	createWheelTestPrize(t, WheelPrize{
		Name:       "5 USD code",
		Type:       WheelPrizeTypeRedemptionCode,
		Weight:     1,
		Stock:      WheelStockUnlimited,
		QuotaValue: 2500000,
	})

	result, err := UserWheelSpin(user.Id)
	require.NoError(t, err)
	assert.Equal(t, WheelPrizeTypeRedemptionCode, result.PrizeType)
	assert.Len(t, result.Code, 32)

	var redemption Redemption
	require.NoError(t, DB.First(&redemption, "key = ?", result.Code).Error)
	assert.Equal(t, 2500000, redemption.Quota)
	assert.Equal(t, user.Id, redemption.UserId)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, redemption.Status)
	assert.Greater(t, redemption.ExpiredTime, common.GetTimestamp())
}

// 实物奖品：记录进入待领取状态，等着用户填写收货信息。
func TestUserWheelSpinPhysicalPrizeStaysPending(t *testing.T) {
	setupWheelTestState(t, 1, 0)
	user := createWheelTestUser(t, 0)
	createWheelTestPrize(t, WheelPrize{
		Name:   "Mug",
		Type:   WheelPrizeTypePhysical,
		Weight: 1,
		Stock:  2,
	})

	result, err := UserWheelSpin(user.Id)
	require.NoError(t, err)
	assert.Equal(t, WheelPrizeTypePhysical, result.PrizeType)
	assert.Equal(t, WheelWinStatusPending, result.Status)
	assert.True(t, result.NeedAddress)
	assert.Empty(t, result.Code)

	view, err := SubmitWheelWinAddress(user.Id, result.WinId, "Alice", "13800000000", "Shanghai Pudong 1st road")
	require.NoError(t, err)
	assert.True(t, view.HasAddress)

	require.NoError(t, ShipWheelWin(result.WinId, "SF123456", "shipped"))
	var win WheelWin
	require.NoError(t, DB.First(&win, "id = ?", result.WinId).Error)
	assert.Equal(t, WheelWinStatusShipped, win.Status)
	assert.Equal(t, "SF123456", win.TrackingNo)
}

// 订阅奖品：中奖即为用户开通套餐。
// useWheelWidePoolDB 换用允许多连接的 SQLite 库。
// 订阅奖品发放会调用 CreateUserSubscriptionFromPlanTx，其中 GetDBTimestamp 需要
// 事务外的第二个连接；测试默认的单连接内存库会把这种正常用法变成死锁。
func useWheelWidePoolDB(t *testing.T) {
	t.Helper()

	previousDB, previousLogDB := DB, LOG_DB
	previousMainType, previousLogType := common.MainDatabaseType(), common.LogDatabaseType()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	DB, LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	require.NoError(t, db.AutoMigrate(&User{}, &SubscriptionPlan{}, &UserSubscription{}))

	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(4)

	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMainType, previousLogType)
		_ = sqlDB.Close()
	})
}

func TestUserWheelSpinGrantsSubscriptionPlan(t *testing.T) {
	useWheelWidePoolDB(t)
	setupWheelTestState(t, 1, 0)
	user := createWheelTestUser(t, 0)

	plan := SubscriptionPlan{
		Title:         "Pro monthly",
		PriceAmount:   9,
		Currency:      "USD",
		DurationUnit:  "month",
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   5000000,
	}
	require.NoError(t, DB.Create(&plan).Error)
	// 套餐缓存是进程级的，其他用例可能已缓存了同 id 的套餐
	InvalidateSubscriptionPlanCache(plan.Id)

	createWheelTestPrize(t, WheelPrize{
		Name:   "Pro plan",
		Type:   WheelPrizeTypeSubscription,
		Weight: 1,
		Stock:  1,
		PlanId: plan.Id,
	})

	result, err := UserWheelSpin(user.Id)
	require.NoError(t, err)
	assert.Equal(t, WheelPrizeTypeSubscription, result.PrizeType)
	assert.Equal(t, plan.Title, result.PlanTitle)

	var sub UserSubscription
	require.NoError(t, DB.First(&sub, "user_id = ?", user.Id).Error)
	assert.Equal(t, plan.Id, sub.PlanId)
	assert.Equal(t, "active", sub.Status)
	assert.Equal(t, int64(5000000), sub.AmountTotal)
}

// 额度不足且没有免费次数时不能抽奖。
func TestUserWheelSpinRejectsInsufficientQuota(t *testing.T) {
	setupWheelTestState(t, 0, 500000)
	user := createWheelTestUser(t, 0)
	createWheelTestPrize(t, WheelPrize{
		Name:       "1 USD",
		Type:       WheelPrizeTypeQuota,
		Weight:     1,
		Stock:      5,
		QuotaValue: 500000,
	})

	_, err := UserWheelSpin(user.Id)
	require.Error(t, err)
	assert.Equal(t, int64(0), countWheelWins(t, user.Id))

	var stored User
	require.NoError(t, DB.First(&stored, "id = ?", user.Id).Error)
	assert.Equal(t, 0, stored.Quota)
}
