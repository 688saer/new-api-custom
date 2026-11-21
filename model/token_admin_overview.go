package model

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// adminApiKeyUserPageMax caps one page of the operator board, so the console
// cannot ask the database for every user with a key in one shot.
const adminApiKeyUserPageMax = 50

// adminApiKeyPerUserMax caps the keys listed under one user. A user may own
// hundreds of keys; the board answers "can this user call, and with what",
// which the first keys already show, and key_count still reports the real total.
const adminApiKeyPerUserMax = 50

// AdminEnabledApiKeyFilter narrows the board of enabled API keys per user.
type AdminEnabledApiKeyFilter struct {
	// Keyword selects the users to show, matching the username, display name,
	// email, an exact user id, or the name of one of their enabled keys. A
	// selected user is then listed with every enabled key they own.
	Keyword  string
	Page     int
	PageSize int
}

// AdminEnabledApiKey is one enabled API key, shaped for the operator board.
// The key itself is masked here, so a full secret never leaves the model layer.
type AdminEnabledApiKey struct {
	Id                 int    `json:"id"`
	Name               string `json:"name"`
	MaskedKey          string `json:"masked_key"`
	Group              string `json:"group"`
	RemainQuota        int    `json:"remain_quota"`
	UsedQuota          int    `json:"used_quota"`
	UnlimitedQuota     bool   `json:"unlimited_quota"`
	ExpiredTime        int64  `json:"expired_time"`
	CreatedTime        int64  `json:"created_time"`
	AccessedTime       int64  `json:"accessed_time"`
	ModelLimitsEnabled bool   `json:"model_limits_enabled"`
	ModelLimits        string `json:"model_limits"`
}

// AdminEnabledApiKeyUser is one user with the keys they can call with.
type AdminEnabledApiKeyUser struct {
	UserId      int                  `json:"user_id"`
	Username    string               `json:"username"`
	DisplayName string               `json:"display_name"`
	Email       string               `json:"email"`
	UserGroup   string               `json:"user_group"`
	UserStatus  int                  `json:"user_status"`
	KeyCount    int                  `json:"key_count"`
	Keys        []AdminEnabledApiKey `json:"keys"`
}

// AdminEnabledApiKeyPage is one page of the board.
type AdminEnabledApiKeyPage struct {
	Items    []AdminEnabledApiKeyUser `json:"items"`
	Total    int64                    `json:"total"`
	KeyTotal int64                    `json:"key_total"`
	Page     int                      `json:"page"`
	PageSize int                      `json:"page_size"`
}

// adminEnabledApiKeyOwnerQuery selects the users the board shows: owners that
// still exist and hold at least one enabled key matching the keyword. It is
// built from Table() rather than Model(), so the deleted_at conditions below are
// the only soft-delete filters and stay qualified for both joined tables.
func adminEnabledApiKeyOwnerQuery(filter AdminEnabledApiKeyFilter) *gorm.DB {
	query := DB.Table("tokens").
		Select("tokens.user_id").
		Joins("LEFT JOIN users ON users.id = tokens.user_id").
		Where("tokens.deleted_at IS NULL").
		Where("tokens.status = ?", common.TokenStatusEnabled).
		Where("users.deleted_at IS NULL")

	if keyword := strings.TrimSpace(filter.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		pattern := "tokens.name LIKE ? OR users.username LIKE ? OR users.display_name LIKE ? OR users.email LIKE ?"
		args := []any{like, like, like, like}
		if userId, err := strconv.Atoi(keyword); err == nil {
			pattern += " OR tokens.user_id = ?"
			args = append(args, userId)
		}
		query = query.Where(pattern, args...)
	}
	return query
}

// adminEnabledApiKeyTotalKeys counts the enabled keys of every selected user.
func adminEnabledApiKeyTotalKeys(filter AdminEnabledApiKeyFilter) *gorm.DB {
	return DB.Table("tokens").
		Select("COUNT(*)").
		Where("tokens.deleted_at IS NULL").
		Where("tokens.status = ?", common.TokenStatusEnabled).
		Where("tokens.user_id IN (?)", adminEnabledApiKeyOwnerQuery(filter))
}

