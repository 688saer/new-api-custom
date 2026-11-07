package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setInviteProgram 打开奖励程序所需的开关，测试结束时恢复
func setInviteProgram(t *testing.T, registerReward bool, rebate bool, percent int) {
	t.Helper()

	oldRegister := common.InviteRegisterRewardEnabled
	oldRebate := common.InviteRebateEnabled
	oldPercent := common.InviteRebatePercent
	oldInviter := common.QuotaForInviter
	oldInvitee := common.QuotaForInvitee
	oldConfirmed := operation_setting.GetPaymentSetting().ComplianceConfirmed
	oldVersion := operation_setting.GetPaymentSetting().ComplianceTermsVersion

	common.InviteRegisterRewardEnabled = registerReward
	common.InviteRebateEnabled = rebate
	common.InviteRebatePercent = percent
	common.QuotaForInviter = 200
	common.QuotaForInvitee = 100
	operation_setting.GetPaymentSetting().ComplianceConfirmed = true
	operation_setting.GetPaymentSetting().ComplianceTermsVersion = "v1"

	t.Cleanup(func() {
		common.InviteRegisterRewardEnabled = oldRegister
		common.InviteRebateEnabled = oldRebate
		common.InviteRebatePercent = oldPercent
		common.QuotaForInviter = oldInviter
		common.QuotaForInvitee = oldInvitee
		operation_setting.GetPaymentSetting().ComplianceConfirmed = oldConfirmed
		operation_setting.GetPaymentSetting().ComplianceTermsVersion = oldVersion
	})
}

func createInviteTestUser(t *testing.T, username string, inviterId int) User {
	t.Helper()

	user := User{
		Username:    username,
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
		AffCode:     username + "-aff",
		InviterId:   inviterId,
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

// 注册奖励与消费返利是两个独立开关：只开一个时另一个必须不生效。
func TestInviteRegisterRewardAndRebateSwitchIndependently(t *testing.T) {
	setupUserUpdateTestState(t)

	// 只开注册奖励
	setInviteProgram(t, true, false, 5)
	inviter := createInviteTestUser(t, "invite-reward-inviter", 0)
	invitee := createInviteTestUser(t, "invite-reward-invitee", inviter.Id)

	invitee.grantInviteRewards(inviter.Id)

	var inviterAfterSignup User
	require.NoError(t, DB.First(&inviterAfterSignup, inviter.Id).Error)
	assert.Equal(t, common.QuotaForInviter, inviterAfterSignup.AffQuota)
	assert.Equal(t, 1, inviterAfterSignup.AffCount)

	var inviteeAfterSignup User
	require.NoError(t, DB.First(&inviteeAfterSignup, invitee.Id).Error)
	assert.Equal(t, common.QuotaForInvitee, inviteeAfterSignup.Quota)

	credited, err := CreditInviteRebate(invitee.Id, 1000)
	require.NoError(t, err)
	assert.Zero(t, credited)

	// 只开消费返利
	setInviteProgram(t, false, true, 5)
	rebateInvitee := createInviteTestUser(t, "rebate-only-invitee", inviter.Id)
	rebateInvitee.grantInviteRewards(inviter.Id)

	var inviterAfterOff User
	require.NoError(t, DB.First(&inviterAfterOff, inviter.Id).Error)
	assert.Equal(t, common.QuotaForInviter, inviterAfterOff.AffQuota)
	assert.Equal(t, 1, inviterAfterOff.AffCount)

	credited, err = CreditInviteRebate(rebateInvitee.Id, 1000)
	require.NoError(t, err)
	assert.Equal(t, 50, credited)

	var inviterAfterRebate User
	require.NoError(t, DB.First(&inviterAfterRebate, inviter.Id).Error)
	assert.Equal(t, common.QuotaForInviter+50, inviterAfterRebate.AffQuota)
	assert.Equal(t, common.QuotaForInviter+50, inviterAfterRebate.AffHistoryQuota)
}

// 没有邀请人、消费为 0、或比例取整为 0 时都不入账。
func TestCreditInviteRebateSkipsWhenNothingIsOwed(t *testing.T) {
	setupUserUpdateTestState(t)
	setInviteProgram(t, true, true, 1)

	inviter := createInviteTestUser(t, "rebate-skip-inviter", 0)
	invitee := createInviteTestUser(t, "rebate-skip-invitee", inviter.Id)
	lonely := createInviteTestUser(t, "rebate-skip-lonely", 0)

	assertRebate := func(userId int, cost int, expected int) {
		t.Helper()
		credited, err := CreditInviteRebate(userId, cost)
		require.NoError(t, err)
		assert.Equal(t, expected, credited)
	}

	assertRebate(lonely.Id, 100000, 0)
	assertRebate(invitee.Id, 0, 0)
	assertRebate(invitee.Id, -50, 0)
	// 1% of 50 rounds down to zero
	assertRebate(invitee.Id, 50, 0)
	assertRebate(invitee.Id, 1000, 10)

	var stored User
	require.NoError(t, DB.First(&stored, inviter.Id).Error)
	assert.Equal(t, 10, stored.AffQuota)
}
