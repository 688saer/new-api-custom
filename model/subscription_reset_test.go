package model

import (
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func seedSubscriptionResetPlan(t *testing.T, plan *SubscriptionPlan) {
	t.Helper()
	require.NoError(t, DB.Create(plan).Error)
}

func seedSubscriptionResetSub(t *testing.T, sub *UserSubscription) {
	t.Helper()
	require.NoError(t, DB.Create(sub).Error)
}

func getSubscriptionResetSub(t *testing.T, id int) UserSubscription {
	t.Helper()
	var sub UserSubscription
	require.NoError(t, DB.Where("id = ?", id).First(&sub).Error)
	return sub
}

func TestAdminResetUserSubscriptionsByPlanResetsAllActiveMatchesAndAdvancesTime(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:               9101,
		Title:            "Pro",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetDaily,
	}
	otherPlan := &SubscriptionPlan{
		Id:               9102,
		Title:            "Basic",
		PriceAmount:      1,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      100,
		QuotaResetPeriod: SubscriptionResetDaily,
	}
	seedSubscriptionResetPlan(t, plan)
	seedSubscriptionResetPlan(t, otherPlan)

	activeEnd := now + 30*24*3600
	expiredEnd := now - 1
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9201, UserId: 101, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 300, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 120})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9202, UserId: 101, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 500, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 120})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9203, UserId: 101, PlanId: otherPlan.Id, AmountTotal: 100, AmountUsed: 60, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 120})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9204, UserId: 101, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 700, StartTime: now - 7200, EndTime: expiredEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now - 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9205, UserId: 102, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 800, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 120})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9206, UserId: 101, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 900, StartTime: now - 3600, EndTime: activeEnd, Status: "cancelled", LastResetTime: now - 3600, NextResetTime: now + 120})

	beforeReset := GetDBTimestamp()
	result, err := AdminResetUserSubscriptionsByPlan(101, plan.Id, true)
	afterReset := GetDBTimestamp()

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, plan.Id, result.PlanId)
	assert.Equal(t, 2, result.MatchedCount)
	assert.Equal(t, 2, result.ResetCount)
	assert.Equal(t, 1, result.UserCount)
	assert.Equal(t, []int{101}, result.AffectedUserIds)
	assert.True(t, result.AdvanceResetTime)

	for _, id := range []int{9201, 9202} {
		sub := getSubscriptionResetSub(t, id)
		assert.Zero(t, sub.AmountUsed)
		assert.GreaterOrEqual(t, sub.LastResetTime, beforeReset)
		assert.LessOrEqual(t, sub.LastResetTime, afterReset)
		assert.Equal(t, calcNextResetTime(time.Unix(sub.LastResetTime, 0), plan, sub.EndTime), sub.NextResetTime)
	}
	assert.EqualValues(t, 60, getSubscriptionResetSub(t, 9203).AmountUsed)
	assert.EqualValues(t, 700, getSubscriptionResetSub(t, 9204).AmountUsed)
	assert.EqualValues(t, 800, getSubscriptionResetSub(t, 9205).AmountUsed)
	assert.EqualValues(t, 900, getSubscriptionResetSub(t, 9206).AmountUsed)
}

func TestAdminResetUserSubscriptionsByPlanKeepsResetTimes(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:               9301,
		Title:            "Team",
		PriceAmount:      20,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      2000,
		QuotaResetPeriod: SubscriptionResetMonthly,
	}
	seedSubscriptionResetPlan(t, plan)

	lastReset := now - 86400
	nextReset := now + 86400
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9302, UserId: 201, PlanId: plan.Id, AmountTotal: 2000, AmountUsed: 1200, StartTime: now - 172800, EndTime: now + 30*24*3600, Status: "active", LastResetTime: lastReset, NextResetTime: nextReset})

	result, err := AdminResetUserSubscriptionsByPlan(201, plan.Id, false)

	require.NoError(t, err)
	assert.False(t, result.AdvanceResetTime)
	sub := getSubscriptionResetSub(t, 9302)
	assert.Zero(t, sub.AmountUsed)
	assert.Equal(t, lastReset, sub.LastResetTime)
	assert.Equal(t, nextReset, sub.NextResetTime)
}

