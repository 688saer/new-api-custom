package model

import (
	"sort"
	"time"
)

// ---------------------------------------------------------------------------
// 渠道可用性探测样本
// ---------------------------------------------------------------------------

// ServiceStatusSample 是一次探测的结果快照。每个 target 按探测间隔写入一行，
// 公开接口再按时间窗把这些行聚合成可用性色带。
type ServiceStatusSample struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	TargetId     string `json:"target_id" gorm:"type:varchar(64);not null;index:idx_service_status_target_time,priority:1"`
	Timestamp    int64  `json:"timestamp" gorm:"bigint;not null;index:idx_service_status_target_time,priority:2"`
	Success      bool   `json:"success" gorm:"not null;default:false"`
	LatencyMs    int    `json:"latency_ms" gorm:"not null;default:0"`
	FirstTokenMs int    `json:"first_token_ms" gorm:"not null;default:0"`
	ErrorMessage string `json:"error_message" gorm:"type:varchar(255);not null;default:''"`
}

func (ServiceStatusSample) TableName() string {
	return "service_status_samples"
}

// ServiceStatusBucket 是聚合后的一个时间格，对应前端色带上的一块。
type ServiceStatusBucket struct {
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

// ServiceStatusTargetStats 是单个 target 在时间窗内的汇总。
type ServiceStatusTargetStats struct {
	ProbeCount   int
	SuccessCount int
	SuccessRate  float64
	ErrorRate    float64
	AvgLatency   int
	P50Latency   int
	P90Latency   int
	FirstToken   int
	BestLatency  int
	UpdatedAt    int64
	Buckets      []ServiceStatusBucket
}

// 状态色。green 表示全部成功，yellow 表示部分失败，red 表示全部失败，
// gray 表示该时段没有探测数据。
const (
	ServiceStatusGreen  = "green"
	ServiceStatusYellow = "yellow"
	ServiceStatusRed    = "red"
	ServiceStatusGray   = "gray"
)

// CreateServiceStatusSample 写入一条探测样本。
func CreateServiceStatusSample(sample *ServiceStatusSample) error {
	return DB.Create(sample).Error
}

// GetServiceStatusSamples 读取时间窗内的样本，按 target 分组返回。
func GetServiceStatusSamples(targetIds []string, since int64) (map[string][]ServiceStatusSample, error) {
	result := make(map[string][]ServiceStatusSample)
	if len(targetIds) == 0 {
		return result, nil
	}

	var samples []ServiceStatusSample
	err := DB.
		Where("target_id IN ? AND timestamp >= ?", targetIds, since).
		Order("timestamp ASC").
		Find(&samples).Error
	if err != nil {
		return nil, err
	}

	for i := range samples {
		sample := samples[i]
		result[sample.TargetId] = append(result[sample.TargetId], sample)
	}
	return result, nil
}

// GetLatestServiceStatusSample 返回单个 target 最近一次探测的时间戳。
func GetLatestServiceStatusSample(targetId string) (int64, error) {
	var sample ServiceStatusSample
	err := DB.
		Where("target_id = ?", targetId).
		Order("timestamp DESC").
		Limit(1).
		Find(&sample).Error
	if err != nil {
		return 0, err
	}
	return sample.Timestamp, nil
}

// GetLatestServiceStatusSamples 返回每个 target 最近一次探测结果，供管理端
// 展示探测状态与失败原因。
func GetLatestServiceStatusSamples(targetIds []string) (map[string]ServiceStatusSample, error) {
	result := make(map[string]ServiceStatusSample, len(targetIds))
	if len(targetIds) == 0 {
		return result, nil
	}

	var samples []ServiceStatusSample
	err := DB.
		Where("target_id IN ?", targetIds).
		Order("timestamp DESC").
		Find(&samples).Error
	if err != nil {
		return nil, err
	}

	// 结果按 timestamp 倒序，第一次出现的即该 target 的最新样本。
	for i := range samples {
		sample := samples[i]
		if _, exists := result[sample.TargetId]; exists {
			continue
		}
		result[sample.TargetId] = sample
	}
	return result, nil
}

// DeleteServiceStatusSamplesBefore 清理过期样本，返回删除行数。
func DeleteServiceStatusSamplesBefore(before int64) (int64, error) {
	result := DB.Where("timestamp < ?", before).Delete(&ServiceStatusSample{})
	return result.RowsAffected, result.Error
}

// DeleteServiceStatusSamplesByTarget 清空单个 target 的历史。
func DeleteServiceStatusSamplesByTarget(targetId string) (int64, error) {
	result := DB.Where("target_id = ?", targetId).Delete(&ServiceStatusSample{})
	return result.RowsAffected, result.Error
}

// DeleteAllServiceStatusSamples 清空全部历史。
func DeleteAllServiceStatusSamples() (int64, error) {
	result := DB.Where("1 = 1").Delete(&ServiceStatusSample{})
	return result.RowsAffected, result.Error
}

// AggregateServiceStatusSamples 把样本按 bucketSeconds 分桶，并计算整体统计。
//
// 分桶以 since 为起点对齐，保证同一时间窗内多次请求得到相同的格子边界。
func AggregateServiceStatusSamples(
	samples []ServiceStatusSample,
	since int64,
	until int64,
	bucketSeconds int64,
) ServiceStatusTargetStats {
	stats := ServiceStatusTargetStats{}
	if bucketSeconds <= 0 {
		bucketSeconds = 300
	}

	bucketCount := int((until-since)/bucketSeconds) + 1
	if bucketCount < 1 {
		bucketCount = 1
	}
	if bucketCount > 2000 {
		bucketCount = 2000
	}

	type accumulator struct {
		probeCount   int
		successCount int
		latencies    []int
		firstTokens  []int
	}
	buckets := make([]accumulator, bucketCount)

	latencies := make([]int, 0, len(samples))
	firstTokens := make([]int, 0, len(samples))

	for i := range samples {
		sample := samples[i]
		stats.ProbeCount++
		if sample.Success {
			stats.SuccessCount++
		}

		index := int((sample.Timestamp - since) / bucketSeconds)
		if index < 0 || index >= bucketCount {
			continue
		}

		buckets[index].probeCount++
		if sample.Success {
			buckets[index].successCount++
			if sample.LatencyMs > 0 {
				buckets[index].latencies = append(buckets[index].latencies, sample.LatencyMs)
				latencies = append(latencies, sample.LatencyMs)
			}
			if sample.FirstTokenMs > 0 {
				buckets[index].firstTokens = append(buckets[index].firstTokens, sample.FirstTokenMs)
				firstTokens = append(firstTokens, sample.FirstTokenMs)
			}
		}

		if sample.Timestamp > stats.UpdatedAt {
			stats.UpdatedAt = sample.Timestamp
		}
	}

	if stats.ProbeCount > 0 {
		stats.SuccessRate = float64(stats.SuccessCount) / float64(stats.ProbeCount) * 100
		stats.ErrorRate = 100 - stats.SuccessRate
	}

	stats.AvgLatency, stats.P50Latency, stats.P90Latency = summarizeLatencies(latencies)
	stats.BestLatency = minOrZero(latencies)
	stats.FirstToken = averageInts(firstTokens)

	stats.Buckets = make([]ServiceStatusBucket, 0, bucketCount)
	for index := range buckets {
		bucket := buckets[index]
		entry := ServiceStatusBucket{
			Timestamp:    since + int64(index)*bucketSeconds,
			ProbeCount:   bucket.probeCount,
			SuccessCount: bucket.successCount,
			Status:       ServiceStatusGray,
		}
		if bucket.probeCount > 0 {
			entry.SuccessRate = float64(bucket.successCount) / float64(bucket.probeCount) * 100
			entry.ErrorRate = 100 - entry.SuccessRate
			entry.Status = ServiceStatusColorFor(bucket.successCount, bucket.probeCount)
		}
		entry.AvgLatency, entry.P50Latency, entry.P90Latency = summarizeLatencies(bucket.latencies)
		entry.FirstToken = averageInts(bucket.firstTokens)
		stats.Buckets = append(stats.Buckets, entry)
	}

	return stats
}

// ServiceStatusColorFor 依据成功比例给出状态色。
func ServiceStatusColorFor(successCount int, probeCount int) string {
	if probeCount == 0 {
		return ServiceStatusGray
	}
	if successCount == probeCount {
		return ServiceStatusGreen
	}
	if successCount == 0 {
		return ServiceStatusRed
	}
	return ServiceStatusYellow
}

// summarizeLatencies 返回平均值与 p50 / p90。空切片返回 0。
func summarizeLatencies(values []int) (int, int, int) {
	if len(values) == 0 {
		return 0, 0, 0
	}
	sorted := make([]int, len(values))
	copy(sorted, values)
	sort.Ints(sorted)

	total := 0
	for _, value := range sorted {
		total += value
	}
	average := total / len(sorted)

	return average, percentile(sorted, 0.5), percentile(sorted, 0.9)
}

// percentile 取已排序切片的百分位值。
func percentile(sorted []int, ratio float64) int {
	if len(sorted) == 0 {
		return 0
	}
	index := int(float64(len(sorted)-1) * ratio)
	if index < 0 {
		index = 0
	}
	if index >= len(sorted) {
		index = len(sorted) - 1
	}
	return sorted[index]
}

func averageInts(values []int) int {
	if len(values) == 0 {
		return 0
	}
	total := 0
	for _, value := range values {
		total += value
	}
	return total / len(values)
}

func minOrZero(values []int) int {
	if len(values) == 0 {
		return 0
	}
	best := values[0]
	for _, value := range values[1:] {
		if value < best {
			best = value
		}
	}
	return best
}

// ServiceStatusBucketSeconds picks the bucket width for a time window so the
// uptime bar stays readable. The width is never smaller than the probe
// interval: a 1-minute bucket with 5-minute probes would leave four of every
// five cells empty and make a healthy channel look like it has no data.
func ServiceStatusBucketSeconds(windowSeconds int64, probeIntervalSeconds int64) int64 {
	const targetBuckets = 72
	if windowSeconds <= 0 {
		return 300
	}
	if probeIntervalSeconds < 60 {
		probeIntervalSeconds = 60
	}
	seconds := windowSeconds / targetBuckets
	if seconds < probeIntervalSeconds {
		seconds = probeIntervalSeconds
	}
	// Round down to whole minutes so bucket edges stay aligned.
	return (seconds / 60) * 60
}

// ServiceStatusNow 返回当前 Unix 秒，便于测试替换。
func ServiceStatusNow() int64 {
	return time.Now().Unix()
}

// ServiceStatusSampleRetentionCutoff 返回保留期起点。
func ServiceStatusSampleRetentionCutoff(retentionDays int) int64 {
	if retentionDays < 1 {
		retentionDays = 1
	}
	return time.Now().AddDate(0, 0, -retentionDays).Unix()
}
