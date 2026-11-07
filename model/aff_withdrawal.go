package model

import (
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// 邀请奖励提现（支付宝）
// ---------------------------------------------------------------------------

// 提现申请状态：pending 待审核，approved 已打款，rejected 已驳回。
const (
	AffWithdrawalStatusPending  = "pending"
	AffWithdrawalStatusApproved = "approved"
	AffWithdrawalStatusRejected = "rejected"
)

// 字段长度上限，与前端表单一致
const (
	affWithdrawalAccountMax = 100
	affWithdrawalNameMax    = 50
	affWithdrawalNoteMax    = 200
	affWithdrawalPageMax    = 100
)

// AffWithdrawal 是一条把邀请奖励（aff_quota）提现到支付宝的申请。
// 提交时冻结 quota，审核通过后 fee_quota 归平台、其余按 money 线下打款；
// 驳回时把冻结的 quota 退回用户的 aff_quota。
type AffWithdrawal struct {
	Id           int     `json:"id" gorm:"primaryKey"`
	UserId       int     `json:"user_id" gorm:"index;not null"`
	Username     string  `json:"username" gorm:"size:64;not null"`
	Quota        int     `json:"quota" gorm:"not null"`
	FeePercent   int     `json:"fee_percent" gorm:"not null"`
	FeeQuota     int     `json:"fee_quota" gorm:"not null"`
	PayoutQuota  int     `json:"payout_quota" gorm:"not null"`
	Money        float64 `json:"money" gorm:"not null"`
	Account      string  `json:"account" gorm:"size:100;not null"`
	Name         string  `json:"name" gorm:"size:50;not null"`
	Status       string  `json:"status" gorm:"size:16;index;not null"`
	AdminNote    string  `json:"admin_note" gorm:"size:200"`
	ReviewerName string  `json:"reviewer_name" gorm:"size:64"`
	CreateTime   int64   `json:"create_time" gorm:"index;not null"`
	ReviewTime   int64   `json:"review_time"`
}

// CreateAffWithdrawalParams 用户提交的提现申请内容。
type CreateAffWithdrawalParams struct {
	UserId   int
	Username string
	Quota    int
	Account  string
	Name     string
}

// AffWithdrawalFilter 后台列表筛选条件。
type AffWithdrawalFilter struct {
	Status   string
	Keyword  string
	Page     int
	PageSize int
}

type AffWithdrawalPage struct {
	Items    []AffWithdrawal `json:"items"`
	Total    int64           `json:"total"`
	Page     int             `json:"page"`
	PageSize int             `json:"page_size"`
}

func normalizeAffWithdrawalPage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > affWithdrawalPageMax {
		pageSize = affWithdrawalPageMax
	}
	return page, pageSize
}

// affQuotaToCNY 把额度按当前站点汇率折算成人民币，保留两位小数。
func affQuotaToCNY(quota int) (float64, error) {
	if common.QuotaPerUnit <= 0 {
		return 0, common.NewMessage("The quota unit price is not configured")
	}
	money, _ := decimal.NewFromInt(int64(quota)).
		Div(decimal.NewFromFloat(common.QuotaPerUnit)).
		Mul(decimal.NewFromFloat(operation_setting.USDExchangeRate)).
		Round(2).Float64()
	return money, nil
}

// CreateAffWithdrawal 校验并冻结用户邀请额度，写入一条提现申请。
func CreateAffWithdrawal(params CreateAffWithdrawalParams) (*AffWithdrawal, error) {
	if !common.AffWithdrawAlipayEnabled {
		return nil, common.NewMessage("Alipay withdrawal is not enabled")
	}
	params.Account = strings.TrimSpace(params.Account)
	params.Name = strings.TrimSpace(params.Name)
	if params.Account == "" {
		return nil, common.NewMessage("Enter your Alipay account")
	}
	if params.Name == "" {
		return nil, common.NewMessage("Enter the account holder's name")
	}
	if len(params.Account) > affWithdrawalAccountMax {
		return nil, common.NewMessage("The Alipay account is too long")
	}
	if len(params.Name) > affWithdrawalNameMax {
		return nil, common.NewMessage("The account holder's name is too long")
	}
	if params.Quota <= 0 {
		return nil, common.NewMessage("Enter an amount to withdraw")
	}
	if common.AffWithdrawMinQuota > 0 && params.Quota < common.AffWithdrawMinQuota {
		return nil, common.NewMessage("Minimum withdrawal quota is {{min}}!", map[string]any{"min": logger.FormatQuota(common.AffWithdrawMinQuota)})
	}
	percent := min(common.AffWithdrawFeePercent, 100)
	feeQuota := int(int64(params.Quota) * int64(percent) / 100)
	payoutQuota := params.Quota - feeQuota
	money, err := affQuotaToCNY(payoutQuota)
	if err != nil {
		return nil, err
	}

	withdrawal := &AffWithdrawal{
		UserId:      params.UserId,
		Username:    params.Username,
		Quota:       params.Quota,
		FeePercent:  percent,
		FeeQuota:    feeQuota,
		PayoutQuota: payoutQuota,
		Money:       money,
		Account:     params.Account,
		Name:        params.Name,
		Status:      AffWithdrawalStatusPending,
		CreateTime:  time.Now().Unix(),
	}

	tx := DB.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer tx.Rollback()

	var user User
	if err := lockForUpdate(tx).First(&user, params.UserId).Error; err != nil {
		return nil, err
	}
	if user.AffQuota < params.Quota {
		return nil, common.NewMessage("Invitation quota is insufficient!")
	}

	if err := tx.Create(withdrawal).Error; err != nil {
		return nil, err
	}
	if err := tx.Model(&User{}).Where("id = ?", params.UserId).
		Update("aff_quota", user.AffQuota-params.Quota).Error; err != nil {
		return nil, err
	}
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	RecordLog(params.UserId, LogTypeSystem, common.NewMessage("Alipay withdrawal request submitted {{quota}}", map[string]any{"quota": logger.FormatQuota(params.Quota)}))
	return withdrawal, nil
}

