package model

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// resetRewardTables clears both reward tables so each case starts clean.
func resetRewardTables(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&RewardGrant{}).Error)
	require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(&RewardCampaign{}).Error)
}

// rewardErrorCode reads the stable code out of a RewardError for assertions.
func rewardErrorCode(err error) string {
	var rewardErr *RewardError
	if errors.As(err, &rewardErr) {
		return rewardErr.Code
	}
	return ""
}

// enableRewardSetting turns the feature on for the duration of one case, since
// ClaimRewardGrant refuses to credit anything while it is off.
func enableRewardSetting(t *testing.T) {
	t.Helper()
	setting := operation_setting.GetRewardSetting()
	previous := setting.Enabled
	setting.Enabled = true
	t.Cleanup(func() {
		setting.Enabled = previous
	})
}

func insertRewardCampaign(t *testing.T, expiresAt int64) *RewardCampaign {
	t.Helper()
	campaign := &RewardCampaign{
		Name:          "Test campaign",
		Style:         operation_setting.RewardStyleAurora,
		Copy:          `{"label":"New API","title":"Thanks","subtitle":"s","footer":"f","stub_text":"stub","stub_font_size":28,"button_text":"Claim"}`,
		AudienceScope: RewardScopeAll,
		RewardMode:    RewardModeFixed,
		FixedQuota:    1000,
		ExpiresAt:     expiresAt,
		TargetCount:   1,
		TotalQuota:    1000,
		CreatedAt:     time.Now().Unix(),
		Status:        RewardCampaignActive,
	}
	require.NoError(t, DB.Create(campaign).Error)
	return campaign
}

func insertRewardGrant(t *testing.T, campaignId, userId int, status string, expiresAt int64) *RewardGrant {
	t.Helper()
	grant := &RewardGrant{
		CampaignId:  campaignId,
		UserId:      userId,
		Status:      status,
		AmountQuota: 1000,
		ExpiresAt:   expiresAt,
		CreatedAt:   time.Now().Unix(),
	}
	require.NoError(t, DB.Create(grant).Error)
	return grant
}

// seedRewardGrant gives the user a reward through its own campaign, which keeps
// the unique (campaign_id, user_id) index satisfied when one case needs several
// rewards for the same user.
func seedRewardGrant(t *testing.T, userId int, status string, expiresAt int64) *RewardGrant {
	t.Helper()
	campaign := insertRewardCampaign(t, expiresAt)
	return insertRewardGrant(t, campaign.Id, userId, status, expiresAt)
}

func insertRewardUser(t *testing.T, userId int, username string, quota int) {
	t.Helper()
	user := &User{
		Id:       userId,
		Username: username,
		Password: "unused-password-hash",
		AffCode:  fmt.Sprintf("reward-aff-%d", userId),
		Quota:    quota,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(user).Error)
	t.Cleanup(func() {
		DB.Delete(&User{}, "id = ?", userId)
	})
}

func TestGetUserPendingRewardsOrdersByDeadline(t *testing.T) {
	resetRewardTables(t)
	enableRewardSetting(t)
	userId := 910001

	later := seedRewardGrant(t, userId, RewardGrantPending, time.Now().Unix()+7200)
	forever := seedRewardGrant(t, userId, RewardGrantPending, 0)
	sooner := seedRewardGrant(t, userId, RewardGrantPending, time.Now().Unix()+60)
	seedRewardGrant(t, userId, RewardGrantClaimed, 0)

	result, err := GetUserPendingRewards(userId)
	require.NoError(t, err)
	require.Len(t, result.Items, 3)

	// A campaign without a deadline sorts last; the rest ascend by deadline.
	assert.Equal(t, sooner.Id, result.Items[0].Id)
	assert.Equal(t, later.Id, result.Items[1].Id)
	assert.Equal(t, forever.Id, result.Items[2].Id)
	assert.Equal(t, 3000, result.TotalQuota)
	assert.Equal(t, 3, result.Count)
}

func TestGetUserPendingRewardsExpiresOverdueGrants(t *testing.T) {
	resetRewardTables(t)
	enableRewardSetting(t)
	userId := 910002
	overdue := seedRewardGrant(t, userId, RewardGrantPending, time.Now().Unix()-60)

	result, err := GetUserPendingRewards(userId)
	require.NoError(t, err)
	assert.Empty(t, result.Items)

	var stored RewardGrant
	require.NoError(t, DB.Where("id = ?", overdue.Id).First(&stored).Error)
	assert.Equal(t, RewardGrantExpired, stored.Status)
}

func TestClaimRewardGrantCreditsQuotaOnce(t *testing.T) {
	resetRewardTables(t)
	enableRewardSetting(t)
	userId := 910003
	campaign := insertRewardCampaign(t, 0)
	grant := insertRewardGrant(t, campaign.Id, userId, RewardGrantPending, 0)
	insertRewardUser(t, userId, "reward-claim", 500)

	result, err := ClaimRewardGrant(userId, grant.Id)
	require.NoError(t, err)
	assert.False(t, result.AlreadyClaimed)
	assert.Equal(t, 1000, result.AmountQuota)
	assert.Equal(t, 1500, result.Balance)

	var storedUser User
	require.NoError(t, DB.Where("id = ?", userId).First(&storedUser).Error)
	assert.Equal(t, 1500, storedUser.Quota)

	var storedCampaign RewardCampaign
	require.NoError(t, DB.Where("id = ?", campaign.Id).First(&storedCampaign).Error)
	assert.Equal(t, 1, storedCampaign.ClaimedCount)

	// A second claim is idempotent: it reports already claimed plus the balance
	// instead of failing, and never credits twice.
	again, err := ClaimRewardGrant(userId, grant.Id)
	require.NoError(t, err)
	assert.True(t, again.AlreadyClaimed)
	assert.Equal(t, 1500, again.Balance)

	require.NoError(t, DB.Where("id = ?", userId).First(&storedUser).Error)
	assert.Equal(t, 1500, storedUser.Quota)
}