func TestAdminResetUserSubscriptionsByPlanNoActiveMatchReturnsError(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:            9401,
		Title:         "Expired",
		PriceAmount:   10,
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   1000,
	}
	seedSubscriptionResetPlan(t, plan)
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9402, UserId: 301, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 500, StartTime: now - 7200, EndTime: now - 1, Status: "active"})

	result, err := AdminResetUserSubscriptionsByPlan(301, plan.Id, true)

	require.Error(t, err)
	assert.Nil(t, result)
	assert.True(t, strings.Contains(err.Error(), "This user has no active subscription to this plan"))
}

func TestAdminResetPlanSubscriptionsResetsAllActiveUsers(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:               9501,
		Title:            "Business",
		PriceAmount:      30,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      3000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	seedSubscriptionResetPlan(t, plan)

	activeEnd := now + 30*24*3600
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9502, UserId: 401, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1000, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9503, UserId: 401, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1100, StartTime: now - 3500, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9504, UserId: 402, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1200, StartTime: now - 3400, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9505, UserId: 403, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1300, StartTime: now - 7200, EndTime: now - 1, Status: "active", LastResetTime: now - 3600, NextResetTime: now - 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9506, UserId: 404, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1400, StartTime: now - 3600, EndTime: activeEnd, Status: "cancelled", LastResetTime: now - 3600, NextResetTime: now + 10})

	result, err := AdminResetPlanSubscriptions(plan.Id, true)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, 3, result.MatchedCount)
	assert.Equal(t, 3, result.ResetCount)
	assert.Equal(t, 2, result.UserCount)
	assert.Equal(t, []int{401, 402}, result.AffectedUserIds)
	for _, id := range []int{9502, 9503, 9504} {
		sub := getSubscriptionResetSub(t, id)
		assert.Zero(t, sub.AmountUsed)
		assert.Zero(t, sub.LastResetTime)
		assert.Zero(t, sub.NextResetTime)
	}
	assert.EqualValues(t, 1300, getSubscriptionResetSub(t, 9505).AmountUsed)
	assert.EqualValues(t, 1400, getSubscriptionResetSub(t, 9506).AmountUsed)
}

func TestAdminResetPlanSubscriptionsNoMatchSucceeds(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Id:            9601,
		Title:         "Empty",
		PriceAmount:   10,
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   1000,
	}
	seedSubscriptionResetPlan(t, plan)

	result, err := AdminResetPlanSubscriptions(plan.Id, true)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Zero(t, result.MatchedCount)
	assert.Zero(t, result.ResetCount)
	assert.Zero(t, result.UserCount)
	assert.Empty(t, result.AffectedUserIds)
}

func TestSubscriptionTokenLimitAndModelWhitelistGovernPreConsume(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPreConsumeRecord{}))

	now := GetDBTimestamp()
	const userID = 9701
	plan := &SubscriptionPlan{
		Id:               9702,
		Title:            "Token card",
		PriceAmount:      2,
		DurationUnit:     SubscriptionDurationDay,
		DurationValue:    1,
		QuotaResetPeriod: SubscriptionResetDaily,
		TokenLimit:       200_000_000,
		AllowedModels:    []string{"gpt-4o-mini"},
	}
	seedSubscriptionResetPlan(t, plan)
	seedSubscriptionResetSub(t, &UserSubscription{
		Id:              9703,
		UserId:          userID,
		PlanId:          plan.Id,
		StartTime:       now - 60,
		EndTime:         now + 24*3600,
		Status:          "active",
		LastResetTime:   now - 60,
		NextResetTime:   now + 24*3600,
		TokenLimitTotal: plan.TokenLimit,
		AllowedModels:   plan.AllowedModels,
	})

	// A model outside the whitelist is rejected and names both sides.
	_, err := PreConsumeUserSubscription("req-blocked-model", userID, "gpt-4o", 0, 1)
	var modelErr *SubscriptionModelNotAllowedError
	require.ErrorAs(t, err, &modelErr)
	assert.Equal(t, "gpt-4o", modelErr.Model)
	assert.Equal(t, []string{"gpt-4o-mini"}, modelErr.Allowed)

	// A listed model with allowance left is admitted.
	_, err = PreConsumeUserSubscription("req-allowed-model", userID, "gpt-4o-mini", 0, 1)
	require.NoError(t, err)

	// Spending the whole allowance stops the next request on the same model.
	require.NoError(t, AddUserSubscriptionTokens(9703, plan.TokenLimit))
	_, err = PreConsumeUserSubscription("req-exhausted", userID, "gpt-4o-mini", 0, 1)
	var tokenErr *SubscriptionTokenQuotaExhaustedError
	require.ErrorAs(t, err, &tokenErr)
	assert.EqualValues(t, plan.TokenLimit, tokenErr.Used)
	assert.EqualValues(t, plan.TokenLimit, tokenErr.Limit)

	// The API contract exposes the whitelist as a real array, not a JSON string.
	payload, err := common.Marshal(plan)
	require.NoError(t, err)
	assert.Contains(t, string(payload), `"allowed_models":["gpt-4o-mini"]`)
}

