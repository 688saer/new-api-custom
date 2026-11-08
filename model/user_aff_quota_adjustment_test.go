package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 后台对独立返利钱包（aff_quota）的加减：只动返利余额，不动主余额和历史总收入。
func TestAdjustUserAffQuotaKeepsBalancesSeparate(t *testing.T) {
	setupUserUpdateTestState(t)

	user := createInviteTestUser(t, "aff-adjust-user", 0)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Updates(map[string]any{
		"quota":       9000,
		"aff_quota":   1000,
		"aff_history": 1500,
	}).Error)

	adjustment, err := AdjustUserAffQuota(user.Id, common.RoleRootUser, "add", 500)
	require.NoError(t, err)
	assert.Equal(t, 1000, adjustment.Before)
	assert.Equal(t, 1500, adjustment.After)

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 1500, stored.AffQuota)
	assert.Equal(t, 1500, stored.AffHistoryQuota)
	assert.Equal(t, 9000, stored.Quota)

	_, err = AdjustUserAffQuota(user.Id, common.RoleRootUser, "subtract", 400)
	require.NoError(t, err)
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 1100, stored.AffQuota)

	_, err = AdjustUserAffQuota(user.Id, common.RoleRootUser, "override", 0)
	require.NoError(t, err)
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Zero(t, stored.AffQuota)
}

func TestAdjustUserAffQuotaRejectsNegativeAndInvalidInput(t *testing.T) {
	setupUserUpdateTestState(t)

	user := createInviteTestUser(t, "aff-adjust-guard", 0)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Update("aff_quota", 100).Error)

	_, err := AdjustUserAffQuota(user.Id, common.RoleRootUser, "subtract", 101)
	require.ErrorIs(t, err, ErrUserAffQuotaNegative)

	_, err = AdjustUserAffQuota(user.Id, common.RoleRootUser, "subtract", 0)
	require.ErrorIs(t, err, ErrInvalidUserAffQuotaAdjustment)

	_, err = AdjustUserAffQuota(user.Id, common.RoleRootUser, "replace", 10)
	require.ErrorIs(t, err, ErrInvalidUserAffQuotaAdjustment)

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 100, stored.AffQuota)
}

func TestAdjustUserAffQuotaPermission(t *testing.T) {
	setupUserUpdateTestState(t)

	user := createInviteTestUser(t, "aff-adjust-role", 0)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", user.Id).Updates(map[string]any{
		"aff_quota": 100,
		"role":      common.RoleAdminUser,
	}).Error)

	// 普通管理员不能调整同级用户的返利余额
	_, err := AdjustUserAffQuota(user.Id, common.RoleAdminUser, "add", 10)
	require.ErrorIs(t, err, ErrUserAffQuotaPermission)

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 100, stored.AffQuota)

	// 超级管理员可以调整
	adjustment, err := AdjustUserAffQuota(user.Id, common.RoleRootUser, "add", 10)
	require.NoError(t, err)
	assert.Equal(t, 110, adjustment.After)
}
