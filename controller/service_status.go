package controller

import (
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// 渠道可用性
// ---------------------------------------------------------------------------

// ServiceStatusCell 是公开接口返回的一个时间格。
type ServiceStatusCell struct {
	Timestamp    int64   `json:"timestamp"`
	Status       string  `json:"status"`
	ProbeCount   int     `json:"probe_count"`
	SuccessCount int     `json:"success_count"`
	SuccessRate  float64 `json:"success_rate"`
	ErrorRate    float64 `json:"error_rate"`
	AvgLatency   int     `json:"avg_latency"`
	P50Latency   int     `json:"p50_latency"`
	P90Latency   int     `json:"p90_latency"`
	FirstToken   int     `json:"first_token_latency"`
}

// ServiceStatusGroup 是公开接口返回的一个渠道分组。
type ServiceStatusGroup struct {
	Id            string              `json:"id"`
	Group         string              `json:"group"`
	DisplayName   string              `json:"display_name"`
	Description   string              `json:"description"`
	Category      string              `json:"category"`
	Icon          string              `json:"icon"`
	Model         string              `json:"model"`
	BillingMode   string              `json:"billing_mode"`
	ProbeEndpoint string              `json:"probe_endpoint"`
	Status        string              `json:"status"`
	ProbeCount    int                 `json:"probe_count"`
	SuccessCount  int                 `json:"success_count"`
	SuccessRate   float64             `json:"success_rate"`
	ErrorRate     float64             `json:"error_rate"`
	AvgLatency    int                 `json:"avg_latency"`
	P50Latency    int                 `json:"p50_latency"`
	P90Latency    int                 `json:"p90_latency"`
	FirstToken    int                 `json:"first_token_latency"`
	BestLatency   int                 `json:"best_response_time"`
	UpdatedAt     int64               `json:"updated_at"`
	Cells         []ServiceStatusCell `json:"cells"`
}

// ServiceStatusPayload 是公开接口的响应体。
type ServiceStatusPayload struct {
	Enabled              bool                 `json:"enabled"`
	Title                string               `json:"title"`
	Description          string               `json:"description"`
	Range                string               `json:"range"`
	DisplayHours         int                  `json:"display_hours"`
	ProbeIntervalSeconds int                  `json:"probe_interval_seconds"`
	ShowLatency          bool                 `json:"show_latency"`
	ServerTime           int64                `json:"server_time"`
	Code                 string               `json:"code,omitempty"`
	Reason               string               `json:"reason,omitempty"`
	Groups               []ServiceStatusGroup `json:"groups"`
}

// 公开接口的错误码，前端据此展示对应文案。
const (
	ServiceStatusCodeNotEnabled    = "NOT_ENABLED"
	ServiceStatusCodeLoginRequired = "LOGIN_REQUIRED"
)

// 支持的时间窗。
var serviceStatusRanges = map[string]int64{
	"60m": 60 * 60,
	"24h": 24 * 60 * 60,
	"7d":  7 * 24 * 60 * 60,
	"30d": 30 * 24 * 60 * 60,
}

const defaultServiceStatusRange = "24h"

// GetServiceStatus 返回公开的渠道可用性数据。
func GetServiceStatus(c *gin.Context) {
	setting := operation_setting.GetServiceStatusSetting()

	payload := ServiceStatusPayload{
		Enabled:              setting.Enabled,
		Title:                setting.Title,
		Description:          setting.Description,
		DisplayHours:         setting.DisplayHours,
		ProbeIntervalSeconds: setting.ProbeIntervalMinutes * 60,
		ShowLatency:          setting.ShowLatency,
		ServerTime:           time.Now().Unix(),
		Groups:               []ServiceStatusGroup{},
	}

	if !setting.Enabled {
		payload.Code = ServiceStatusCodeNotEnabled
		payload.Reason = "Service status is not enabled"
		c.JSON(200, gin.H{"success": true, "message": "", "data": payload})
		return
	}

	if setting.RequireLogin && !isServiceStatusViewerAuthenticated(c) {
		payload.Code = ServiceStatusCodeLoginRequired
		payload.Reason = "Sign in to view the service status"
		c.JSON(200, gin.H{"success": true, "message": "", "data": payload})
		return
	}

	rangeKey := strings.TrimSpace(c.Query("range"))
	windowSeconds, ok := serviceStatusRanges[rangeKey]
	if !ok {
		rangeKey = defaultServiceStatusRange
		windowSeconds = serviceStatusRanges[rangeKey]
	}
	payload.Range = rangeKey

	now := time.Now().Unix()
	since := now - windowSeconds
	probeIntervalSeconds := int64(setting.ProbeIntervalMinutes) * 60
	bucketSeconds := model.ServiceStatusBucketSeconds(windowSeconds, probeIntervalSeconds)

	targetIds := make([]string, 0, len(setting.Targets))
	for i := range setting.Targets {
		target := setting.Targets[i]
		if target.Enabled {
			targetIds = append(targetIds, target.Id)
		}
	}

	samplesByTarget, err := model.GetServiceStatusSamples(targetIds, since)
	if err != nil {
		common.SysError("service status: failed to load samples: " + err.Error())
		c.JSON(200, gin.H{
			"success": false,
			"message": "Unable to load service status.",
			"data":    payload,
		})
		return
	}

	groups := make([]ServiceStatusGroup, 0, len(setting.Targets))
	for i := range setting.Targets {
		target := setting.Targets[i]
		if !target.Enabled {
			continue
		}

		stats := model.AggregateServiceStatusSamples(
			samplesByTarget[target.Id],
			since,
			now,
			bucketSeconds,
		)

		group := ServiceStatusGroup{
			Id:            target.Id,
			Group:         target.Group,
			DisplayName:   target.Name,
			Description:   target.Description,
			Category:      target.Category,
			Icon:          target.Icon,
			Model:         target.Model,
			BillingMode:   target.BillingMode,
			ProbeEndpoint: target.ProbeEndpoint,
			Status:        model.ServiceStatusGray,
			ProbeCount:    stats.ProbeCount,
			SuccessCount:  stats.SuccessCount,
			SuccessRate:   stats.SuccessRate,
			ErrorRate:     stats.ErrorRate,
			AvgLatency:    stats.AvgLatency,
			P50Latency:    stats.P50Latency,
			P90Latency:    stats.P90Latency,
			FirstToken:    stats.FirstToken,
			BestLatency:   stats.BestLatency,
			UpdatedAt:     stats.UpdatedAt,
			Cells:         make([]ServiceStatusCell, 0, len(stats.Buckets)),
		}

		if stats.ProbeCount > 0 {
			group.Status = model.ServiceStatusColorFor(stats.SuccessCount, stats.ProbeCount)
		}

		for _, bucket := range stats.Buckets {
			group.Cells = append(group.Cells, ServiceStatusCell{
				Timestamp:    bucket.Timestamp,
				Status:       bucket.Status,
				ProbeCount:   bucket.ProbeCount,
				SuccessCount: bucket.SuccessCount,
				SuccessRate:  bucket.SuccessRate,
				ErrorRate:    bucket.ErrorRate,
				AvgLatency:   bucket.AvgLatency,
				P50Latency:   bucket.P50Latency,
				P90Latency:   bucket.P90Latency,
				FirstToken:   bucket.FirstToken,
			})
		}

		groups = append(groups, group)
	}

	payload.Groups = groups
	c.JSON(200, gin.H{"success": true, "message": "", "data": payload})
}

// isServiceStatusViewerAuthenticated 判断当前请求是否来自已登录用户。
func isServiceStatusViewerAuthenticated(c *gin.Context) bool {
	if _, exists := c.Get("id"); exists {
		return true
	}
	return false
}

// ServiceStatusTargetStatus 是管理端展示的单个目标探测状态。
type ServiceStatusTargetStatus struct {
	TargetId   string `json:"target_id"`
	Probed     bool   `json:"probed"`
	Success    bool   `json:"success"`
	Timestamp  int64  `json:"timestamp"`
	LatencyMs  int    `json:"latency_ms"`
	FirstToken int    `json:"first_token_ms"`
	Error      string `json:"error_message"`
}

// ServiceStatusAdminPayload 是管理端配置加上每个目标的最近探测结果。
type ServiceStatusAdminPayload struct {
	operation_setting.ServiceStatusSetting
	TargetStatuses []ServiceStatusTargetStatus `json:"target_statuses"`
}

// GetServiceStatusAdminSettings 返回管理端配置及每个目标的最近探测结果。
func GetServiceStatusAdminSettings(c *gin.Context) {
	setting := operation_setting.GetServiceStatusSetting()

	targetIds := make([]string, 0, len(setting.Targets))
	for i := range setting.Targets {
		targetIds = append(targetIds, setting.Targets[i].Id)
	}

	statuses := make([]ServiceStatusTargetStatus, 0, len(targetIds))
	latest, err := model.GetLatestServiceStatusSamples(targetIds)
	if err != nil {
		common.SysError("service status: failed to load latest samples: " + err.Error())
	}
	for _, targetId := range targetIds {
		status := ServiceStatusTargetStatus{TargetId: targetId}
		if sample, exists := latest[targetId]; exists {
			status.Probed = true
			status.Success = sample.Success
			status.Timestamp = sample.Timestamp
			status.LatencyMs = sample.LatencyMs
			status.FirstToken = sample.FirstTokenMs
			status.Error = sample.ErrorMessage
		}
		statuses = append(statuses, status)
	}

	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data": ServiceStatusAdminPayload{
			ServiceStatusSetting: *setting,
			TargetStatuses:       statuses,
		},
	})
}

