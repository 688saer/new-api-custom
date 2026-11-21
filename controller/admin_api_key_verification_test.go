package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// seedAdminApiKeyTarget creates a managed user with one API key, so the reveal
// endpoint has something real to disclose.
func seedAdminApiKeyTarget(t *testing.T) (*model.User, service.AuthIdentity, *model.User, *model.Token) {
	t.Helper()
	operator, identity, target := setupAdminUserTest(t)
	// The security-enrollment fixture migrates only the tables its own flows
	// touch, so the reveal endpoint's table is added here.
	require.NoError(t, model.DB.AutoMigrate(&model.Token{}))
	token := &model.Token{
		UserId:      target.Id,
		Key:         "adminrevealkey000000000001",
		Name:        "target-key",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 1000,
		ExpiredTime: -1,
		Group:       "default",
	}
	require.NoError(t, model.DB.Create(token).Error)
	return operator, identity, target, token
}

func revealApiKeyRequest(t *testing.T, identity service.AuthIdentity, role int, tokenId int, proof string) *httptest.ResponseRecorder {
	t.Helper()
	return adminUserRequest(
		http.MethodPost,
		fmt.Sprintf("/api/subscription/admin/api-keys/%d/reveal", tokenId),
		"",
		proof,
		identity,
		role,
		gin.Params{{Key: "id", Value: fmt.Sprint(tokenId)}},
		AdminGetUserApiKey,
	)
}

func TestAdminApiKeyRevealRequiresProofForThatKey(t *testing.T) {
	_, identity, target, token := seedAdminApiKeyTarget(t)
	otherToken := &model.Token{
		UserId:      target.Id,
		Key:         "adminrevealkey000000000002",
		Name:        "other-key",
		Status:      common.TokenStatusEnabled,
		RemainQuota: 1000,
		ExpiredTime: -1,
		Group:       "default",
	}
	require.NoError(t, model.DB.Create(otherToken).Error)

	// No proof at all: the handler must refuse and disclose nothing.
	withoutProof := revealApiKeyRequest(t, identity, common.RoleRootUser, token.Id, "")
	assert.Equal(t, http.StatusForbidden, withoutProof.Code)
	assert.NotContains(t, withoutProof.Body.String(), token.Key)

	// A proof issued for a different key must not unlock this one.
	wrongBinding := issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{
		Scope:   service.VerificationScopeAdminUserApiKeyRead,
		Context: []byte(fmt.Sprintf(`{"user_id":%d,"key_id":%d}`, target.Id, otherToken.Id)),
	}, service.VerificationMethodPassword)
	forged := revealApiKeyRequest(t, identity, common.RoleRootUser, token.Id, wrongBinding)
	assert.Equal(t, http.StatusForbidden, forged.Code)
	assert.NotContains(t, forged.Body.String(), token.Key)
}

func TestAdminApiKeyRevealReturnsTheKeyForItsOwnProof(t *testing.T) {
	operator, identity, target, token := seedAdminApiKeyTarget(t)

	proof := issueSecurityEnrollmentProof(t, identity, service.VerificationOperation{
		Scope:   service.VerificationScopeAdminUserApiKeyRead,
		Context: []byte(fmt.Sprintf(`{"user_id":%d,"key_id":%d}`, target.Id, token.Id)),
	}, service.VerificationMethodPassword)
	response := revealApiKeyRequest(t, identity, common.RoleRootUser, token.Id, proof)

	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	assert.Contains(t, response.Body.String(), token.Key)

	// The disclosure is recorded against the operator, naming the key and owner.
	var audit model.AuditLog
	require.NoError(t, model.LOG_DB.Where("user_id = ? AND action = ?", operator.Id, "token.admin_key_view").First(&audit).Error)
	assert.Contains(t, audit.Content, "target-key")
}

func TestAdminApiKeyRevealRejectsMissingKey(t *testing.T) {
	_, identity, _, _ := seedAdminApiKeyTarget(t)

	// Resolving the key happens before the proof check, so an unknown ID is
	// answered as a business failure rather than as an unverified operation.
	response := revealApiKeyRequest(t, identity, common.RoleRootUser, 999999, "")

	assert.Equal(t, http.StatusOK, response.Code)
	assert.Contains(t, response.Body.String(), `"success":false`)
	assert.Contains(t, response.Body.String(), "API key does not exist")
	assert.NotContains(t, response.Body.String(), `"key"`)
}
