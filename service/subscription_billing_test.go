package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/gin-gonic/gin"
)

// A subscription plan rejection describes the plan policy the user has to
// change. Charging the wallet instead would silently serve a request the plan
// forbids, so NewBillingSession must surface the rejection even when the plan
// allows wallet overflow.
func TestSubscriptionPlanRejectionNeverFallsBackToWallet(t *testing.T) {
	require.NoError(t, model.DB.AutoMigrate(&model.SubscriptionPlan{}, &model.SubscriptionPreConsumeRecord{}))
	gin.SetMode(gin.TestMode)

	allowWalletOverflow := true

	bindSubscription := func(t *testing.T, username string, plan model.SubscriptionPlan, usedTokens int64) *model.User {
		t.Helper()
		plan.Title = username
		plan.Enabled = true
		plan.AllowWalletOverflow = &allowWalletOverflow
		require.NoError(t, model.DB.Create(&plan).Error)
		user := &model.User{
			Username: username,
			Password: "hashed",
			AffCode:  username,
			Quota:    50_000_000,
			Status:   common.UserStatusEnabled,
		}
		require.NoError(t, model.DB.Create(user).Error)
		now := common.GetTimestamp()
		// The subscription row is written directly so the fixture does not depend
		// on the admin binding transaction; only the pre-consume path is under test.
		require.NoError(t, model.DB.Create(&model.UserSubscription{
			UserId:              user.Id,
			PlanId:              plan.Id,
			AmountTotal:         plan.TotalAmount,
			AmountUsed:          0,
			StartTime:           now,
			EndTime:             now + 86400,
			Status:              "active",
			Source:              "admin",
			LastResetTime:       now,
			NextResetTime:       now + 86400,
			AllowWalletOverflow: true,
			TokenLimitTotal:     plan.TokenLimit,
			TokenUsed:           usedTokens,
			AllowedModels:       plan.AllowedModels,
		}).Error)
		return user
	}

	preConsumeWith := func(t *testing.T, user *model.User, requestId string, modelName string) (*types.NewAPIError, int) {
		t.Helper()
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
		relayInfo := &relaycommon.RelayInfo{
			RequestId:       requestId,
			UserId:          user.Id,
			OriginModelName: modelName,
			IsPlayground:    true,
			TokenUnlimited:  true,
			UserQuota:       user.Quota,
			UserSetting:     dto.UserSetting{BillingPreference: "subscription_first"},
		}
		_, apiErr := NewBillingSession(c, relayInfo, 1000)
		walletQuota, err := model.GetUserQuota(user.Id, false)
		require.NoError(t, err)
		return apiErr, walletQuota
	}

	t.Run("model outside the whitelist", func(t *testing.T) {
		user := bindSubscription(t, "policy-model-user", model.SubscriptionPlan{
			PriceAmount:   2,
			Currency:      "USD",
			DurationUnit:  "day",
			DurationValue: 1,
			TotalAmount:   100000,
			AllowedModels: []string{"gpt-4o-mini"},
		}, 0)

		apiErr, walletQuota := preConsumeWith(t, user, "req-policy-model", "gpt-4o")

		require.NotNil(t, apiErr)
		assert.Equal(t, http.StatusForbidden, apiErr.StatusCode)
		assert.Contains(t, apiErr.Error(), "gpt-4o-mini")
		assert.Equal(t, user.Quota, walletQuota, "wallet balance must not pay for a plan rejection")
	})

	t.Run("token allowance used up", func(t *testing.T) {
		user := bindSubscription(t, "policy-token-user", model.SubscriptionPlan{
			PriceAmount:   2,
			Currency:      "USD",
			DurationUnit:  "day",
			DurationValue: 1,
			TotalAmount:   100000,
			TokenLimit:    100,
			AllowedModels: []string{"gpt-4o-mini"},
		}, 100)

		apiErr, walletQuota := preConsumeWith(t, user, "req-policy-token", "gpt-4o-mini")

		require.NotNil(t, apiErr)
		assert.Equal(t, http.StatusForbidden, apiErr.StatusCode)
		assert.Equal(t, user.Quota, walletQuota, "wallet balance must not pay for an exhausted plan allowance")
	})
}