// adminEnabledApiKeyKeyCounts counts the enabled keys of each selected user.
func adminEnabledApiKeyKeyCounts(filter AdminEnabledApiKeyFilter) *gorm.DB {
	return DB.Table("tokens").
		Select("tokens.user_id AS user_id, COUNT(*) AS key_count").
		Where("tokens.deleted_at IS NULL").
		Where("tokens.status = ?", common.TokenStatusEnabled).
		Where("tokens.user_id IN (?)", adminEnabledApiKeyOwnerQuery(filter)).
		Group("tokens.user_id")
}

func normalizeAdminApiKeyPage(page int, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}
	if pageSize > adminApiKeyUserPageMax {
		pageSize = adminApiKeyUserPageMax
	}
	return page, pageSize
}

// ListAdminEnabledApiKeys lists the users that hold enabled API keys, most keys
// first, with up to adminApiKeyPerUserMax enabled keys of each listed user.
func ListAdminEnabledApiKeys(filter AdminEnabledApiKeyFilter) (*AdminEnabledApiKeyPage, error) {
	page, pageSize := normalizeAdminApiKeyPage(filter.Page, filter.PageSize)

	result := &AdminEnabledApiKeyPage{
		Items:    []AdminEnabledApiKeyUser{},
		Page:     page,
		PageSize: pageSize,
	}
	if err := adminEnabledApiKeyOwnerQuery(filter).
		Select("COUNT(DISTINCT tokens.user_id)").
		Scan(&result.Total).Error; err != nil {
		return nil, err
	}
	if err := adminEnabledApiKeyTotalKeys(filter).Scan(&result.KeyTotal).Error; err != nil {
		return nil, err
	}
	if result.Total == 0 {
		return result, nil
	}

	type userKeyGroup struct {
		UserId   int
		KeyCount int
	}
	groups := make([]userKeyGroup, 0, pageSize)
	if err := adminEnabledApiKeyKeyCounts(filter).
		Order("key_count DESC, user_id ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&groups).Error; err != nil {
		return nil, err
	}
	if len(groups) == 0 {
		return result, nil
	}

	userIds := make([]int, 0, len(groups))
	for _, group := range groups {
		userIds = append(userIds, group.UserId)
	}
	users := make([]User, 0, len(groups))
	if err := DB.Where("id IN ?", userIds).Find(&users).Error; err != nil {
		return nil, err
	}
	usersById := make(map[int]*User, len(users))
	for i := range users {
		usersById[users[i].Id] = &users[i]
	}

	for _, group := range groups {
		user := usersById[group.UserId]
		if user == nil {
			continue
		}
		// One bounded query per listed user keeps the payload small without
		// loading every key of every user just to trim them in memory.
		tokens := make([]Token, 0, min(group.KeyCount, adminApiKeyPerUserMax))
		if err := DB.Where("user_id = ? AND status = ?", user.Id, common.TokenStatusEnabled).
			Order("id DESC").
			Limit(adminApiKeyPerUserMax).
			Find(&tokens).Error; err != nil {
			return nil, err
		}
		keys := make([]AdminEnabledApiKey, 0, len(tokens))
		for i := range tokens {
			token := &tokens[i]
			keys = append(keys, AdminEnabledApiKey{
				Id:                 token.Id,
				Name:               token.Name,
				MaskedKey:          token.GetMaskedKey(),
				Group:              token.Group,
				RemainQuota:        token.RemainQuota,
				UsedQuota:          token.UsedQuota,
				UnlimitedQuota:     token.UnlimitedQuota,
				ExpiredTime:        token.ExpiredTime,
				CreatedTime:        token.CreatedTime,
				AccessedTime:       token.AccessedTime,
				ModelLimitsEnabled: token.ModelLimitsEnabled,
				ModelLimits:        token.ModelLimits,
			})
		}
		result.Items = append(result.Items, AdminEnabledApiKeyUser{
			UserId:      user.Id,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			Email:       user.Email,
			UserGroup:   user.Group,
			UserStatus:  user.Status,
			KeyCount:    group.KeyCount,
			Keys:        keys,
		})
	}
	return result, nil
}