// UpdateServiceStatusAdminSettings 保存管理端配置。
func UpdateServiceStatusAdminSettings(c *gin.Context) {
	var payload operation_setting.ServiceStatusSetting
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(400, gin.H{"success": false, "message": "Invalid request body"})
		return
	}

	updates := map[string]string{
		"service_status_setting.enabled":                strconv.FormatBool(payload.Enabled),
		"service_status_setting.title":                  payload.Title,
		"service_status_setting.description":            payload.Description,
		"service_status_setting.display_hours":          strconv.Itoa(payload.DisplayHours),
		"service_status_setting.probe_interval_minutes": strconv.Itoa(payload.ProbeIntervalMinutes),
		"service_status_setting.sample_retention_days":  strconv.Itoa(payload.SampleRetentionDays),
		"service_status_setting.require_login":          strconv.FormatBool(payload.RequireLogin),
		"service_status_setting.show_latency":           strconv.FormatBool(payload.ShowLatency),
	}

	targetsJson, err := common.Marshal(payload.Targets)
	if err != nil {
		c.JSON(500, gin.H{"success": false, "message": "Failed to encode targets"})
		return
	}
	updates["service_status_setting.targets"] = string(targetsJson)

	if err := model.UpdateOptionsBulk(updates); err != nil {
		c.JSON(500, gin.H{"success": false, "message": "Failed to save service status settings"})
		return
	}

	// 保存后立刻跑一轮探测，让新配置的渠道马上有数据，而不是等下一个周期。
	if payload.Enabled {
		service.TriggerServiceStatusProbeAsync()
	}

	c.JSON(200, gin.H{"success": true, "message": ""})
}

