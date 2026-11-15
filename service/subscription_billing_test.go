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

// A plan whitelist decides which calls the subscription pays for, not which
// models the user may call: a model outside the whitelist is billed to the
// wallet, otherwise activating a subscription would lock every other group's
// models. The wallet overflow switch keeps its own meaning (whether the wallet
// may pay once the allowance is used up), and an exhausted token allowance
// stays a hard policy rejection.
func TestSubscriptionModelScopeBillsOtherModelsToWallet(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.SubscriptionPlan{}, &model.SubscriptionPreConsumeRecord{}))
	gin.SetMode(gin.TestMode)

	bindSubscription := func(t *testing.T, username string, plan model.SubscriptionPlan, usedTokens int64, allowWalletOverflow bool) *model.User {
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
			AllowWalletOverflow: allowWalletOverflow,
			TokenLimitTotal:     plan.TokenLimit,
			TokenUsed:           usedTokens,
			AllowedModels:       plan.AllowedModels,
		}).Error)
		return user
	}

	preConsumeWith := func(t *testing.T, user *model.User, requestId string, modelName string) (*types.NewAPIError, string, int) {
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
		session, apiErr := NewBillingSession(c, relayInfo, 1000)
		if session != nil {
			require.Equal(t, session.funding.Source(), relayInfo.BillingSource)
		}
		walletQuota, err := model.GetUserQuota(user.Id, false)
		require.NoError(t, err)
		return apiErr, relayInfo.BillingSource, walletQuota
	}

	whitelistedPlan := func(totalAmount int64) model.SubscriptionPlan {
		return model.SubscriptionPlan{
			PriceAmount:   2,
			Currency:      "USD",
			DurationUnit:  "day",
			DurationValue: 1,
			TotalAmount:   totalAmount,
			AllowedModels: []string{"gpt-4o-mini"},
		}
	}

	t.Run("model outside the whitelist is billed to the wallet", func(t *testing.T) {
		user := bindSubscription(t, "scope-open-user", whitelistedPlan(100000), 0, true)

		apiErr, source, _ := preConsumeWith(t, user, "req-scope-open", "gpt-4o")

		require.Nil(t, apiErr)
		assert.Equal(t, BillingSourceWallet, source)
	})

	t.Run("model outside the whitelist is still billed to the wallet when wallet overflow is off", func(t *testing.T) {
		user := bindSubscription(t, "scope-strict-user", whitelistedPlan(100000), 0, false)

		apiErr, source, _ := preConsumeWith(t, user, "req-scope-strict", "gpt-4o")

		require.Nil(t, apiErr)
		assert.Equal(t, BillingSourceWallet, source)
	})

	t.Run("exhausted allowance falls back to the wallet when overflow is allowed", func(t *testing.T) {
		user := bindSubscription(t, "scope-overflow-user", whitelistedPlan(500), 0, true)

		apiErr, source, _ := preConsumeWith(t, user, "req-scope-overflow", "gpt-4o-mini")

		require.Nil(t, apiErr)
		assert.Equal(t, BillingSourceWallet, source)
	})

	t.Run("exhausted allowance stops without wallet overflow", func(t *testing.T) {
		user := bindSubscription(t, "scope-capped-user", whitelistedPlan(500), 0, false)

		apiErr, _, walletQuota := preConsumeWith(t, user, "req-scope-capped", "gpt-4o-mini")

		require.NotNil(t, apiErr)
		assert.Equal(t, http.StatusForbidden, apiErr.StatusCode)
		assert.Equal(t, user.Quota, walletQuota, "wallet balance must not pay past a hard stop")
	})

	t.Run("token allowance used up", func(t *testing.T) {
		plan := whitelistedPlan(100000)
		plan.TokenLimit = 100
		user := bindSubscription(t, "scope-token-user", plan, 100, true)

		apiErr, _, walletQuota := preConsumeWith(t, user, "req-scope-token", "gpt-4o-mini")

		require.NotNil(t, apiErr)
		assert.Equal(t, http.StatusForbidden, apiErr.StatusCode)
		assert.Equal(t, user.Quota, walletQuota, "wallet balance must not pay for an exhausted plan allowance")
	})
}
