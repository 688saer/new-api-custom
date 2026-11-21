package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// seedAdminApiKeyFixture lays out two users with keys: alice holds two enabled
// keys and one disabled key, bob holds one enabled key, and carol holds only a
// disabled key.
func seedAdminApiKeyFixture(t *testing.T) {
	t.Helper()
	truncateTables(t)

	require.NoError(t, DB.Create(&User{Id: 801, Username: "alice", DisplayName: "Alice", Email: "alice@example.com", Group: "vip", AffCode: "alice801"}).Error)
	require.NoError(t, DB.Create(&User{Id: 802, Username: "bob", DisplayName: "Bob", Email: "bob@example.com", Group: "default", AffCode: "bob802"}).Error)
	require.NoError(t, DB.Create(&User{Id: 803, Username: "carol", DisplayName: "Carol", Email: "carol@example.com", Group: "default", AffCode: "carol803"}).Error)

	tokens := []Token{
		{Id: 8101, UserId: 801, Key: "sk-aaaaaaaaaaaaaaaaaaaa", Name: "alice-fast", Status: common.TokenStatusEnabled, RemainQuota: 1000, UsedQuota: 500, Group: "vip", ExpiredTime: -1},
		{Id: 8102, UserId: 801, Key: "sk-bbbbbbbbbbbbbbbbbbbb", Name: "alice-slow", Status: common.TokenStatusEnabled, RemainQuota: 200, UsedQuota: 20, UnlimitedQuota: true, ExpiredTime: -1},
		{Id: 8103, UserId: 801, Key: "sk-cccccccccccccccccccc", Name: "alice-old", Status: common.TokenStatusDisabled, RemainQuota: 0, ExpiredTime: -1},
		{Id: 8104, UserId: 802, Key: "sk-dddddddddddddddddddd", Name: "bob-main", Status: common.TokenStatusEnabled, RemainQuota: 5000, Group: "default", ExpiredTime: -1},
		{Id: 8105, UserId: 803, Key: "sk-eeeeeeeeeeeeeeeeeeee", Name: "carol-off", Status: common.TokenStatusDisabled, ExpiredTime: -1},
	}
	for i := range tokens {
		require.NoError(t, DB.Create(&tokens[i]).Error)
	}
}

func TestListAdminEnabledApiKeysGroupsByUserAndSkipsDisabledKeys(t *testing.T) {
	seedAdminApiKeyFixture(t)

	page, err := ListAdminEnabledApiKeys(AdminEnabledApiKeyFilter{})
	require.NoError(t, err)
	require.NotNil(t, page)

	// Only the two users that hold an enabled key are listed as users.
	assert.Equal(t, int64(2), page.Total)
	// Three enabled keys in total; the disabled ones are not counted.
	assert.Equal(t, int64(3), page.KeyTotal)
	require.Len(t, page.Items, 2)

	// Busiest first: alice has two enabled keys, bob one.
	assert.Equal(t, 801, page.Items[0].UserId)
	assert.Equal(t, "alice", page.Items[0].Username)
	assert.Equal(t, "vip", page.Items[0].UserGroup)
	assert.Equal(t, 2, page.Items[0].KeyCount)
	require.Len(t, page.Items[0].Keys, 2)
	assert.Equal(t, "alice-slow", page.Items[0].Keys[0].Name)
	assert.Equal(t, "alice-fast", page.Items[0].Keys[1].Name)
	assert.Equal(t, "vip", page.Items[0].Keys[1].Group)
	assert.Equal(t, 1000, page.Items[0].Keys[1].RemainQuota)
	assert.Equal(t, 500, page.Items[0].Keys[1].UsedQuota)
	assert.True(t, page.Items[0].Keys[0].UnlimitedQuota)

	assert.Equal(t, 802, page.Items[1].UserId)
	assert.Equal(t, 1, page.Items[1].KeyCount)
	assert.Equal(t, "bob-main", page.Items[1].Keys[0].Name)
}