// ProbeAllServiceStatusTargets 立即对全部启用目标探测一次。
func ProbeAllServiceStatusTargets(c *gin.Context) {
	setting := operation_setting.GetServiceStatusSetting()
	if !setting.Enabled {
		c.JSON(400, gin.H{"success": false, "message": "Service status is not enabled"})
		return
	}

	probed := 0
	for i := range setting.Targets {
		target := setting.Targets[i]
		if !target.Enabled {
			continue
		}
		service.ProbeServiceStatusTarget(target)
		probed++
	}

	c.JSON(200, gin.H{"success": true, "message": "", "data": gin.H{"probed": probed}})
}

// ProbeServiceStatusTargetNow 手动触发一次探测。
func ProbeServiceStatusTargetNow(c *gin.Context) {
	targetId := strings.TrimSpace(c.Param("id"))
	if targetId == "" {
		c.JSON(400, gin.H{"success": false, "message": "Target id is required"})
		return
	}

	setting := operation_setting.GetServiceStatusSetting()
	for i := range setting.Targets {
		target := setting.Targets[i]
		if target.Id != targetId {
			continue
		}

		sample := service.ProbeServiceStatusTarget(target)
		c.JSON(200, gin.H{"success": true, "message": "", "data": sample})
		return
	}

	c.JSON(404, gin.H{"success": false, "message": "Target not found"})
}

// ClearServiceStatusSamples 清空探测历史。
func ClearServiceStatusSamples(c *gin.Context) {
	targetId := strings.TrimSpace(c.Query("target_id"))

	var (
		removed int64
		err     error
	)
	if targetId == "" {
		removed, err = model.DeleteAllServiceStatusSamples()
	} else {
		removed, err = model.DeleteServiceStatusSamplesByTarget(targetId)
	}
	if err != nil {
		c.JSON(500, gin.H{"success": false, "message": "Failed to clear probe history"})
		return
	}

	c.JSON(200, gin.H{"success": true, "message": "", "data": gin.H{"removed": removed}})
}
