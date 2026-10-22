package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetLotteryStatus 获取抽奖状态（GET /api/user/lottery/status）
func GetLotteryStatus(c *gin.Context) {
	userId := c.GetInt("id")
	status, err := model.GetLotteryStatus(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, status)
}

// DoLotteryDraw 执行抽奖（POST /api/user/lottery/draw  body: {"mode":"single"|"multi"}）
func DoLotteryDraw(c *gin.Context) {
	userId := c.GetInt("id")

	var req struct {
		Mode string `json:"mode"`
	}
	// 允许空 body，默认单抽
	_ = c.ShouldBindJSON(&req)
	if req.Mode == "" {
		req.Mode = "single"
	}

	result, err := model.UserLotteryDraw(userId, req.Mode)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if result.TotalPrize > 0 {
		model.RecordLog(userId, model.LogTypeSystem, common.NewMessage(
			"Lucky draw reward, received {{quota}}",
			map[string]any{"quota": logger.FormatQuota(result.TotalPrize)},
		))
	} else if result.CostQuota > 0 {
		model.RecordLog(userId, model.LogTypeSystem, common.NewMessage(
			"Lucky draw consumed {{quota}}",
			map[string]any{"quota": logger.FormatQuota(result.CostQuota)},
		))
	}

	common.ApiSuccess(c, result)
}

// GetLotteryRanking 获取今日抽奖排行榜（GET /api/user/lottery/ranking）
func GetLotteryRanking(c *gin.Context) {
	userId := c.GetInt("id")
	board, err := model.GetLotteryTodayRanking(userId, 10)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, board)
}

// GetLotteryPublicWins 获取公开中奖记录（GET /api/user/lottery/public-wins）
func GetLotteryPublicWins(c *gin.Context) {
	userId := c.GetInt("id")
	wins, err := model.GetLotteryPublicWins(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": wins})
}
