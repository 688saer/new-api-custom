package controller

import (
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// WelfareApiItem 公开展示的福利 API 条目
type WelfareApiItem struct {
	Id          string `json:"id"`
	Name        string `json:"name"`
	Provider    string `json:"provider"`
	Description string `json:"description"`
	BaseUrl     string `json:"base_url"`
	Model       string `json:"model"`
	ApiKey      string `json:"api_key"`
	DocsUrl     string `json:"docs_url"`
	Badge       string `json:"badge"`
}

// WelfareApiPayload 福利 API 页数据
type WelfareApiPayload struct {
	Enabled      bool             `json:"enabled"`
	Title        string           `json:"title"`
	Subtitle     string           `json:"subtitle"`
	Notice       string           `json:"notice"`
	RequireLogin bool             `json:"require_login"`
	Code         string           `json:"code,omitempty"`
	Reason       string           `json:"reason,omitempty"`
	Apis         []WelfareApiItem `json:"apis"`
}

// GetWelfareApis 公开福利 API 列表（GET /api/welfare-apis）
// 匿名可访问；当 require_login 打开时，未登录只返回登录提示而不下发条目。
func GetWelfareApis(c *gin.Context) {
	setting := operation_setting.GetWelfareApiSetting()

	payload := WelfareApiPayload{
		Enabled:      setting.Enabled,
		Title:        setting.Title,
		Subtitle:     setting.Subtitle,
		Notice:       setting.Notice,
		RequireLogin: setting.RequireLogin,
		Apis:         []WelfareApiItem{},
	}

	if !setting.Enabled {
		payload.Code = "NOT_ENABLED"
		payload.Reason = "Welfare API is not enabled"
		common.ApiSuccess(c, payload)
		return
	}

	if setting.RequireLogin && c.GetInt("id") == 0 {
		payload.Code = "LOGIN_REQUIRED"
		payload.Reason = "Sign in to view the welfare APIs"
		common.ApiSuccess(c, payload)
		return
	}

	entries := make([]operation_setting.WelfareApiEntry, 0, len(setting.Apis))
	for _, entry := range setting.Apis {
		if !entry.Enabled {
			continue
		}
		entries = append(entries, entry)
	}

	// 先按 sort 升序，再按名称兜底，保证展示顺序稳定
	sort.SliceStable(entries, func(i, j int) bool {
		if entries[i].Sort != entries[j].Sort {
			return entries[i].Sort < entries[j].Sort
		}
		return strings.Compare(entries[i].Name, entries[j].Name) < 0
	})

	for _, entry := range entries {
		payload.Apis = append(payload.Apis, WelfareApiItem{
			Id:          entry.Id,
			Name:        entry.Name,
			Provider:    entry.Provider,
			Description: entry.Description,
			BaseUrl:     entry.BaseUrl,
			Model:       entry.Model,
			ApiKey:      entry.ApiKey,
			DocsUrl:     entry.DocsUrl,
			Badge:       entry.Badge,
		})
	}

	common.ApiSuccess(c, payload)
}
