package model

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// subscriptionAdminPageMax caps one page of the operator-wide list, so a console
// cannot ask the database for the whole table in one shot.
const subscriptionAdminPageMax = 200

// SubscriptionAdminFilter narrows the operator-wide list of user cards.
type SubscriptionAdminFilter struct {
	// Keyword matches the username, display name, email, or an exact user id.
	Keyword string
	// Status is "active", "expired", or "cancelled"; empty means every status.
	Status string
	// PlanId limits the list to one plan; 0 means every plan.
	PlanId int
	// ExpiringDays limits the list to active cards ending within that many days.
	ExpiringDays int
	Page         int
	PageSize     int
}

// SubscriptionAdminRow is one user card with the user and plan it belongs to,
// shaped for a table an operator reads at a glance.
type SubscriptionAdminRow struct {
	Id              int     `json:"id"`
	UserId          int     `json:"user_id"`
	Username        string  `json:"username"`
	DisplayName     string  `json:"display_name"`
	Email           string  `json:"email"`
	UserGroup       string  `json:"user_group"`
	PlanId          int     `json:"plan_id"`
	PlanTitle       string  `json:"plan_title"`
	Status          string  `json:"status"`
	Source          string  `json:"source"`
	StartTime       int64   `json:"start_time"`
	EndTime         int64   `json:"end_time"`
	NextResetTime   int64   `json:"next_reset_time"`
	AmountTotal     int64   `json:"amount_total"`
	AmountUsed      int64   `json:"amount_used"`
	TokenLimitTotal int64   `json:"token_limit_total"`
	TokenUsed       int64   `json:"token_used"`
	UpgradeGroup    string  `json:"upgrade_group"`
	CreatedAt       int64   `json:"created_at"`
	PriceAmount     float64 `json:"price_amount"`
}

// SubscriptionAdminSummary counts what the current filter covers, so the panel
// can say how many cards are live and how much quota they still hold.
type SubscriptionAdminSummary struct {
	Total        int64 `json:"total"`
	Active       int64 `json:"active"`
	ExpiringSoon int64 `json:"expiring_soon"`
	Expired      int64 `json:"expired"`
	AmountTotal  int64 `json:"amount_total"`
	AmountUsed   int64 `json:"amount_used"`
}

// SubscriptionAdminPage is one page of the operator-wide list.
type SubscriptionAdminPage struct {
	Items    []SubscriptionAdminRow   `json:"items"`
	Total    int64                    `json:"total"`
	Page     int                      `json:"page"`
	PageSize int                      `json:"page_size"`
	Summary  SubscriptionAdminSummary `json:"summary"`
}

// SubscriptionAdminExpiringDays is the window the summary counts as "ending
// soon"; the filter uses the caller's own window.
const SubscriptionAdminExpiringDays = 7

func normalizeSubscriptionAdminPage(page int, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > subscriptionAdminPageMax {
		pageSize = subscriptionAdminPageMax
	}
	return page, pageSize
}

// adminSubscriptionQuery applies the filter to a join of cards, users, and plans.
func adminSubscriptionQuery(filter SubscriptionAdminFilter, now int64) *gorm.DB {
	query := DB.Table("user_subscriptions AS s").
		Joins("LEFT JOIN users AS u ON u.id = s.user_id").
		Joins("LEFT JOIN subscription_plans AS p ON p.id = s.plan_id")

	if keyword := strings.TrimSpace(filter.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		pattern := "u.username LIKE ? OR u.display_name LIKE ? OR u.email LIKE ?"
		args := []any{like, like, like}
		if userId, err := strconv.Atoi(keyword); err == nil {
			pattern += " OR s.user_id = ?"
			args = append(args, userId)
		}
		query = query.Where(pattern, args...)
	}
	if status := strings.TrimSpace(filter.Status); status != "" && status != "all" {
		query = query.Where("s.status = ?", status)
	}
	if filter.PlanId > 0 {
		query = query.Where("s.plan_id = ?", filter.PlanId)
	}
	if filter.ExpiringDays > 0 {
		// An already expired card is not "ending soon", so the window only looks
		// forward from now.
		query = query.Where(
			"s.status = ? AND s.end_time > ? AND s.end_time <= ?",
			"active", now, now+int64(filter.ExpiringDays)*86400,
		)
	}
	return query
}

// ListAdminUserSubscriptions lists every user's cards for the operator console,
// newest expiry first, together with a summary of the whole filtered set.
func ListAdminUserSubscriptions(filter SubscriptionAdminFilter) (*SubscriptionAdminPage, error) {
	page, pageSize := normalizeSubscriptionAdminPage(filter.Page, filter.PageSize)
	now := common.GetTimestamp()
	soon := now + SubscriptionAdminExpiringDays*86400

	summary := SubscriptionAdminSummary{}
	summaryQuery := adminSubscriptionQuery(filter, now).Select(`
		COUNT(*) AS total,
		COALESCE(SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END), 0) AS active,
		COALESCE(SUM(CASE WHEN s.status = 'active' AND s.end_time > ? AND s.end_time <= ? THEN 1 ELSE 0 END), 0) AS expiring_soon,
		COALESCE(SUM(CASE WHEN s.status <> 'active' THEN 1 ELSE 0 END), 0) AS expired,
		COALESCE(SUM(s.amount_total), 0) AS amount_total,
		COALESCE(SUM(s.amount_used), 0) AS amount_used
	`, now, soon)
	if err := summaryQuery.Scan(&summary).Error; err != nil {
		return nil, err
	}

	rows := make([]SubscriptionAdminRow, 0, pageSize)
	userGroupColumn := "u." + commonGroupCol
	listQuery := adminSubscriptionQuery(filter, now).Select(
		"s.id, s.user_id, u.username AS username, u.display_name AS display_name, " +
			"u.email AS email, " + userGroupColumn + " AS user_group, " +
			"s.plan_id, p.title AS plan_title, p.price_amount AS price_amount, " +
			"s.status, s.source, s.start_time, s.end_time, s.next_reset_time, " +
			"s.amount_total, s.amount_used, s.token_limit_total, s.token_used, " +
			"s.upgrade_group, s.created_at",
	).Order("s.end_time DESC, s.id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize)
	if err := listQuery.Scan(&rows).Error; err != nil {
		return nil, err
	}

	return &SubscriptionAdminPage{
		Items:    rows,
		Total:    summary.Total,
		Page:     page,
		PageSize: pageSize,
		Summary:  summary,
	}, nil
}