func TestSubscriptionRenewModeExtendsTheSameCardOrRefillsItNow(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	const daySeconds = int64(24 * 3600)
	const userID = 9711
	plan := &SubscriptionPlan{
		Id:               9712,
		Title:            "Day card",
		PriceAmount:      2,
		DurationUnit:     SubscriptionDurationDay,
		DurationValue:    1,
		QuotaResetPeriod: SubscriptionResetDaily,
		TokenLimit:       1000,
	}
	seedSubscriptionResetPlan(t, plan)
	endTime := now + daySeconds
	seedSubscriptionResetSub(t, &UserSubscription{
		Id:              9713,
		UserId:          userID,
		PlanId:          plan.Id,
		AmountUsed:      7,
		StartTime:       now - 3600,
		EndTime:         endTime,
		Status:          "active",
		LastResetTime:   now - 3600,
		NextResetTime:   endTime,
		TokenLimitTotal: plan.TokenLimit,
		TokenUsed:       plan.TokenLimit,
	})

	// Refreshing spends the purchased day immediately: the allowance refills
	// now and the validity does not grow.
	refreshed, err := CreateUserSubscriptionWithRenewModeTx(DB, userID, plan, "test", SubscriptionRenewModeRefresh)
	require.NoError(t, err)
	assert.Equal(t, 9713, refreshed.Id)
	assert.Zero(t, refreshed.TokenUsed)
	assert.Zero(t, refreshed.AmountUsed)
	assert.EqualValues(t, endTime, refreshed.EndTime)

	// Extending grows that same card, so the wallet keeps showing a single
	// subscription, and leaves the current period's usage untouched.
	extended, err := CreateUserSubscriptionWithRenewModeTx(DB, userID, plan, "test", SubscriptionRenewModeExtend)
	require.NoError(t, err)
	assert.Equal(t, refreshed.Id, extended.Id, "a renewal must not add a second card")
	assert.EqualValues(t, endTime+daySeconds, extended.EndTime)
	assert.EqualValues(t, plan.TokenLimit, extended.TokenLimitTotal)
	var cards int64
	require.NoError(t, DB.Model(&UserSubscription{}).
		Where("user_id = ? AND plan_id = ?", userID, plan.Id).
		Count(&cards).Error)
	assert.EqualValues(t, 1, cards)

	// A plan that never resets has one allowance for the whole card, so the
	// bought allowance is credited instead of being swallowed by the extension.
	oneShot := &SubscriptionPlan{
		Id:               9714,
		Title:            "One shot",
		PriceAmount:      2,
		DurationUnit:     SubscriptionDurationDay,
		DurationValue:    30,
		QuotaResetPeriod: SubscriptionResetNever,
		TotalAmount:      500,
		TokenLimit:       1000,
	}
	seedSubscriptionResetPlan(t, oneShot)
	InvalidateSubscriptionPlanCache(oneShot.Id)
	seedSubscriptionResetSub(t, &UserSubscription{
		Id:              9715,
		UserId:          userID,
		PlanId:          oneShot.Id,
		StartTime:       now - 3600,
		EndTime:         now + 10*daySeconds,
		Status:          "active",
		NextResetTime:   0,
		AmountTotal:     500,
		TokenLimitTotal: 1000,
	})
	credited, err := CreateUserSubscriptionWithRenewModeTx(DB, userID, oneShot, "test", SubscriptionRenewModeExtend)
	require.NoError(t, err)
	assert.EqualValues(t, 9715, credited.Id)
	assert.EqualValues(t, now+40*daySeconds, credited.EndTime)
	assert.EqualValues(t, 1000, credited.AmountTotal, "the bought quota is credited")
	assert.EqualValues(t, 2000, credited.TokenLimitTotal)
}

