package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupClaimCodeTestState(t *testing.T) {
	t.Helper()

	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(
		&User{},
		&ClaimCode{},
		&ClaimCodeCard{},
		&ClaimCodeClaim{},
		&SubscriptionPlan{},
		&UserSubscription{},
	))

	oldUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() {
		common.QuotaPerUnit = oldUnit
		for _, table := range []string{"claim_code_claims", "claim_code_cards", "claim_codes"} {
			DB.Exec("DELETE FROM " + table)
		}
	})
}

func createClaimCodeTestUser(t *testing.T, username string, group string, quota int) User {
	t.Helper()

	user := User{
		Username:    username,
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       group,
		AuthVersion: 1,
		Quota:       quota,
		// 邀请码有唯一约束，测试账号按用户名给出确定值
		AffCode: "claim-" + username,
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

func createClaimCodeForTest(t *testing.T, code ClaimCode) ClaimCode {
	t.Helper()

	codes, err := CreateClaimCodes(code, 1)
	require.NoError(t, err)
	require.Len(t, codes, 1)
	return codes[0]
}

// 余额口令：领取即到账，每人限领次数与总次数都生效。
func TestRedeemClaimCodeCreditsQuota(t *testing.T) {
	setupClaimCodeTestState(t)
	alice := createClaimCodeTestUser(t, "alice", "default", 0)
	bob := createClaimCodeTestUser(t, "bob", "default", 0)
	carol := createClaimCodeTestUser(t, "carol", "default", 0)

	code := createClaimCodeForTest(t, ClaimCode{
		Name:         "500K credit",
		Type:         ClaimCodeTypeQuota,
		Quota:        500000,
		TotalCount:   2,
		PerUserLimit: 1,
	})
	assert.Equal(t, 14, len(code.Code), "口令形如 XXXX-XXXX-XXXX")

	// 输入的大小写与首尾空白都会收敛
	claim, err := RedeemClaimCode(alice.Id, "  "+strings.ToLower(code.Code)+"  ")
	require.NoError(t, err)
	assert.Equal(t, ClaimCodeClaimStatusDelivered, claim.Status)
	assert.Equal(t, 500000, claim.Quota)
	assert.Equal(t, "alice", claim.Username)
	assert.Equal(t, code.Name, claim.Name)

	var stored User
	require.NoError(t, DB.First(&stored, "id = ?", alice.Id).Error)
	assert.Equal(t, 500000, stored.Quota)

	_, err = RedeemClaimCode(alice.Id, code.Code)
	require.Error(t, err, "同一用户超过每人限领次数后不能继续领取")

	_, err = RedeemClaimCode(bob.Id, code.Code)
	require.NoError(t, err)

	_, err = RedeemClaimCode(carol.Id, code.Code)
	require.Error(t, err, "总量领完后不能再领")

	var record ClaimCode
	require.NoError(t, DB.First(&record, "id = ?", code.Id).Error)
	assert.Equal(t, 2, record.UsedCount)

	views, total, err := ListClaimCodes(ClaimCodeFilter{Page: 1, PageSize: 20})
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, views, 1)
	assert.Zero(t, views[0].RemainingCount)
	assert.Equal(t, int64(2), views[0].ClaimedUsers)
}

// 批量生成口令：每条独立、互不重复。
func TestCreateClaimCodesGeneratesUniqueCodes(t *testing.T) {
	setupClaimCodeTestState(t)

	codes, err := CreateClaimCodes(ClaimCode{
		Name:         "Batch",
		Type:         ClaimCodeTypeQuota,
		Quota:        500000,
		TotalCount:   1,
		PerUserLimit: 1,
	}, 5)
	require.NoError(t, err)
	require.Len(t, codes, 5)

	seen := make(map[string]struct{}, len(codes))
	for _, code := range codes {
		require.Equal(t, 14, len(code.Code))
		_, duplicated := seen[code.Code]
		assert.False(t, duplicated, "批量生成的口令不能重复")
		seen[code.Code] = struct{}{}
	}

	_, err = CreateClaimCodes(ClaimCode{Name: "Bad", Type: ClaimCodeTypeQuota}, 0)
	require.Error(t, err, "生成数量必须至少为 1")

	_, err = CreateClaimCodes(ClaimCode{Type: ClaimCodeTypeQuota, Quota: 500000}, 1)
	require.Error(t, err, "口令名称不能为空")

	_, err = CreateClaimCodes(ClaimCode{Name: "No quota", Type: ClaimCodeTypeQuota}, 1)
	require.Error(t, err, "余额口令必须设置面额")
}

// 虚拟产品从卡密池发放；实物口令先收集收货信息再发货。
func TestRedeemClaimCodeIssuesCardKeyAndShipsPhysical(t *testing.T) {
	setupClaimCodeTestState(t)
	alice := createClaimCodeTestUser(t, "alice", "default", 0)
	bob := createClaimCodeTestUser(t, "bob", "default", 0)

	cardCode := createClaimCodeForTest(t, ClaimCode{
		Name:         "Steam key",
		Type:         ClaimCodeTypeCardKey,
		TotalCount:   2,
		PerUserLimit: 2,
	})
	added, err := AddClaimCodeCards(cardCode.Id, "KEY-AAA\nKEY-BBB\n\nKEY-AAA\n")
	require.NoError(t, err)
	assert.Equal(t, 2, added)

	added, err = AddClaimCodeCards(cardCode.Id, "KEY-AAA")
	require.NoError(t, err)
	assert.Zero(t, added, "重复导入的卡密不会入库")

	first, err := RedeemClaimCode(alice.Id, cardCode.Code)
	require.NoError(t, err)
	assert.Equal(t, "KEY-AAA", first.CardContent)
	assert.Equal(t, ClaimCodeClaimStatusDelivered, first.Status)

	second, err := RedeemClaimCode(bob.Id, cardCode.Code)
	require.NoError(t, err)
	assert.Equal(t, "KEY-BBB", second.CardContent)

	_, err = RedeemClaimCode(alice.Id, cardCode.Code)
	require.Error(t, err, "卡密领完且总量领完后不能再领")

	physical := createClaimCodeForTest(t, ClaimCode{
		Name:         "Ceramic mug",
		Type:         ClaimCodeTypePhysical,
		TotalCount:   1,
		PerUserLimit: 1,
		Description:  "Ships within 7 days",
	})
	claim, err := RedeemClaimCode(alice.Id, physical.Code)
	require.NoError(t, err)
	assert.Equal(t, ClaimCodeClaimStatusPending, claim.Status)
	assert.True(t, claim.NeedAddress)
	assert.Equal(t, "Ships within 7 days", claim.Description)

	err = ShipClaimCodeClaim(claim.Id, "SF100000", "")
	require.Error(t, err, "用户还没填收货信息时不能发货")

	updated, err := SubmitClaimCodeAddress(alice.Id, claim.Id, "Alice", "13800000000", "Shanghai Pudong 1st road")
	require.NoError(t, err)
	assert.Equal(t, ClaimCodeClaimStatusReady, updated.Status)
	assert.False(t, updated.NeedAddress)

	require.NoError(t, ShipClaimCodeClaim(claim.Id, "SF123456", "shipped"))

	items, total, err := ListMyClaimCodeClaims(alice.Id, 1, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	require.Len(t, items, 2)
	assert.Equal(t, ClaimCodeClaimStatusShipped, items[0].Status)
	assert.Equal(t, "SF123456", items[0].TrackingNo)
	assert.Equal(t, "KEY-AAA", items[1].CardContent)

	overview, err := GetClaimCodeOverview()
	require.NoError(t, err)
	assert.Equal(t, int64(3), overview.TotalClaims)
	assert.Zero(t, overview.PendingShipment, "已发货的实物记录不再计入待发货")
	assert.Equal(t, int64(2), overview.CardIssued)
	assert.Equal(t, int64(1), overview.PhysicalIssued)
}

// 订阅口令开通套餐，同时校验停用、过期与分组限制。
func TestRedeemClaimCodeGrantsSubscriptionAndRejectsInvalid(t *testing.T) {
	useWheelWidePoolDB(t)
	setupClaimCodeTestState(t)
	alice := createClaimCodeTestUser(t, "alice", "default", 0)

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
	InvalidateSubscriptionPlanCache(plan.Id)

	code := createClaimCodeForTest(t, ClaimCode{
		Name:         "Pro plan",
		Type:         ClaimCodeTypeSubscription,
		PlanId:       plan.Id,
		TotalCount:   0,
		PerUserLimit: 1,
	})
	assert.Equal(t, plan.Title, code.PlanTitle)

	claim, err := RedeemClaimCode(alice.Id, code.Code)
	require.NoError(t, err)
	assert.Equal(t, plan.Id, claim.PlanId)
	assert.Equal(t, plan.Title, claim.PlanTitle)
	require.NotZero(t, claim.SubscriptionId)

	var subscription UserSubscription
	require.NoError(t, DB.First(&subscription, "user_id = ?", alice.Id).Error)
	assert.Equal(t, plan.Id, subscription.PlanId)

	_, err = RedeemClaimCode(alice.Id, "NOPE-NOPE-NOPE")
	require.Error(t, err, "不存在的口令不能领取")
	_, err = RedeemClaimCode(alice.Id, "   ")
	require.Error(t, err, "空口令不能领取")

	disabled := createClaimCodeForTest(t, ClaimCode{
		Name: "Disabled", Type: ClaimCodeTypeQuota, Quota: 500000, TotalCount: 1, PerUserLimit: 1,
	})
	require.NoError(t, DB.Model(&ClaimCode{}).Where("id = ?", disabled.Id).
		Update("status", ClaimCodeStatusDisabled).Error)
	_, err = RedeemClaimCode(alice.Id, disabled.Code)
	require.Error(t, err, "停用的口令不能领取")

	expired := createClaimCodeForTest(t, ClaimCode{
		Name: "Expired", Type: ClaimCodeTypeQuota, Quota: 500000, TotalCount: 1, PerUserLimit: 1,
		ExpiredTime: common.GetTimestamp() - 60,
	})
	_, err = RedeemClaimCode(alice.Id, expired.Code)
	require.Error(t, err, "过期的口令不能领取")

	limited := createClaimCodeForTest(t, ClaimCode{
		Name: "VIP only", Type: ClaimCodeTypeQuota, Quota: 500000, TotalCount: 1, PerUserLimit: 1,
		GroupLimit: "vip, svip",
	})
	assert.Equal(t, "vip,svip", limited.GroupLimit)
	_, err = RedeemClaimCode(alice.Id, limited.Code)
	require.Error(t, err, "default 分组不能领取分组限定口令")

	vip := createClaimCodeTestUser(t, "vip-user", "vip", 0)
	_, err = RedeemClaimCode(vip.Id, limited.Code)
	require.NoError(t, err)
}

// 有领取记录的口令删除时改为停用，记录里的口令与奖品快照保持可读。
func TestDeleteClaimCodeKeepsClaimRecords(t *testing.T) {
	setupClaimCodeTestState(t)
	alice := createClaimCodeTestUser(t, "alice", "default", 0)

	code := createClaimCodeForTest(t, ClaimCode{
		Name: "Gift", Type: ClaimCodeTypeQuota, Quota: 500000, TotalCount: 0, PerUserLimit: 0,
	})
	_, err := RedeemClaimCode(alice.Id, code.Code)
	require.NoError(t, err)

	require.NoError(t, DeleteClaimCode(code.Id))

	var record ClaimCode
	require.NoError(t, DB.First(&record, "id = ?", code.Id).Error)
	assert.Equal(t, ClaimCodeStatusDisabled, record.Status)

	empty := createClaimCodeForTest(t, ClaimCode{
		Name: "Never used", Type: ClaimCodeTypeQuota, Quota: 500000, TotalCount: 1, PerUserLimit: 1,
	})
	require.NoError(t, DeleteClaimCode(empty.Id))
	_, err = GetClaimCodeById(empty.Id)
	require.Error(t, err, "没有领取记录的口令直接删除")

	items, total, err := ListClaimCodeClaims(ClaimCodeClaimFilter{Page: 1, PageSize: 10})
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, code.Code, items[0].Code)
	assert.Equal(t, code.Name, items[0].Name)
}

// 卡密池管理：已发放的卡密不能删除，未发放的可以删除。
func TestClaimCodeCardPoolOnlyDeletesUnusedCards(t *testing.T) {
	setupClaimCodeTestState(t)
	alice := createClaimCodeTestUser(t, "alice", "default", 0)

	code := createClaimCodeForTest(t, ClaimCode{
		Name: "Keys", Type: ClaimCodeTypeCardKey, TotalCount: 2, PerUserLimit: 2,
	})
	_, err := AddClaimCodeCards(code.Id, "KEY-AAA\nKEY-BBB")
	require.NoError(t, err)

	claim, err := RedeemClaimCode(alice.Id, code.Code)
	require.NoError(t, err)
	assert.Equal(t, "KEY-AAA", claim.CardContent)

	cards, total, err := ListClaimCodeCards(code.Id, ClaimCodeCardStatusAvailable, 1, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, cards, 1)

	require.NoError(t, DeleteClaimCodeCard(code.Id, cards[0].Id))

	usedCards, total, err := ListClaimCodeCards(code.Id, ClaimCodeCardStatusUsed, 1, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, usedCards, 1)
	require.Error(t, DeleteClaimCodeCard(code.Id, usedCards[0].Id), "已发放的卡密不能删除")
}
