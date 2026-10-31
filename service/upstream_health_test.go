package service

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func resetUpstreamOutcomes(t *testing.T) {
	t.Helper()
	upstreamHealthMutex.Lock()
	previous := upstreamOutcomes
	upstreamOutcomes = map[UpstreamCapability][]upstreamOutcome{}
	upstreamHealthMutex.Unlock()
	t.Cleanup(func() {
		upstreamHealthMutex.Lock()
		upstreamOutcomes = previous
		upstreamHealthMutex.Unlock()
	})
}

func capabilityHealth(t *testing.T, snapshot UpstreamHealthSnapshot, capability string) UpstreamCapabilityHealth {
	t.Helper()
	for _, health := range snapshot.Capabilities {
		if health.Capability == capability {
			return health
		}
	}
	require.FailNow(t, "capability missing from snapshot", capability)
	return UpstreamCapabilityHealth{}
}

func recordSequence(capability UpstreamCapability, at time.Time, outcomes ...bool) {
	for _, ok := range outcomes {
		recordUpstreamOutcomeAt(capability, ok, at)
	}
}

func TestUpstreamHealthWithoutTrafficStaysQuiet(t *testing.T) {
	resetUpstreamOutcomes(t)

	snapshot := snapshotUpstreamHealthAt(time.Now())

	assert.Equal(t, UpstreamStateOk, snapshot.State)
	assert.Empty(t, snapshot.Capabilities)
}

func TestUpstreamHealthGoesDownAfterConsecutiveFailures(t *testing.T) {
	resetUpstreamOutcomes(t)
	now := time.Now()
	recordSequence(UpstreamCapabilityImage, now, true, false, false, false)

	snapshot := snapshotUpstreamHealthAt(now)

	assert.Equal(t, UpstreamStateDown, snapshot.State)
	health := capabilityHealth(t, snapshot, "image")
	assert.Equal(t, UpstreamStateDown, health.State)
	assert.Equal(t, 4, health.Attempts)
	assert.Equal(t, 3, health.Failures)
	assert.Equal(t, 3, health.ConsecutiveFailures)
}

// Two failures out of three is what a vendor outage looks like at our volume,
// and it must be enough to warn users before they spend quota.
func TestUpstreamHealthGoesDownOnMajorityFailuresAtLowVolume(t *testing.T) {
	resetUpstreamOutcomes(t)
	now := time.Now()
	recordSequence(UpstreamCapabilityImage, now, true, false, false)

	snapshot := snapshotUpstreamHealthAt(now)

	health := capabilityHealth(t, snapshot, "image")
	assert.Equal(t, UpstreamStateDown, health.State)
	assert.Equal(t, 2, health.Failures)
	assert.Equal(t, 3, health.Attempts)
}

// A single failure carries no signal, so the banner must not react to it.
func TestUpstreamHealthIgnoresOneFailureInTwo(t *testing.T) {
	resetUpstreamOutcomes(t)
	now := time.Now()
	recordSequence(UpstreamCapabilityImage, now, true, false)

	snapshot := snapshotUpstreamHealthAt(now)

	assert.Equal(t, UpstreamStateOk, snapshot.State)
}

func TestUpstreamHealthReportsDegradedOnSparseFailures(t *testing.T) {
	resetUpstreamOutcomes(t)
	now := time.Now()
	recordSequence(UpstreamCapabilityChat, now, true, true, false, true, true)

	snapshot := snapshotUpstreamHealthAt(now)

	assert.Equal(t, UpstreamStateDegraded, snapshot.State)
	health := capabilityHealth(t, snapshot, "chat")
	assert.Equal(t, 1, health.Failures)
	assert.Equal(t, 5, health.Attempts)
	// The failure is not the newest outcome, so no streak is open.
	assert.Equal(t, 0, health.ConsecutiveFailures)
}

func TestUpstreamHealthRecoversAfterFailuresAgeOutOfWindow(t *testing.T) {
	resetUpstreamOutcomes(t)
	failureAt := time.Now().Add(-upstreamHealthWindow - time.Minute)
	recordSequence(UpstreamCapabilityImage, failureAt, false, false, false, false)
	recoveredAt := time.Now()
	recordSequence(UpstreamCapabilityImage, recoveredAt, true)

	snapshot := snapshotUpstreamHealthAt(recoveredAt)

	assert.Equal(t, UpstreamStateOk, snapshot.State)
	health := capabilityHealth(t, snapshot, "image")
	assert.Equal(t, 1, health.Attempts)
	assert.Equal(t, 0, health.Failures)
}

func TestUpstreamCapabilityForPathTracksOnlyBannerSurfaces(t *testing.T) {
	assert.Equal(t, UpstreamCapabilityImage, UpstreamCapabilityForPath("/v1/images/generations"))
	assert.Equal(t, UpstreamCapabilityImage, UpstreamCapabilityForPath("/v1/images/edits"))
	assert.Equal(t, UpstreamCapabilityChat, UpstreamCapabilityForPath("/v1/chat/completions"))
	assert.Equal(t, UpstreamCapabilityChat, UpstreamCapabilityForPath("/v1/messages"))
	assert.Equal(t, UpstreamCapabilityChat, UpstreamCapabilityForPath("/v1/responses"))
	assert.Equal(t, UpstreamCapability(""), UpstreamCapabilityForPath("/v1/embeddings"))
	assert.Equal(t, UpstreamCapability(""), UpstreamCapabilityForPath("/v1/audio/speech"))
}

func TestUpstreamOutcomeForRelayBlamesOnlyUpstreamFaults(t *testing.T) {
	ok, recorded := UpstreamOutcomeForRelay(0, "", true)
	assert.True(t, ok)
	assert.True(t, recorded)

	ok, recorded = UpstreamOutcomeForRelay(http.StatusBadGateway, "bad_response_status_code", false)
	assert.False(t, ok)
	assert.True(t, recorded)

	// The caller's own request was wrong, so this says nothing about upstream health.
	_, recorded = UpstreamOutcomeForRelay(http.StatusBadRequest, "invalid_request", false)
	assert.False(t, recorded)

	// No channel serves this model: that is our configuration, not the provider.
	_, recorded = UpstreamOutcomeForRelay(http.StatusServiceUnavailable, "get_channel_failed", false)
	assert.False(t, recorded)

	// Being throttled by the upstream is the upstream's problem.
	_, recorded = UpstreamOutcomeForRelay(http.StatusTooManyRequests, "", false)
	assert.True(t, recorded)
}
