package service

import (
	"cmp"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"
)

// Upstream health answers one question for the console: is relaying currently
// failing for a capability the user is about to spend quota on? The numbers come
// from real relayed traffic rather than a synthetic probe, because a probe would
// cost quota and could disagree with what users hit a second later.
type UpstreamCapability string

const (
	UpstreamCapabilityImage UpstreamCapability = "image"
	UpstreamCapabilityChat  UpstreamCapability = "chat"
)

const (
	// upstreamHealthWindow keeps the warning tied to the recent past: an outage
	// from an hour ago must not keep telling users the site is broken.
	upstreamHealthWindow = 5 * time.Minute
	// Thresholds are deliberately conservative, so one flaky request cannot
	// announce an outage, and one recovered minute clears the warning again.
	upstreamDownConsecutiveFailures = 3
	upstreamDownMinAttempts         = 3
	upstreamDownFailureRatio        = 0.5
	upstreamDegradedMinAttempts     = 3
	upstreamDegradedFailureRatio    = 0.2
)

// Upstream health states, also used verbatim in the console banner.
const (
	UpstreamStateOk       = "ok"
	UpstreamStateDegraded = "degraded"
	UpstreamStateDown     = "down"
)

type upstreamOutcome struct {
	at time.Time
	ok bool
}

// UpstreamCapabilityHealth is what the console renders for one capability.
type UpstreamCapabilityHealth struct {
	Capability          string `json:"capability"`
	State               string `json:"state"`
	Attempts            int    `json:"attempts"`
	Failures            int    `json:"failures"`
	ConsecutiveFailures int    `json:"consecutive_failures"`
}

// UpstreamHealthSnapshot is the whole picture behind the banner.
type UpstreamHealthSnapshot struct {
	State         string                     `json:"state"`
	WindowSeconds int                        `json:"window_seconds"`
	Capabilities  []UpstreamCapabilityHealth `json:"capabilities"`
}

var (
	upstreamHealthMutex sync.Mutex
	upstreamOutcomes    = map[UpstreamCapability][]upstreamOutcome{}
)

// UpstreamCapabilityForPath maps a relay path to the capability a caller waited
// on. Surfaces with no banner (embeddings, audio, tasks, realtime) return an
// empty capability, and their outcomes are not tracked.
func UpstreamCapabilityForPath(path string) UpstreamCapability {
	switch {
	case strings.Contains(path, "/images/"):
		return UpstreamCapabilityImage
	case strings.HasSuffix(path, "/chat/completions"),
		strings.HasSuffix(path, "/completions"),
		strings.HasSuffix(path, "/messages"),
		strings.HasSuffix(path, "/responses"):
		return UpstreamCapabilityChat
	}
	return ""
}

// RecordUpstreamOutcome notes whether one relayed request reached its upstream.
func RecordUpstreamOutcome(capability UpstreamCapability, ok bool) {
	recordUpstreamOutcomeAt(capability, ok, time.Now())
}

// upstreamNeutralErrorCodes are failures that say nothing about the provider:
// the request never got a meaningful answer for a reason on our own side.
var upstreamNeutralErrorCodes = map[string]struct{}{
	"get_channel_failed":       {},
	"gen_relay_info_failed":    {},
	"invalid_api_type":         {},
	"count_token_failed":       {},
	"model_price_error":        {},
	"json_marshal_failed":      {},
	"read_request_body_failed": {},
	"convert_request_failed":   {},
	"bad_request_body":         {},
	"invalid_request":          {},
	"access_denied":            {},
	"sensitive_words_detected": {},
}

// UpstreamOutcomeForRelay decides what one finished relay call says about the
// upstream. A request we rejected ourselves, or one the caller got wrong, says
// nothing about upstream health and must not raise the banner for everyone.
func UpstreamOutcomeForRelay(statusCode int, errorCode string, relayed bool) (ok bool, recorded bool) {
	if relayed {
		return true, true
	}
	if statusCode >= 400 && statusCode < 500 && statusCode != http.StatusTooManyRequests {
		return false, false
	}
	if _, neutral := upstreamNeutralErrorCodes[errorCode]; neutral {
		return false, false
	}
	return false, true
}

// SnapshotUpstreamHealth reports the current state of every tracked capability.
func SnapshotUpstreamHealth() UpstreamHealthSnapshot {
	return snapshotUpstreamHealthAt(time.Now())
}

func recordUpstreamOutcomeAt(capability UpstreamCapability, ok bool, at time.Time) {
	if capability == "" {
		return
	}
	upstreamHealthMutex.Lock()
	defer upstreamHealthMutex.Unlock()

	outcomes := append(upstreamOutcomes[capability], upstreamOutcome{at: at, ok: ok})
	cutoff := at.Add(-upstreamHealthWindow)
	expired := 0
	for expired < len(outcomes) && outcomes[expired].at.Before(cutoff) {
		expired++
	}
	upstreamOutcomes[capability] = outcomes[expired:]
}

func snapshotUpstreamHealthAt(now time.Time) UpstreamHealthSnapshot {
	upstreamHealthMutex.Lock()
	defer upstreamHealthMutex.Unlock()

	snapshot := UpstreamHealthSnapshot{
		State:         UpstreamStateOk,
		WindowSeconds: int(upstreamHealthWindow / time.Second),
		Capabilities:  make([]UpstreamCapabilityHealth, 0, len(upstreamOutcomes)),
	}
	cutoff := now.Add(-upstreamHealthWindow)
	for capability, outcomes := range upstreamOutcomes {
		health := upstreamCapabilityHealthAt(capability, outcomes, cutoff)
		if upstreamStateRank(health.State) > upstreamStateRank(snapshot.State) {
			snapshot.State = health.State
		}
		snapshot.Capabilities = append(snapshot.Capabilities, health)
	}
	slices.SortFunc(snapshot.Capabilities, func(a, b UpstreamCapabilityHealth) int {
		return cmp.Compare(a.Capability, b.Capability)
	})
	return snapshot
}

func upstreamCapabilityHealthAt(capability UpstreamCapability, outcomes []upstreamOutcome, cutoff time.Time) UpstreamCapabilityHealth {
	health := UpstreamCapabilityHealth{Capability: string(capability)}
	// Walk backwards from the newest outcome: attempts and failures count the
	// whole window, while the failure streak stops at the first success.
	streakOpen := true
	for i := len(outcomes) - 1; i >= 0; i-- {
		if outcomes[i].at.Before(cutoff) {
			break
		}
		health.Attempts++
		if outcomes[i].ok {
			streakOpen = false
			continue
		}
		health.Failures++
		if streakOpen {
			health.ConsecutiveFailures++
		}
	}
	health.State = upstreamStateFor(health)
	return health
}

func upstreamStateFor(health UpstreamCapabilityHealth) string {
	if health.Attempts == 0 {
		return UpstreamStateOk
	}
	if health.ConsecutiveFailures >= upstreamDownConsecutiveFailures {
		return UpstreamStateDown
	}
	failureRatio := float64(health.Failures) / float64(health.Attempts)
	if health.Attempts >= upstreamDownMinAttempts && failureRatio >= upstreamDownFailureRatio {
		return UpstreamStateDown
	}
	if health.Attempts >= upstreamDegradedMinAttempts && failureRatio >= upstreamDegradedFailureRatio {
		return UpstreamStateDegraded
	}
	return UpstreamStateOk
}

func upstreamStateRank(state string) int {
	switch state {
	case UpstreamStateDown:
		return 2
	case UpstreamStateDegraded:
		return 1
	}
	return 0
}