func TestDeleteSubscriptionPlanRefusesWhileACardIsActive(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	unusedPlan := &SubscriptionPlan{Id: 9301, Title: "Unused", PriceAmount: 2, DurationUnit: SubscriptionDurationDay, DurationValue: 1, QuotaResetPeriod: SubscriptionResetDaily}
	servedPlan := &SubscriptionPlan{Id: 9302, Title: "Served", PriceAmount: 2, DurationUnit: SubscriptionDurationDay, DurationValue: 1, QuotaResetPeriod: SubscriptionResetDaily}
	endedPlan := &SubscriptionPlan{Id: 9303, Title: "Ended", PriceAmount: 2, DurationUnit: SubscriptionDurationDay, DurationValue: 1, QuotaResetPeriod: SubscriptionResetDaily}
	seedSubscriptionResetPlan(t, unusedPlan)
	seedSubscriptionResetPlan(t, servedPlan)
	seedSubscriptionResetPlan(t, endedPlan)
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9311, UserId: 111, PlanId: servedPlan.Id, AmountTotal: 100, StartTime: now - 3600, EndTime: now + 3600, Status: "active"})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9312, UserId: 111, PlanId: endedPlan.Id, AmountTotal: 100, StartTime: now - 7200, EndTime: now - 60, Status: "active"})

	var inUse *SubscriptionPlanInUseError
	err := DeleteSubscriptionPlan(servedPlan.Id)
	require.Error(t, err)
	require.ErrorAs(t, err, &inUse)
	assert.EqualValues(t, 1, inUse.Subscriptions)

	planCount := func(planId int) int64 {
		var count int64
		require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", planId).Count(&count).Error)
		return count
	}
	assert.EqualValues(t, 1, planCount(servedPlan.Id), "a plan serving an active card must survive the delete")

	require.NoError(t, DeleteSubscriptionPlan(unusedPlan.Id))
	assert.Zero(t, planCount(unusedPlan.Id))

	// A card that already ended is never billed again, so its plan is removable.
	require.NoError(t, DeleteSubscriptionPlan(endedPlan.Id))
	assert.Zero(t, planCount(endedPlan.Id))

	require.ErrorIs(t, DeleteSubscriptionPlan(endedPlan.Id), gorm.ErrRecordNotFound)
}

