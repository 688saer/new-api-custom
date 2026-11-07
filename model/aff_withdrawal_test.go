package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setAffWithdrawalProgram 打开提现所需开关，测试结束时恢复
func setAffWithdrawalProgram(t *testing.T, alipayEnabled bool, feePercent, minQuota int) {
	t.Helper()

	oldEnabled := common.AffWithdrawAlipayEnabled
	oldFee := common.AffWithdrawFeePercent
	oldMin := common.AffWithdrawMinQuota
	oldUnit := common.QuotaPerUnit
	oldRate := operation_setting.USDExchangeRate
	oldConfirmed := operation_setting.GetPaymentSetting().ComplianceConfirmed
	oldVersion := operation_setting.GetPaymentSetting().ComplianceTermsVersion

	common.AffWithdrawAlipayEnabled = alipayEnabled
	common.AffWithdrawFeePercent = feePercent
	common.AffWithdrawMinQuota = minQuota
	common.QuotaPerUnit = 500000
	operation_setting.USDExchangeRate = 7
	operation_setting.GetPaymentSetting().ComplianceConfirmed = true
	operation_setting.GetPaymentSetting().ComplianceTermsVersion = "v1"

	t.Cleanup(func() {
		common.AffWithdrawAlipayEnabled = oldEnabled
		common.AffWithdrawFeePercent = oldFee
		common.AffWithdrawMinQuota = oldMin
		common.QuotaPerUnit = oldUnit
		operation_setting.USDExchangeRate = oldRate
		operation_setting.GetPaymentSetting().ComplianceConfirmed = oldConfirmed
		operation_setting.GetPaymentSetting().ComplianceTermsVersion = oldVersion
	})
}

func createAffWithdrawalTestUser(t *testing.T, affQuota int) User {
	t.Helper()

	user := User{
		Username:    "aff-withdraw-user",
		Password:    "unused-password-hash",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
		AuthVersion: 1,
		AffCode:     "aff-withdraw-code",
		AffQuota:    affQuota,
	}
	require.NoError(t, DB.Create(&user).Error)
	return user
}

// 提交冻结额度 → 审核通过不退回；费率按额度整数计算，到账金额按当前汇率折算。
func TestAffWithdrawalApproveKeepsFrozenQuota(t *testing.T) {
	setupUserUpdateTestState(t)
	require.NoError(t, DB.AutoMigrate(&AffWithdrawal{}))
	setAffWithdrawalProgram(t, true, 10, 0)

	user := createAffWithdrawalTestUser(t, 1000)

	withdrawal, err := CreateAffWithdrawal(CreateAffWithdrawalParams{
		UserId:   user.Id,
		Username: user.Username,
		Quota:    1000,
		Account:  "alipay@example.com",
		Name:     "张三",
	})
	require.NoError(t, err)
	assert.Equal(t, AffWithdrawalStatusPending, withdrawal.Status)
	assert.Equal(t, 10, withdrawal.FeePercent)
	assert.Equal(t, 100, withdrawal.FeeQuota)
	assert.Equal(t, 900, withdrawal.PayoutQuota)
	// 900 / 500000 * 7 = 0.0126 -> 0.01
	assert.Equal(t, 0.01, withdrawal.Money)

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 0, stored.AffQuota)

	page, err := ListAffWithdrawalsForUser(user.Id, 1, 20)
	require.NoError(t, err)
	assert.Equal(t, int64(1), page.Total)
	assert.Equal(t, AffWithdrawalStatusPending, page.Items[0].Status)

	reviewed, err := ReviewAffWithdrawal(withdrawal.Id, true, "paid", "admin")
	require.NoError(t, err)
	assert.Equal(t, AffWithdrawalStatusApproved, reviewed.Status)

	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 0, stored.AffQuota)

	// 已审核的申请不能重复审核
	_, err = ReviewAffWithdrawal(withdrawal.Id, true, "again", "admin")
	require.Error(t, err)
}

// 驳回必须给原因，并把冻结的额度退回 aff_quota。
func TestAffWithdrawalRejectReturnsFrozenQuota(t *testing.T) {
	setupUserUpdateTestState(t)
	require.NoError(t, DB.AutoMigrate(&AffWithdrawal{}))
	setAffWithdrawalProgram(t, true, 0, 0)

	user := createAffWithdrawalTestUser(t, 500)

	withdrawal, err := CreateAffWithdrawal(CreateAffWithdrawalParams{
		UserId:   user.Id,
		Username: user.Username,
		Quota:    500,
		Account:  "alipay@example.com",
		Name:     "张三",
	})
	require.NoError(t, err)

	_, err = ReviewAffWithdrawal(withdrawal.Id, false, "", "admin")
	require.Error(t, err)

	reviewed, err := ReviewAffWithdrawal(withdrawal.Id, false, "账号有误", "admin")
	require.NoError(t, err)
	assert.Equal(t, AffWithdrawalStatusRejected, reviewed.Status)
	assert.Equal(t, "账号有误", reviewed.AdminNote)

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 500, stored.AffQuota)
}

// 开关关闭、额度不足、低于最低额度、信息缺失时都拒绝提交。
func TestAffWithdrawalValidation(t *testing.T) {
	setupUserUpdateTestState(t)
	require.NoError(t, DB.AutoMigrate(&AffWithdrawal{}))
	setAffWithdrawalProgram(t, false, 0, 0)

	user := createAffWithdrawalTestUser(t, 100)

	_, err := CreateAffWithdrawal(CreateAffWithdrawalParams{
		UserId: user.Id, Quota: 50, Account: "a@example.com", Name: "张三",
	})
	require.Error(t, err)

	setAffWithdrawalProgram(t, true, 0, 200)
	_, err = CreateAffWithdrawal(CreateAffWithdrawalParams{
		UserId: user.Id, Quota: 50, Account: "a@example.com", Name: "张三",
	})
	require.Error(t, err)

	_, err = CreateAffWithdrawal(CreateAffWithdrawalParams{
		UserId: user.Id, Quota: 100, Account: "", Name: "张三",
	})
	require.Error(t, err)

	_, err = CreateAffWithdrawal(CreateAffWithdrawalParams{
		UserId: user.Id, Quota: 100, Account: "a@example.com", Name: "",
	})
	require.Error(t, err)

	_, err = CreateAffWithdrawal(CreateAffWithdrawalParams{
		UserId: user.Id, Quota: 101, Account: "a@example.com", Name: "张三",
	})
	require.Error(t, err)

	var stored User
	require.NoError(t, DB.First(&stored, user.Id).Error)
	assert.Equal(t, 100, stored.AffQuota)
}