// ListAffWithdrawalsForUser 当前用户自己的提现记录。
func ListAffWithdrawalsForUser(userId, page, pageSize int) (*AffWithdrawalPage, error) {
	page, pageSize = normalizeAffWithdrawalPage(page, pageSize)
	var items []AffWithdrawal
	query := DB.Model(&AffWithdrawal{}).Where("user_id = ?", userId)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}
	if err := query.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).Find(&items).Error; err != nil {
		return nil, err
	}
	return &AffWithdrawalPage{Items: items, Total: total, Page: page, PageSize: pageSize}, nil
}

// ListAffWithdrawals 后台提现列表。
func ListAffWithdrawals(filter AffWithdrawalFilter) (*AffWithdrawalPage, error) {
	page, pageSize := normalizeAffWithdrawalPage(filter.Page, filter.PageSize)
	query := DB.Model(&AffWithdrawal{})
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if keyword := strings.TrimSpace(filter.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("username LIKE ? OR account LIKE ? OR name LIKE ?", like, like, like)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}
	var items []AffWithdrawal
	if err := query.Order("id desc").Limit(pageSize).Offset((page - 1) * pageSize).Find(&items).Error; err != nil {
		return nil, err
	}
	return &AffWithdrawalPage{Items: items, Total: total, Page: page, PageSize: pageSize}, nil
}

// ReviewAffWithdrawal 审核：通过即确认线下打款，驳回则退回冻结的邀请额度。
func ReviewAffWithdrawal(id int, approve bool, adminNote string, reviewerName string) (*AffWithdrawal, error) {
	adminNote = strings.TrimSpace(adminNote)
	if len(adminNote) > affWithdrawalNoteMax {
		return nil, common.NewMessage("The note is too long")
	}
	if !approve && adminNote == "" {
		return nil, common.NewMessage("Tell the user why the withdrawal was rejected")
	}

	tx := DB.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer tx.Rollback()

	var withdrawal AffWithdrawal
	if err := lockForUpdate(tx).First(&withdrawal, id).Error; err != nil {
		return nil, err
	}
	if withdrawal.Status != AffWithdrawalStatusPending {
		return nil, common.NewMessage("This withdrawal request has already been reviewed")
	}

	if approve {
		withdrawal.Status = AffWithdrawalStatusApproved
	} else {
		withdrawal.Status = AffWithdrawalStatusRejected
	}
	withdrawal.AdminNote = adminNote
	withdrawal.ReviewerName = reviewerName
	withdrawal.ReviewTime = time.Now().Unix()

	if err := tx.Save(&withdrawal).Error; err != nil {
		return nil, err
	}
	if !approve {
		if err := tx.Model(&User{}).Where("id = ?", withdrawal.UserId).
			Update("aff_quota", gorm.Expr("aff_quota + ?", withdrawal.Quota)).Error; err != nil {
			return nil, err
		}
	}
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	if approve {
		RecordLog(withdrawal.UserId, LogTypeSystem, common.NewMessage("Alipay withdrawal approved {{quota}}", map[string]any{"quota": logger.FormatQuota(withdrawal.Quota)}))
	} else {
		RecordLog(withdrawal.UserId, LogTypeSystem, common.NewMessage("Alipay withdrawal rejected and rewards returned {{quota}}", map[string]any{"quota": logger.FormatQuota(withdrawal.Quota)}))
	}
	return &withdrawal, nil
}
