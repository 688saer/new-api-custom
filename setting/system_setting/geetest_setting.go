package system_setting

import "github.com/QuantumNous/new-api/setting/config"

// Actions that a GeeTest challenge can guard. Each one is switched on
// separately, so an operator can protect sign-up without touching sign-in.
const (
	GeeTestActionRegister      = "register"
	GeeTestActionLogin         = "login"
	GeeTestActionCheckin       = "checkin"
	GeeTestActionPasswordReset = "password_reset"
	GeeTestActionEmailVerify   = "email_verify"
)

// GeeTestSetting holds the GeeTest V4 configuration.
//
// CaptchaKey is the server-side secret and must never reach the browser: only
// CaptchaId is public, and the status endpoint exposes that alone.
type GeeTestSetting struct {
	// Enabled is the master switch; the per-action flags below only apply
	// while it is on.
	Enabled bool `json:"enabled"`

	// CaptchaId is the public identifier issued by GeeTest.
	CaptchaId string `json:"captcha_id"`

	// CaptchaKey signs the lot number when validating server-side.
	CaptchaKey string `json:"captcha_key"`

	OnRegister      bool `json:"on_register"`
	OnLogin         bool `json:"on_login"`
	OnCheckin       bool `json:"on_checkin"`
	OnPasswordReset bool `json:"on_password_reset"`
	OnEmailVerify   bool `json:"on_email_verify"`
}

var geetestSetting = GeeTestSetting{
	Enabled:         false,
	CaptchaId:       "",
	CaptchaKey:      "",
	OnRegister:      true,
	OnLogin:         true,
	OnCheckin:       true,
	OnPasswordReset: true,
	OnEmailVerify:   true,
}

func init() {
	config.GlobalConfig.Register("geetest_setting", &geetestSetting)
}

// GetGeeTestSetting returns the live GeeTest configuration.
func GetGeeTestSetting() *GeeTestSetting {
	return &geetestSetting
}

// IsConfigured reports whether both credentials are present, which is the
// minimum needed to run a challenge at all.
func (setting *GeeTestSetting) IsConfigured() bool {
	return setting.CaptchaId != "" && setting.CaptchaKey != ""
}

// IsActionEnabled reports whether one action should be challenged, ignoring
// the master switch and the credentials.
func (setting *GeeTestSetting) IsActionEnabled(action string) bool {
	switch action {
	case GeeTestActionRegister:
		return setting.OnRegister
	case GeeTestActionLogin:
		return setting.OnLogin
	case GeeTestActionCheckin:
		return setting.OnCheckin
	case GeeTestActionPasswordReset:
		return setting.OnPasswordReset
	case GeeTestActionEmailVerify:
		return setting.OnEmailVerify
	default:
		return false
	}
}

// ShouldVerify reports whether a request for this action must carry a solved
// challenge. An enabled switch without credentials is treated as off, so a
// half-finished configuration can never lock users out of the site.
func (setting *GeeTestSetting) ShouldVerify(action string) bool {
	return setting.Enabled && setting.IsConfigured() && setting.IsActionEnabled(action)
}