func TestListAdminEnabledApiKeysMasksEveryKey(t *testing.T) {
	seedAdminApiKeyFixture(t)

	page, err := ListAdminEnabledApiKeys(AdminEnabledApiKeyFilter{})
	require.NoError(t, err)
	require.NotEmpty(t, page.Items)

	rawKeys := map[int]string{
		8101: "sk-aaaaaaaaaaaaaaaaaaaa",
		8102: "sk-bbbbbbbbbbbbbbbbbbbb",
		8104: "sk-dddddddddddddddddddd",
	}
	for _, user := range page.Items {
		for _, key := range user.Keys {
			// The board never carries a usable secret, only the mask the API
			// key console shows.
			assert.Equal(t, MaskTokenKey(rawKeys[key.Id]), key.MaskedKey)
			assert.Contains(t, key.MaskedKey, "*")
		}
	}
}

func TestListAdminEnabledApiKeysFiltersByOwnerAndKeyName(t *testing.T) {
	seedAdminApiKeyFixture(t)

	byUsername, err := ListAdminEnabledApiKeys(AdminEnabledApiKeyFilter{Keyword: "bob"})
	require.NoError(t, err)
	require.Len(t, byUsername.Items, 1)
	assert.Equal(t, 802, byUsername.Items[0].UserId)
	assert.Equal(t, int64(1), byUsername.KeyTotal)

	byDisplayName, err := ListAdminEnabledApiKeys(AdminEnabledApiKeyFilter{Keyword: "Carol"})
	require.NoError(t, err)
	// Carol holds only a disabled key, so the board has nothing for her.
	assert.Empty(t, byDisplayName.Items)
	assert.Equal(t, int64(0), byDisplayName.Total)

	byKeyName, err := ListAdminEnabledApiKeys(AdminEnabledApiKeyFilter{Keyword: "alice-fast"})
	require.NoError(t, err)
	require.Len(t, byKeyName.Items, 1)
	// The filter picks the user, then lists every enabled key of that user.
	assert.Equal(t, 2, byKeyName.Items[0].KeyCount)
	assert.Equal(t, int64(2), byKeyName.KeyTotal)

	byUserId, err := ListAdminEnabledApiKeys(AdminEnabledApiKeyFilter{Keyword: "801"})
	require.NoError(t, err)
	require.Len(t, byUserId.Items, 1)
	assert.Equal(t, 801, byUserId.Items[0].UserId)
}

func TestListAdminEnabledApiKeysPagesUsersWithoutLosingTheKeys(t *testing.T) {
	seedAdminApiKeyFixture(t)

	first, err := ListAdminEnabledApiKeys(AdminEnabledApiKeyFilter{Page: 1, PageSize: 1})
	require.NoError(t, err)
	require.Len(t, first.Items, 1)
	assert.Equal(t, 801, first.Items[0].UserId)
	assert.Equal(t, int64(2), first.Total)
	assert.Equal(t, int64(3), first.KeyTotal)

	second, err := ListAdminEnabledApiKeys(AdminEnabledApiKeyFilter{Page: 2, PageSize: 1})
	require.NoError(t, err)
	require.Len(t, second.Items, 1)
	assert.Equal(t, 802, second.Items[0].UserId)
	assert.Equal(t, int64(3), second.KeyTotal)

	// An oversized page is capped instead of returning every user at once.
	capped, err := ListAdminEnabledApiKeys(AdminEnabledApiKeyFilter{PageSize: 5000})
	require.NoError(t, err)
	assert.Equal(t, adminApiKeyUserPageMax, capped.PageSize)
}

func TestListAdminEnabledApiKeysLeavesOutKeysOfDeletedUsers(t *testing.T) {
	seedAdminApiKeyFixture(t)
	require.NoError(t, DB.Delete(&User{}, 802).Error)

	page, err := ListAdminEnabledApiKeys(AdminEnabledApiKeyFilter{})
	require.NoError(t, err)
	require.Len(t, page.Items, 1)
	assert.Equal(t, 801, page.Items[0].UserId)
	assert.Equal(t, int64(1), page.Total)
	assert.Equal(t, int64(2), page.KeyTotal)
}