func TestResetUserSubscriptionQuotaNowSpendsOneResetPeriodAndRefills(t *testing.T) {
	truncateTables(t)

	const day = int64(24 * 60 * 60)
	now := GetDBTimestamp()
	weekPlan := &SubscriptionPlan{Id: 9501, Title: "Week", PriceAmount: 10, DurationUnit: SubscriptionDurationDay, DurationValue: 7, TotalAmount: 1000, TokenLimit: 100, QuotaResetPeriod: SubscriptionResetDaily}
	neverPlan := &SubscriptionPlan{Id: 9502, Title: "One shot", PriceAmount: 10, DurationUnit: SubscriptionDurationDay, DurationValue: 7, TotalAmount: 1000, TokenLimit: 100, QuotaResetPeriod: SubscriptionResetNever}
	weeklyPlan := &SubscriptionPlan{Id: 9503, Title: "Four weeks", PriceAmount: 40, DurationUnit: SubscriptionDurationDay, DurationValue: 28, TotalAmount: 4000, TokenLimit: 400, QuotaResetPeriod: SubscriptionResetWeekly}
	seedSubscriptionResetPlan(t, weekPlan)
	seedSubscriptionResetPlan(t, neverPlan)
	seedSubscriptionResetPlan(t, weeklyPlan)
	// The lookup behind the reset reads the plan cache, so drop anything cached
	// for these ids by an earlier test before relying on the seeded rows.
	InvalidateSubscriptionPlanCache(weekPlan.Id)
	InvalidateSubscriptionPlanCache(neverPlan.Id)
	InvalidateSubscriptionPlanCache(weeklyPlan.Id)
	// A running week card whose daily allowance ran out, five days before it ends.
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9511, UserId: 121, PlanId: weekPlan.Id, Status: "active", StartTime: now - 2*day, EndTime: now + 5*day, AmountTotal: 1000, AmountUsed: 1000, TokenLimitTotal: 100, TokenUsed: 100, LastResetTime: now - 3600, NextResetTime: now + 3600})
	// The same plan one day before it ends has nothing left to spend.
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9512, UserId: 121, PlanId: weekPlan.Id, Status: "active", StartTime: now - 6*day, EndTime: now + day - 10, AmountTotal: 1000, AmountUsed: 1000, TokenLimitTotal: 100, TokenUsed: 100, LastResetTime: now - 3600, NextResetTime: now + 3600})
	// A plan without periodic resets has no allowance to refill.
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9513, UserId: 121, PlanId: neverPlan.Id, Status: "active", StartTime: now - 2*day, EndTime: now + 5*day, AmountTotal: 1000, AmountUsed: 1000, TokenLimitTotal: 100, TokenUsed: 100, NextResetTime: 0})
	// A card with allowance left may still refill: running out first is not required.
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9514, UserId: 121, PlanId: weekPlan.Id, Status: "active", StartTime: now - 2*day, EndTime: now + 5*day, AmountTotal: 1000, AmountUsed: 40, TokenLimitTotal: 100, TokenUsed: 10, LastResetTime: now - 3600, NextResetTime: now + 3600})
	// A weekly card spends a whole week, so ten days left is enough and six is not.
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9515, UserId: 121, PlanId: weeklyPlan.Id, Status: "active", StartTime: now - 18*day, EndTime: now + 10*day, AmountTotal: 4000, AmountUsed: 4000, TokenLimitTotal: 400, TokenUsed: 400, LastResetTime: now - 3600, NextResetTime: now + 3600})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9516, UserId: 121, PlanId: weeklyPlan.Id, Status: "active", StartTime: now - 22*day, EndTime: now + 6*day, AmountTotal: 4000, AmountUsed: 4000, TokenLimitTotal: 400, TokenUsed: 400, LastResetTime: now - 3600, NextResetTime: now + 3600})

	message, err := ResetUserSubscriptionQuotaNow(121, 9511)
	require.NoError(t, err)
	require.NotNil(t, message)

	refilled := getSubscriptionResetSub(t, 9511)
	assert.EqualValues(t, now+4*day, refilled.EndTime, "one day of validity is spent")
	assert.Zero(t, refilled.AmountUsed)
	assert.Zero(t, refilled.TokenUsed)
	assert.Greater(t, refilled.NextResetTime, now)
	assert.EqualValues(t, 100, refilled.TokenLimitTotal, "the per-period allowance is unchanged")

	// The allowance does not have to run out first.
	_, err = ResetUserSubscriptionQuotaNow(121, 9514)
	require.NoError(t, err)
	partlyUsed := getSubscriptionResetSub(t, 9514)
	assert.EqualValues(t, now+4*day, partlyUsed.EndTime)
	assert.Zero(t, partlyUsed.TokenUsed)
	assert.Zero(t, partlyUsed.AmountUsed)

	// A weekly plan spends a week of validity.
	_, err = ResetUserSubscriptionQuotaNow(121, 9515)
	require.NoError(t, err)
	weekly := getSubscriptionResetSub(t, 9515)
	assert.EqualValues(t, now+3*day, weekly.EndTime, "a week of validity is spent")
	assert.Zero(t, weekly.TokenUsed)

	_, err = ResetUserSubscriptionQuotaNow(121, 9516)
	require.Error(t, err)
	assert.EqualValues(t, now+6*day, getSubscriptionResetSub(t, 9516).EndTime, "less than one period left is refused")

	_, err = ResetUserSubscriptionQuotaNow(121, 9512)
	require.Error(t, err)
	assert.EqualValues(t, now+day-10, getSubscriptionResetSub(t, 9512).EndTime)

	_, err = ResetUserSubscriptionQuotaNow(121, 9513)
	require.Error(t, err)
	assert.EqualValues(t, 1000, getSubscriptionResetSub(t, 9513).AmountUsed, "the usage of a plan without resets is left alone")

	_, err = ResetUserSubscriptionQuotaNow(122, 9511)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound, "another user's card must not be refillable")
}
