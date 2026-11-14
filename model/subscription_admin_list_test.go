package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// seedAdminListFixture lays out two users and four cards: two live (one of them
// ending within the week), one already expired, and one cancelled.
func seedAdminListFixture(t *testing.T) int64 {
	t.Helper()
	truncateTables(t)

	require.NoError(t, DB.Create(&User{Id: 701, Username: "alice", DisplayName: "Alice", Email: "alice@example.com", Group: "vip", AffCode: "alice701"}).Error)
	require.NoError(t, DB.Create(&User{Id: 702, Username: "bob", DisplayName: "Bob", Email: "bob@example.com", Group: "default", AffCode: "bob702"}).Error)

	pro := &SubscriptionPlan{
		Id:               9301,
		Title:            "Pro",
		PriceAmount:      20,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      2000,
		QuotaResetPeriod: SubscriptionResetDaily,
	}
	basic := &SubscriptionPlan{
		Id:               9302,
		Title:            "Basic",
		PriceAmount:      5,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      500,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	require.NoError(t, DB.Create(pro).Error)
	require.NoError(t, DB.Create(basic).Error)

	now := common.GetTimestamp()
	day := int64(86400)
	cards := []UserSubscription{
		{Id: 9311, UserId: 701, PlanId: pro.Id, AmountTotal: 2000, AmountUsed: 500, StartTime: now - day, EndTime: now + 3*day, Status: "active"},
		{Id: 9312, UserId: 702, PlanId: basic.Id, AmountTotal: 500, AmountUsed: 100, StartTime: now - day, EndTime: now + 20*day, Status: "active"},
		{Id: 9313, UserId: 701, PlanId: basic.Id, AmountTotal: 500, AmountUsed: 500, StartTime: now - 40*day, EndTime: now - day, Status: "expired"},
		{Id: 9314, UserId: 702, PlanId: pro.Id, AmountTotal: 2000, AmountUsed: 0, StartTime: now - day, EndTime: now + 30*day, Status: "cancelled"},
	}
	for i := range cards {
		require.NoError(t, DB.Create(&cards[i]).Error)
	}
	return now
}

func TestListAdminUserSubscriptionsJoinsUserAndPlanNewestExpiryFirst(t *testing.T) {
	seedAdminListFixture(t)

	page, err := ListAdminUserSubscriptions(SubscriptionAdminFilter{})
	require.NoError(t, err)
	require.NotNil(t, page)

	require.Len(t, page.Items, 4)
	assert.Equal(t, 20, page.PageSize)
	assert.Equal(t, 1, page.Page)
	assert.Equal(t, int64(4), page.Total)

	// Newest expiry first, so the operator reads what runs out last at the top.
	assert.Equal(t, []int{9314, 9312, 9311, 9313}, []int{
		page.Items[0].Id, page.Items[1].Id, page.Items[2].Id, page.Items[3].Id,
	})
	assert.Equal(t, "bob", page.Items[0].Username)
	assert.Equal(t, "Pro", page.Items[0].PlanTitle)
	assert.Equal(t, 20.0, page.Items[0].PriceAmount)
	assert.Equal(t, "vip", page.Items[2].UserGroup)
	assert.Equal(t, "Pro", page.Items[2].PlanTitle)
	assert.Equal(t, "Basic", page.Items[3].PlanTitle)
}

func TestListAdminUserSubscriptionsFiltersNarrowRowsAndSummary(t *testing.T) {
	seedAdminListFixture(t)

	active, err := ListAdminUserSubscriptions(SubscriptionAdminFilter{Status: "active"})
	require.NoError(t, err)
	assert.Len(t, active.Items, 2)
	assert.Equal(t, int64(2), active.Summary.Active)
	assert.Equal(t, int64(2), active.Summary.Total)

	byUser, err := ListAdminUserSubscriptions(SubscriptionAdminFilter{Keyword: "alice"})
	require.NoError(t, err)
	require.Len(t, byUser.Items, 2)
	assert.Equal(t, 701, byUser.Items[0].UserId)

	byId, err := ListAdminUserSubscriptions(SubscriptionAdminFilter{Keyword: "702"})
	require.NoError(t, err)
	require.Len(t, byId.Items, 2)
	assert.Equal(t, 702, byId.Items[0].UserId)

	byPlan, err := ListAdminUserSubscriptions(SubscriptionAdminFilter{PlanId: 9302})
	require.NoError(t, err)
	assert.Len(t, byPlan.Items, 2)

	// Only the live card ending inside the window counts; the expired one and the
	// live card ending in three weeks do not.
	expiring, err := ListAdminUserSubscriptions(SubscriptionAdminFilter{ExpiringDays: 7})
	require.NoError(t, err)
	require.Len(t, expiring.Items, 1)
	assert.Equal(t, 9311, expiring.Items[0].Id)

	everything, err := ListAdminUserSubscriptions(SubscriptionAdminFilter{})
	require.NoError(t, err)
	assert.Equal(t, int64(1), everything.Summary.ExpiringSoon)
	assert.Equal(t, int64(2), everything.Summary.Active)
	assert.Equal(t, int64(2), everything.Summary.Expired)
	assert.Equal(t, int64(5000), everything.Summary.AmountTotal)
	assert.Equal(t, int64(1100), everything.Summary.AmountUsed)
}

func TestListAdminUserSubscriptionsPagesWithoutChangingTheSummary(t *testing.T) {
	seedAdminListFixture(t)

	first, err := ListAdminUserSubscriptions(SubscriptionAdminFilter{Page: 1, PageSize: 3})
	require.NoError(t, err)
	require.Len(t, first.Items, 3)
	assert.Equal(t, int64(4), first.Total)

	second, err := ListAdminUserSubscriptions(SubscriptionAdminFilter{Page: 2, PageSize: 3})
	require.NoError(t, err)
	require.Len(t, second.Items, 1)
	assert.Equal(t, 2, second.Page)
	assert.Equal(t, int64(4), second.Total)
	assert.Equal(t, first.Summary, second.Summary)

	// An oversized page is capped instead of returning the whole table.
	capped, err := ListAdminUserSubscriptions(SubscriptionAdminFilter{PageSize: 5000})
	require.NoError(t, err)
	assert.Equal(t, subscriptionAdminPageMax, capped.PageSize)
}
