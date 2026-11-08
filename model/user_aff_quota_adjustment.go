package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var (
	ErrInvalidUserAffQuotaAdjustment = errors.New("invalid user referral quota adjustment")
	ErrUserAffQuotaPermission        = errors.New("cannot adjust referral quota for this user role")
	ErrUserAffQuotaNegative          = errors.New("referral quota cannot be negative")
)

// UserAffQuotaAdjustment is the immutable database snapshot of a committed
// manual referral-balance adjustment (the separate invite-reward wallet).
type UserAffQuotaAdjustment struct {
	UserID   int
	Username string
	Before   int
	After    int
}

// AdjustUserAffQuota adds, subtracts or overrides a user's referral balance
// (aff_quota), the independent wallet that holds invite rewards. It never
// touches the main quota balance and never lets the referral wallet go below 0.
func AdjustUserAffQuota(userID, operatorRole int, mode string, value int) (*UserAffQuotaAdjustment, error) {
	if userID <= 0 || (mode != "add" && mode != "subtract" && mode != "override") {
		return nil, ErrInvalidUserAffQuotaAdjustment
	}
	if mode != "override" && value <= 0 {
		return nil, ErrInvalidUserAffQuotaAdjustment
	}
	if value > common.MaxWalletQuota || value < -common.MaxWalletQuota {
		return nil, ErrWalletQuotaLimitExceeded
	}

	var adjustment UserAffQuotaAdjustment
	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := lockForUpdate(tx).First(&user, userID).Error; err != nil {
			return err
		}
		if operatorRole != common.RoleRootUser && operatorRole <= user.Role {
			return ErrUserAffQuotaPermission
		}
		after := user.AffQuota
		switch mode {
		case "add":
			after = user.AffQuota + value
		case "subtract":
			after = user.AffQuota - value
		case "override":
			after = value
		}
		if after < 0 {
			return ErrUserAffQuotaNegative
		}
		if after > common.MaxWalletQuota {
			return ErrWalletQuotaLimitExceeded
		}
		if after != user.AffQuota {
			result := tx.Model(&User{}).Where("id = ?", userID).Update("aff_quota", after)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected != 1 {
				return gorm.ErrRecordNotFound
			}
		}
		adjustment = UserAffQuotaAdjustment{UserID: user.Id, Username: user.Username, Before: user.AffQuota, After: after}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &adjustment, nil
}
