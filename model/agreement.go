package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm/clause"
)

// ---------------------------------------------------------------------------
// 购买协议签署记录
// ---------------------------------------------------------------------------

// 协议标识，未来新增其它协议时用不同 key 区分
const AgreementKeyPurchase = "purchase"

// PurchaseAgreementSignature 一次购买前的签署记录。
// 同一用户在同一协议版本上只留第一条记录，之后重复购买不重复写入。
type PurchaseAgreementSignature struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"not null;uniqueIndex:idx_agreement_signature,priority:1"`
	Username     string `json:"username" gorm:"type:varchar(64);not null;default:''"`
	AgreementKey string `json:"agreement_key" gorm:"type:varchar(32);not null;default:'purchase';uniqueIndex:idx_agreement_signature,priority:2"`
	Version      string `json:"version" gorm:"type:varchar(32);not null;default:'1.0';uniqueIndex:idx_agreement_signature,priority:3"`
	Scene        string `json:"scene" gorm:"type:varchar(32);not null;default:''"`
	Ip           string `json:"ip" gorm:"type:varchar(64);not null;default:''"`
	UserAgent    string `json:"user_agent" gorm:"type:varchar(255);not null;default:''"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;not null;default:0;index:idx_agreement_signature_user"`
}

func (PurchaseAgreementSignature) TableName() string {
	return "purchase_agreement_signatures"
}

// HasSignedPurchaseAgreement 当前版本是否已签署
func HasSignedPurchaseAgreement(userId int, version string) (bool, error) {
	var count int64
	err := DB.Model(&PurchaseAgreementSignature{}).
		Where("user_id = ? AND agreement_key = ? AND version = ?", userId, AgreementKeyPurchase, version).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// SignPurchaseAgreement 记录签署。已签过同一版本时直接返回，不重复写入。
func SignPurchaseAgreement(userId int, username, scene, version, ip, userAgent string) error {
	signature := &PurchaseAgreementSignature{
		UserId:       userId,
		Username:     username,
		AgreementKey: AgreementKeyPurchase,
		Version:      version,
		Scene:        scene,
		Ip:           ip,
		UserAgent:    truncateRunes(userAgent, 255),
		CreatedAt:    common.GetTimestamp(),
	}
	return DB.Clauses(clause.OnConflict{DoNothing: true}).Create(signature).Error
}

// ListPurchaseAgreementSignatures 后台查看签署记录
func ListPurchaseAgreementSignatures(keyword string, page, pageSize int) (*PurchaseAgreementSignaturePage, error) {
	page, pageSize = normalizeInvoicePage(page, pageSize)

	query := DB.Model(&PurchaseAgreementSignature{})
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("username LIKE ? OR version LIKE ?", like, like)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	items := make([]PurchaseAgreementSignature, 0)
	if err := query.Order("id desc").
		Offset((page - 1) * pageSize).Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, err
	}
	return &PurchaseAgreementSignaturePage{Items: items, Total: total, Page: page, PageSize: pageSize}, nil
}

// PurchaseAgreementSignaturePage 分页结果
type PurchaseAgreementSignaturePage struct {
	Items    []PurchaseAgreementSignature `json:"items"`
	Total    int64                        `json:"total"`
	Page     int                          `json:"page"`
	PageSize int                          `json:"page_size"`
}

// PurchaseAgreementState 前端渲染协议弹窗所需的全部状态
type PurchaseAgreementState struct {
	Enabled       bool   `json:"enabled"`
	Title         string `json:"title"`
	Version       string `json:"version"`
	Content       string `json:"content"`
	Signed        bool   `json:"signed"`
	RequireTopup  bool   `json:"require_topup"`
	RequireRedeem bool   `json:"require_redemption"`
	RequirePlan   bool   `json:"require_subscription"`
}

// GetPurchaseAgreementState 汇总协议配置与当前用户的签署状态
func GetPurchaseAgreementState(userId int) (*PurchaseAgreementState, error) {
	setting := operation_setting.GetPurchaseAgreementSetting()
	version := operation_setting.PurchaseAgreementVersion()

	signed := false
	if setting.Enabled && userId > 0 {
		has, err := HasSignedPurchaseAgreement(userId, version)
		if err != nil {
			return nil, err
		}
		signed = has
	}

	return &PurchaseAgreementState{
		Enabled:       setting.Enabled,
		Title:         operation_setting.PurchaseAgreementTitle(),
		Version:       version,
		Content:       setting.Content,
		Signed:        signed,
		RequireTopup:  operation_setting.PurchaseAgreementRequired(operation_setting.PurchaseSceneTopup),
		RequireRedeem: operation_setting.PurchaseAgreementRequired(operation_setting.PurchaseSceneRedemption),
		RequirePlan:   operation_setting.PurchaseAgreementRequired(operation_setting.PurchaseSceneSubscription),
	}, nil
}

// truncateRunes 按字符截断，避免把多字节字符切坏
func truncateRunes(value string, limit int) string {
	if limit <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}
