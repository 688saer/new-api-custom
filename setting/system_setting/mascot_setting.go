package system_setting

import "github.com/QuantumNous/new-api/setting/config"

// MascotPlacement is where the mascot sits on the page.
type MascotPlacement string

const (
	MascotPlacementBottomRight MascotPlacement = "bottom-right"
	MascotPlacementBottomLeft  MascotPlacement = "bottom-left"
)

// MascotSetting configures the site mascot shown to signed-in users.
//
// The mascot is decorative, so every field is public: nothing here is a
// secret and the whole struct is safe to expose through the status endpoint.
type MascotSetting struct {
	// Enabled is the master switch for showing the mascot at all.
	Enabled bool `json:"enabled"`

	// Name is shown in the greeting bubble and the panel heading.
	Name string `json:"name"`

	// Greeting is the bubble text shown on first visit. Empty uses the
	// translated default so the panel stays useful without configuration.
	Greeting string `json:"greeting"`

	// Placement picks the corner the mascot occupies.
	Placement MascotPlacement `json:"placement"`

	// ShowOnAuthPages controls whether the mascot appears on sign-in and
	// sign-up, where it would otherwise compete with the form.
	ShowOnAuthPages bool `json:"show_on_auth_pages"`

	// Size is the rendered width in pixels, clamped to a usable range so an
	// operator cannot push the mascot over the page content.
	Size int `json:"size"`
}

const (
	MascotMinSize = 96
	MascotMaxSize = 220
)

var mascotSetting = MascotSetting{
	Enabled:         true,
	Name:            "泡泡",
	Greeting:        "",
	Placement:       MascotPlacementBottomRight,
	ShowOnAuthPages: false,
	Size:            148,
}

func init() {
	config.GlobalConfig.Register("mascot_setting", &mascotSetting)
}

// GetMascotSetting returns the live mascot configuration.
func GetMascotSetting() *MascotSetting {
	return &mascotSetting
}

// NormalizeSize clamps the configured width into the supported range and
// falls back to the default for a missing or nonsensical value.
func (setting *MascotSetting) NormalizeSize() int {
	if setting.Size < MascotMinSize || setting.Size > MascotMaxSize {
		return 148
	}
	return setting.Size
}

// NormalizePlacement maps anything unrecognized onto the default corner, so a
// malformed value degrades to a working placement instead of an unstyled box.
func (setting *MascotSetting) NormalizePlacement() MascotPlacement {
	if setting.Placement == MascotPlacementBottomLeft {
		return MascotPlacementBottomLeft
	}
	return MascotPlacementBottomRight
}
