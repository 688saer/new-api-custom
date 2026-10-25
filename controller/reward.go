package controller

import (
	"errors"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// rewardErrorFields 把带错误码的错误转成响应字段，供前端区分失败原因
func rewardErrorFields(err error) gin.H {
	var rewardErr *model.RewardError
	if errors.As(err, &rewardErr) {
		return gin.H{"code": rewardErr.Code, "reason": rewardErr.Message}
	}
	return gin.H{}
}

// GetMyRewardsPending 获取待领取奖励（GET /api/user/rewards/pending）
func GetMyRewardsPending(c *gin.Context) {
	userId := c.GetInt("id")
	result, err := model.GetUserPendingRewards(userId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, rewardErrorFields(err))
		return
	}
	common.ApiSuccess(c, result)
}

// GetMyRewardsHistory 获取领取记录（GET /api/user/rewards/history?page=&page_size=）
func GetMyRewardsHistory(c *gin.Context) {
	userId := c.GetInt("id")
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))

	result, err := model.GetUserRewardHistory(userId, page, pageSize)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, rewardErrorFields(err))
		return
	}
	common.ApiSuccess(c, result)
}

// ClaimMyReward 领取一条奖励（POST /api/user/rewards/:id/claim）
func ClaimMyReward(c *gin.Context) {
	userId := c.GetInt("id")
	grantId, err := strconv.Atoi(c.Param("id"))
	if err != nil || grantId <= 0 {
		common.ApiErrorT(c, "Invalid reward")
		return
	}

	result, err := model.ClaimRewardGrant(userId, grantId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, rewardErrorFields(err))
		return
	}

	if !result.AlreadyClaimed && result.AmountQuota > 0 {
		model.RecordLog(userId, model.LogTypeSystem, common.NewMessage(
			"Reward claimed, received {{quota}}",
			map[string]any{"quota": logger.FormatQuota(result.AmountQuota)},
		))
	}

	common.ApiSuccess(c, result)
}

// PreviewRewardCampaign 预览发放名单（POST /api/user/rewards/campaigns/preview）
func PreviewRewardCampaign(c *gin.Context) {
	var draft model.RewardCampaignDraft
	if err := c.ShouldBindJSON(&draft); err != nil {
		common.ApiErrorT(c, "Invalid reward campaign")
		return
	}

	preview, err := model.PreviewRewardCampaign(draft)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, rewardErrorFields(err))
		return
	}
	common.ApiSuccess(c, preview)
}

// IssueRewardCampaign 发放奖励（POST /api/user/rewards/campaigns）
func IssueRewardCampaign(c *gin.Context) {
	adminId := c.GetInt("id")

	var draft model.RewardCampaignDraft
	if err := c.ShouldBindJSON(&draft); err != nil {
		common.ApiErrorT(c, "Invalid reward campaign")
		return
	}

	summary, err := model.IssueRewardCampaign(draft, adminId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, rewardErrorFields(err))
		return
	}
	common.ApiSuccess(c, summary)
}

// ListRewardCampaigns 发放记录（GET /api/user/rewards/campaigns?page=&page_size=）
func ListRewardCampaigns(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))

	result, err := model.ListRewardCampaigns(page, pageSize)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, rewardErrorFields(err))
		return
	}
	common.ApiSuccess(c, result)
}

// ListRewardCampaignGrants 某次发放的领取明细（GET /api/user/rewards/campaigns/:id/grants）
func ListRewardCampaignGrants(c *gin.Context) {
	campaignId, err := strconv.Atoi(c.Param("id"))
	if err != nil || campaignId <= 0 {
		common.ApiErrorT(c, "Invalid reward campaign")
		return
	}
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))

	result, err := model.ListRewardGrants(campaignId, page, pageSize)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, rewardErrorFields(err))
		return
	}
	common.ApiSuccess(c, result)
}

// RevokeRewardCampaign 撤回未领取奖励（POST /api/user/rewards/campaigns/:id/revoke）
func RevokeRewardCampaign(c *gin.Context) {
	campaignId, err := strconv.Atoi(c.Param("id"))
	if err != nil || campaignId <= 0 {
		common.ApiErrorT(c, "Invalid reward campaign")
		return
	}

	summary, err := model.RevokeRewardCampaign(campaignId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, rewardErrorFields(err))
		return
	}
	common.ApiSuccess(c, summary)
}

// SearchRewardUsers 搜索可选发放对象（GET /api/user/rewards/users?keyword=）
func SearchRewardUsers(c *gin.Context) {
	limit, _ := strconv.Atoi(c.Query("limit"))
	users, err := model.SearchRewardUsers(c.Query("keyword"), limit)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, rewardErrorFields(err))
		return
	}
	common.ApiSuccess(c, gin.H{"items": users})
}
