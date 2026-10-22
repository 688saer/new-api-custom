package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// ---------------------------------------------------------------------------
// 渠道可用性探测
// ---------------------------------------------------------------------------

const (
	serviceStatusProbeTimeout      = 60 * time.Second
	serviceStatusProbeMaxBodyBytes = 256 * 1024
	serviceStatusProbePrompt       = "ping"
	serviceStatusProbeMaxTokens    = 16
	// The worker waits this long after boot so migrations and cache warm-up
	// finish first, then probes immediately instead of waiting a full interval.
	serviceStatusProbeStartupDelay = 10 * time.Second
)

var (
	serviceStatusProbeOnce sync.Once
	serviceStatusProbeStop chan struct{}
)

// StartServiceStatusProbeWorker starts the background probe loop. Repeated
// calls are safe.
func StartServiceStatusProbeWorker() {
	serviceStatusProbeOnce.Do(func() {
		serviceStatusProbeStop = make(chan struct{})
		go serviceStatusProbeLoop(serviceStatusProbeStop)
	})
}

// StopServiceStatusProbeWorker stops the background probe loop.
func StopServiceStatusProbeWorker() {
	if serviceStatusProbeStop == nil {
		return
	}
	close(serviceStatusProbeStop)
	serviceStatusProbeStop = nil
	serviceStatusProbeOnce = sync.Once{}
}

func serviceStatusProbeLoop(stop chan struct{}) {
	timer := time.NewTimer(serviceStatusProbeStartupDelay)
	defer timer.Stop()

	for {
		select {
		case <-stop:
			return
		case <-timer.C:
		}

		setting := operation_setting.GetServiceStatusSetting()
		if setting.Enabled {
			RunServiceStatusProbeCycle()
			CleanupServiceStatusSamples()
		}

		interval := time.Duration(setting.ProbeIntervalMinutes) * time.Minute
		if interval < time.Minute {
			interval = time.Minute
		}
		timer.Reset(interval)
	}
}

// RunServiceStatusProbeCycle probes every enabled target once.
func RunServiceStatusProbeCycle() {
	setting := operation_setting.GetServiceStatusSetting()
	if !setting.Enabled {
		return
	}

	for i := range setting.Targets {
		target := setting.Targets[i]
		if !target.Enabled {
			continue
		}
		ProbeServiceStatusTarget(target)
	}
}

// TriggerServiceStatusProbeAsync starts a probe cycle in the background. It is
// called right after the operator saves settings so a freshly added target
// produces data immediately instead of waiting for the next interval.
func TriggerServiceStatusProbeAsync() {
	go RunServiceStatusProbeCycle()
}

// ProbeServiceStatusTarget probes one target and records the sample.
func ProbeServiceStatusTarget(target operation_setting.ServiceStatusTarget) *model.ServiceStatusSample {
	sample := &model.ServiceStatusSample{
		TargetId:  target.Id,
		Timestamp: time.Now().Unix(),
	}

	if strings.TrimSpace(target.Model) == "" {
		sample.Success = false
		sample.ErrorMessage = "probe model is not configured"
		persistServiceStatusSample(sample)
		return sample
	}

	latency, firstToken, err := executeServiceStatusProbe(target)
	if err != nil {
		sample.Success = false
		sample.ErrorMessage = truncateServiceStatusError(err.Error())
	} else {
		sample.Success = true
		sample.LatencyMs = latency
		sample.FirstTokenMs = firstToken
	}

	persistServiceStatusSample(sample)
	return sample
}

func persistServiceStatusSample(sample *model.ServiceStatusSample) {
	if err := model.CreateServiceStatusSample(sample); err != nil {
		common.SysError("service status: failed to persist probe sample: " + err.Error())
	}
}

// executeServiceStatusProbe sends one streaming request upstream and reports
// the total duration plus the time until the first content arrived.
func executeServiceStatusProbe(target operation_setting.ServiceStatusTarget) (int, int, error) {
	url, body, headers, err := buildServiceStatusProbeRequest(target)
	if err != nil {
		return 0, 0, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), serviceStatusProbeTimeout)
	defer cancel()

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return 0, 0, err
	}
	for key, value := range headers {
		request.Header.Set(key, value)
	}

	start := time.Now()
	response, err := GetHttpClient().Do(request)
	if err != nil {
		return 0, 0, err
	}
	defer func() {
		_ = response.Body.Close()
	}()

	firstToken, readErr := readServiceStatusProbeStream(response.Body, start)
	latency := int(time.Since(start).Milliseconds())

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return latency, firstToken, fmt.Errorf("upstream returned HTTP %d", response.StatusCode)
	}
	if readErr != nil && firstToken == 0 {
		return latency, 0, readErr
	}
	if firstToken == 0 {
		return latency, 0, fmt.Errorf("upstream returned an empty response")
	}

	return latency, firstToken, nil
}

