package controller

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// welfareErrorFields 把带错误码的错误转成响应字段，供前端区分失败原因
func welfareErrorFields(err error) gin.H {
	var we *model.WelfareChestError
	if errors.As(err, &we) {
		return gin.H{"code": we.Code, "reason": we.Message}
	}
	return gin.H{}
}

// GetWelfareChestsStatus 获取福利宝箱状态（GET /api/user/welfare-chests/status）
func GetWelfareChestsStatus(c *gin.Context) {
	userId := c.GetInt("id")
	status, err := model.GetWelfareChestStatus(userId)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, welfareErrorFields(err))
		return
	}
	common.ApiSuccess(c, status)
}

// OpenWelfareChest 开启福利宝箱（POST /api/user/welfare-chests/open  body: {"chest":"xiaoshuai_ge"}）
func OpenWelfareChest(c *gin.Context) {
	userId := c.GetInt("id")

	var req struct {
		Chest string `json:"chest"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorT(c, "Invalid welfare chest")
		return
	}

	result, err := model.UserOpenWelfareChest(userId, req.Chest)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, welfareErrorFields(err))
		return
	}

	model.RecordLog(userId, model.LogTypeSystem, common.NewMessage(
		"Welfare chest reward, received {{quota}}",
		map[string]any{"quota": logger.FormatQuota(result.RewardQuota)},
	))

	common.ApiSuccess(c, result)
}

// GetWelfareChestsRanking 获取本周宝箱奖励榜（GET /api/user/welfare-chests/ranking）
func GetWelfareChestsRanking(c *gin.Context) {
	userId := c.GetInt("id")
	boards, err := model.GetWelfareChestRanking(userId, 10)
	if err != nil {
		common.ApiErrorStatus(c, 200, err, welfareErrorFields(err))
		return
	}
	common.ApiSuccess(c, boards)
}
