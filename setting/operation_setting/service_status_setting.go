package operation_setting

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// ServiceStatusTarget is one probe target published on the channel
// availability page. Each target maps to a single upstream endpoint plus the
// model used to probe it.
type ServiceStatusTarget struct {
	Id            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	Category      string `json:"category"`
	Icon          string `json:"icon"`
	Group         string `json:"group"`
	Model         string `json:"model"`
	BaseUrl       string `json:"base_url"`
	ApiKey        string `json:"api_key"`
	ProbeEndpoint string `json:"probe_endpoint"`
	BillingMode   string `json:"billing_mode"`
	Enabled       bool   `json:"enabled"`
	Sort          int    `json:"sort"`
}

// ServiceStatusSetting drives the public channel availability page and the
// background probe worker.
type ServiceStatusSetting struct {
	Enabled              bool                  `json:"enabled"`
	Title                string                `json:"title"`
	Description          string                `json:"description"`
	DisplayHours         int                   `json:"display_hours"`
	ProbeIntervalMinutes int                   `json:"probe_interval_minutes"`
	SampleRetentionDays  int                   `json:"sample_retention_days"`
	RequireLogin         bool                  `json:"require_login"`
	ShowLatency          bool                  `json:"show_latency"`
	Targets              []ServiceStatusTarget `json:"targets"`
}

// Probe endpoint kinds. The value selects which upstream API shape the probe
// worker speaks.
const (
	ProbeEndpointOpenAI         = "openai"
	ProbeEndpointOpenAIResponse = "openai-response"
	ProbeEndpointAnthropic      = "anthropic"
)

// Billing modes shown on the card. Purely informational.
const (
	BillingModeToken    = "token"
	BillingModePerCall  = "per_call"
	BillingModePerImage = "per_image"
	BillingModePerSec   = "per_second"
)

const (
	DefaultServiceStatusDisplayHours         = 24
	DefaultServiceStatusProbeIntervalMinutes = 5
	DefaultServiceStatusSampleRetentionDays  = 30

	MinServiceStatusDisplayHours         = 1
	MaxServiceStatusDisplayHours         = 24 * 30
	MinServiceStatusProbeIntervalMinutes = 1
	MaxServiceStatusProbeIntervalMinutes = 24 * 60
	MinServiceStatusSampleRetentionDays  = 1
	MaxServiceStatusSampleRetentionDays  = 365
)

var serviceStatusSetting = ServiceStatusSetting{
	Enabled:              false,
	Title:                "Channel availability",
	Description:          "Live probe results for every channel published by this site.",
	DisplayHours:         DefaultServiceStatusDisplayHours,
	ProbeIntervalMinutes: DefaultServiceStatusProbeIntervalMinutes,
	SampleRetentionDays:  DefaultServiceStatusSampleRetentionDays,
	RequireLogin:         false,
	ShowLatency:          true,
	Targets:              []ServiceStatusTarget{},
}

func init() {
	config.GlobalConfig.Register("service_status_setting", &serviceStatusSetting)
}

func GetServiceStatusSetting() *ServiceStatusSetting {
	normalizeServiceStatusSetting(&serviceStatusSetting)
	return &serviceStatusSetting
}

func IsServiceStatusEnabled() bool {
	return GetServiceStatusSetting().Enabled
}

// normalizeServiceStatusSetting clamps numeric fields into their supported
// range and drops targets that cannot be probed, so a partially configured
// option never reaches the probe worker.
func normalizeServiceStatusSetting(setting *ServiceStatusSetting) {
	setting.DisplayHours = clampInt(
		setting.DisplayHours,
		MinServiceStatusDisplayHours,
		MaxServiceStatusDisplayHours,
		DefaultServiceStatusDisplayHours,
	)
	setting.ProbeIntervalMinutes = clampInt(
		setting.ProbeIntervalMinutes,
		MinServiceStatusProbeIntervalMinutes,
		MaxServiceStatusProbeIntervalMinutes,
		DefaultServiceStatusProbeIntervalMinutes,
	)
	setting.SampleRetentionDays = clampInt(
		setting.SampleRetentionDays,
		MinServiceStatusSampleRetentionDays,
		MaxServiceStatusSampleRetentionDays,
		DefaultServiceStatusSampleRetentionDays,
	)

	targets := make([]ServiceStatusTarget, 0, len(setting.Targets))
	for i := range setting.Targets {
		target := setting.Targets[i]
		target.BaseUrl = NormalizeServiceStatusBaseUrl(target.BaseUrl)
		target.Model = strings.TrimSpace(target.Model)
		target.Name = strings.TrimSpace(target.Name)
		// A target without an endpoint can never be probed, so drop it here.
		// A blank model is kept: the probe worker reports it as a configuration
		// error instead of silently hiding the channel from the operator.
		if target.BaseUrl == "" {
			continue
		}
		if !IsValidProbeEndpoint(target.ProbeEndpoint) {
			target.ProbeEndpoint = ProbeEndpointOpenAI
		}
		if !IsValidBillingMode(target.BillingMode) {
			target.BillingMode = BillingModeToken
		}
		targets = append(targets, target)
	}
	setting.Targets = targets
}

// serviceStatusApiPathSuffixes lists the API paths the probe appends itself.
// Operators routinely paste a full endpoint URL, so trimming these avoids
// requesting "/v1/v1/chat/completions" and failing with 404 on every probe.
var serviceStatusApiPathSuffixes = []string{
	"/v1/chat/completions",
	"/v1/responses",
	"/v1/messages",
	"/v1",
	"/v1beta",
}

// NormalizeServiceStatusBaseUrl trims whitespace, trailing slashes, and any API
// path suffix so only the origin (plus optional prefix) remains.
func NormalizeServiceStatusBaseUrl(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}
	value = strings.TrimRight(value, "/")
	for {
		trimmed := value
		for _, suffix := range serviceStatusApiPathSuffixes {
			if strings.HasSuffix(strings.ToLower(trimmed), suffix) {
				trimmed = trimmed[:len(trimmed)-len(suffix)]
				break
			}
		}
		trimmed = strings.TrimRight(trimmed, "/")
		if trimmed == value || trimmed == "" {
			break
		}
		value = trimmed
	}
	return value
}

func IsValidProbeEndpoint(value string) bool {
	switch value {
	case ProbeEndpointOpenAI, ProbeEndpointOpenAIResponse, ProbeEndpointAnthropic:
		return true
	default:
		return false
	}
}

func IsValidBillingMode(value string) bool {
	switch value {
	case BillingModeToken, BillingModePerCall, BillingModePerImage, BillingModePerSec:
		return true
	default:
		return false
	}
}

func clampInt(value, minValue, maxValue, fallback int) int {
	if value < minValue || value > maxValue {
		if value == 0 {
			return fallback
		}
		if value < minValue {
			return minValue
		}
		return maxValue
	}
	return value
}
