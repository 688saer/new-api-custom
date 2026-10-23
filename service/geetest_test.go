package service

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The sign token is the one part of the V4 protocol the browser cannot check
// for us: if the digest or its key order drifts, every challenge is rejected.
func TestSignGeeTestLotNumber_MatchesV4Specification(t *testing.T) {
	// Reference digest computed independently for HMAC-SHA256("lot-42", "abc123").
	assert.Equal(
		t,
		"15d7004ef57e12f53963d07751cffab3c70dad6633db1c3dbdddef6b276b5abb",
		signGeeTestLotNumber("lot-42", "abc123"),
	)
}

func TestVerifyGeeTest_RejectsBeforeCallingGeeTestWhenUnconfigured(t *testing.T) {
	setting := system_setting.GetGeeTestSetting()
	original := *setting
	t.Cleanup(func() { *setting = original })
	setting.CaptchaId = ""
	setting.CaptchaKey = ""

	err := VerifyGeeTest(GeeTestPayload{
		LotNumber:     "lot-42",
		CaptchaOutput: "output",
		PassToken:     "token",
		GenTime:       "1700000000",
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "not configured")
}

func TestVerifyGeeTest_RejectsIncompletePayloadBeforeCallingGeeTest(t *testing.T) {
	setting := system_setting.GetGeeTestSetting()
	original := *setting
	t.Cleanup(func() { *setting = original })
	setting.CaptchaId = "captcha-id"
	setting.CaptchaKey = "captcha-key"

	err := VerifyGeeTest(GeeTestPayload{LotNumber: "lot-42"})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "incomplete")
}

// A half-finished configuration must never lock visitors out of the site: the
// master switch alone is not enough without credentials.
func TestGeeTestSetting_ShouldVerify(t *testing.T) {
	setting := system_setting.GetGeeTestSetting()
	original := *setting
	t.Cleanup(func() { *setting = original })

	*setting = system_setting.GeeTestSetting{
		Enabled:         true,
		CaptchaId:       "captcha-id",
		CaptchaKey:      "captcha-key",
		OnRegister:      true,
		OnLogin:         true,
		OnCheckin:       false,
		OnPasswordReset: true,
		OnEmailVerify:   false,
	}

	assert.True(t, setting.ShouldVerify(system_setting.GeeTestActionRegister))
	assert.True(t, setting.ShouldVerify(system_setting.GeeTestActionLogin))
	assert.True(t, setting.ShouldVerify(system_setting.GeeTestActionPasswordReset))
	assert.False(t, setting.ShouldVerify(system_setting.GeeTestActionCheckin))
	assert.False(t, setting.ShouldVerify(system_setting.GeeTestActionEmailVerify))
	assert.False(t, setting.ShouldVerify("unknown-action"))

	setting.CaptchaKey = ""
	assert.False(t, setting.ShouldVerify(system_setting.GeeTestActionRegister))

	setting.CaptchaKey = "captcha-key"
	setting.Enabled = false
	assert.False(t, setting.ShouldVerify(system_setting.GeeTestActionRegister))
}