// readServiceStatusProbeStream consumes the response body and returns the
// elapsed milliseconds until the first meaningful payload byte. For SSE
// responses that is the first `data:` chunk carrying content; for plain JSON it
// is the first non-whitespace byte.
func readServiceStatusProbeStream(body io.Reader, start time.Time) (int, error) {
	reader := io.LimitReader(body, serviceStatusProbeMaxBodyBytes)
	buffer := make([]byte, 4096)
	firstToken := 0
	sawAny := false

	for {
		read, err := reader.Read(buffer)
		if read > 0 {
			sawAny = true
			if firstToken == 0 && hasServiceStatusPayload(buffer[:read]) {
				firstToken = int(time.Since(start).Milliseconds())
			}
		}
		if err != nil {
			if err == io.EOF {
				break
			}
			return firstToken, err
		}
	}

	if firstToken == 0 && sawAny {
		// Body arrived but carried no recognisable payload; fall back to the
		// total duration so the sample still records a usable latency.
		firstToken = int(time.Since(start).Milliseconds())
	}
	return firstToken, nil
}

// hasServiceStatusPayload reports whether a chunk contains response content
// rather than framing, keep-alives, or empty SSE envelopes.
func hasServiceStatusPayload(chunk []byte) bool {
	trimmed := bytes.TrimSpace(chunk)
	if len(trimmed) == 0 {
		return false
	}
	lower := bytes.ToLower(trimmed)

	// SSE comments / keep-alives carry no payload.
	if bytes.HasPrefix(lower, []byte(":")) {
		return false
	}
	// An SSE event whose data is `[DONE]` or `{}` is framing only.
	if bytes.HasPrefix(lower, []byte("event:")) {
		return false
	}
	if bytes.Contains(lower, []byte("[done]")) && len(trimmed) < 32 {
		return false
	}
	return true
}

// buildServiceStatusProbeRequest assembles the request for one endpoint kind.
func buildServiceStatusProbeRequest(target operation_setting.ServiceStatusTarget) (string, []byte, map[string]string, error) {
	baseUrl := operation_setting.NormalizeServiceStatusBaseUrl(target.BaseUrl)
	if baseUrl == "" {
		return "", nil, nil, fmt.Errorf("probe endpoint is not configured")
	}

	headers := map[string]string{"Content-Type": "application/json"}
	apiKey := strings.TrimSpace(target.ApiKey)

	switch target.ProbeEndpoint {
	case operation_setting.ProbeEndpointAnthropic:
		if apiKey != "" {
			headers["x-api-key"] = apiKey
			headers["anthropic-version"] = "2023-06-01"
		}
		payload := map[string]any{
			"model":      target.Model,
			"max_tokens": serviceStatusProbeMaxTokens,
			"stream":     true,
			"messages": []map[string]string{
				{"role": "user", "content": serviceStatusProbePrompt},
			},
		}
		body, err := common.Marshal(payload)
		if err != nil {
			return "", nil, nil, err
		}
		return baseUrl + "/v1/messages", body, headers, nil

	case operation_setting.ProbeEndpointOpenAIResponse:
		if apiKey != "" {
			headers["Authorization"] = "Bearer " + apiKey
		}
		payload := map[string]any{
			"model":             target.Model,
			"input":             serviceStatusProbePrompt,
			"max_output_tokens": serviceStatusProbeMaxTokens,
			"stream":            true,
		}
		body, err := common.Marshal(payload)
		if err != nil {
			return "", nil, nil, err
		}
		return baseUrl + "/v1/responses", body, headers, nil

	default:
		if apiKey != "" {
			headers["Authorization"] = "Bearer " + apiKey
		}
		payload := map[string]any{
			"model":      target.Model,
			"max_tokens": serviceStatusProbeMaxTokens,
			"stream":     true,
			"messages": []map[string]string{
				{"role": "user", "content": serviceStatusProbePrompt},
			},
		}
		body, err := common.Marshal(payload)
		if err != nil {
			return "", nil, nil, err
		}
		return baseUrl + "/v1/chat/completions", body, headers, nil
	}
}

// CleanupServiceStatusSamples removes samples older than the retention window.
func CleanupServiceStatusSamples() {
	setting := operation_setting.GetServiceStatusSetting()
	cutoff := model.ServiceStatusSampleRetentionCutoff(setting.SampleRetentionDays)
	if _, err := model.DeleteServiceStatusSamplesBefore(cutoff); err != nil {
		common.SysError("service status: failed to clean up samples: " + err.Error())
	}
}

func truncateServiceStatusError(message string) string {
	const limit = 255
	if len(message) <= limit {
		return message
	}
	return message[:limit]
}