func TestClaimRewardGrantRejectsForeignGrant(t *testing.T) {
	resetRewardTables(t)
	enableRewardSetting(t)
	campaign := insertRewardCampaign(t, 0)
	grant := insertRewardGrant(t, campaign.Id, 910004, RewardGrantPending, 0)

	_, err := ClaimRewardGrant(910005, grant.Id)
	require.Error(t, err)
	assert.Equal(t, RewardCodeNotFound, rewardErrorCode(err))
}

func TestClaimRewardGrantRejectsWithdrawnAndExpired(t *testing.T) {
	resetRewardTables(t)
	enableRewardSetting(t)
	campaign := insertRewardCampaign(t, 0)
	cancelled := insertRewardGrant(t, campaign.Id, 910006, RewardGrantCancelled, 0)
	expired := insertRewardGrant(t, campaign.Id, 910007, RewardGrantPending, time.Now().Unix()-60)

	_, err := ClaimRewardGrant(910006, cancelled.Id)
	require.Error(t, err)
	assert.Equal(t, RewardCodeCancelled, rewardErrorCode(err))

	_, err = ClaimRewardGrant(910007, expired.Id)
	require.Error(t, err)
	assert.Equal(t, RewardCodeExpired, rewardErrorCode(err))
}

func TestClaimRewardGrantHonoursQuotaCap(t *testing.T) {
	resetRewardTables(t)
	enableRewardSetting(t)
	userId := 910008
	campaign := insertRewardCampaign(t, 0)
	grant := insertRewardGrant(t, campaign.Id, userId, RewardGrantPending, 0)
	insertRewardUser(t, userId, "reward-cap", 900)

	setting := operation_setting.GetRewardSetting()
	previous := setting.MaxQuotaLimit
	setting.MaxQuotaLimit = 1000
	t.Cleanup(func() {
		setting.MaxQuotaLimit = previous
	})

	_, err := ClaimRewardGrant(userId, grant.Id)
	require.Error(t, err)
	assert.Equal(t, RewardCodeQuotaExceeded, rewardErrorCode(err))

	var storedUser User
	require.NoError(t, DB.Where("id = ?", userId).First(&storedUser).Error)
	assert.Equal(t, 900, storedUser.Quota)
}

func TestRevokeRewardCampaignCancelsOnlyPending(t *testing.T) {
	resetRewardTables(t)
	campaign := insertRewardCampaign(t, 0)
	pending := insertRewardGrant(t, campaign.Id, 910009, RewardGrantPending, 0)
	claimed := insertRewardGrant(t, campaign.Id, 910010, RewardGrantClaimed, 0)

	summary, err := RevokeRewardCampaign(campaign.Id)
	require.NoError(t, err)
	assert.Equal(t, RewardCampaignRevoked, summary.Status)

	var storedPending RewardGrant
	require.NoError(t, DB.Where("id = ?", pending.Id).First(&storedPending).Error)
	assert.Equal(t, RewardGrantCancelled, storedPending.Status)
	assert.NotZero(t, storedPending.CancelledAt)

	var storedClaimed RewardGrant
	require.NoError(t, DB.Where("id = ?", claimed.Id).First(&storedClaimed).Error)
	assert.Equal(t, RewardGrantClaimed, storedClaimed.Status)

	_, err = RevokeRewardCampaign(campaign.Id)
	require.Error(t, err)
	assert.Equal(t, "REWARD_ALREADY_REVOKED", rewardErrorCode(err))
}

func TestGetUserRewardHistoryListsOnlySettledGrants(t *testing.T) {
	resetRewardTables(t)
	enableRewardSetting(t)
	userId := 910011
	pending := seedRewardGrant(t, userId, RewardGrantPending, 0)
	claimed := seedRewardGrant(t, userId, RewardGrantClaimed, 0)
	cancelled := seedRewardGrant(t, userId, RewardGrantCancelled, 0)

	// Pending tickets have their own endpoint, so the claim history must not
	// repeat them.
	result, err := GetUserRewardHistory(userId, 1, 20)
	require.NoError(t, err)
	assert.Equal(t, 2, result.Total)
	require.Len(t, result.Items, 2)
	assert.Equal(t, cancelled.Id, result.Items[0].Id)
	assert.Equal(t, claimed.Id, result.Items[1].Id)
	for _, item := range result.Items {
		assert.NotEqual(t, pending.Id, item.Id)
	}
}

func TestPreviewRewardCampaignRejectsInvalidDraft(t *testing.T) {
	resetRewardTables(t)

	_, err := PreviewRewardCampaign(RewardCampaignDraft{
		Name:       "",
		RewardMode: RewardModeFixed,
		FixedQuota: 1000,
	})
	require.Error(t, err)
	assert.Equal(t, "REWARD_INVALID_NAME", rewardErrorCode(err))

	_, err = PreviewRewardCampaign(RewardCampaignDraft{
		Name:       "No amount",
		RewardMode: RewardModeFixed,
		FixedQuota: 0,
	})
	require.Error(t, err)
	assert.Equal(t, "REWARD_INVALID_AMOUNT", rewardErrorCode(err))

	_, err = PreviewRewardCampaign(RewardCampaignDraft{
		Name:       "Bad expiry",
		RewardMode: RewardModeFixed,
		FixedQuota: 1000,
		ExpiresAt:  time.Now().Unix() - 60,
	})
	require.Error(t, err)
	assert.Equal(t, "REWARD_INVALID_EXPIRY", rewardErrorCode(err))
}
