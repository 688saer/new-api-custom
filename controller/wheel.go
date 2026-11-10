package controller

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// 用户侧：幸运大转盘
// ---------------------------------------------------------------------------

// GetWheelStatus 获取大转盘状态（GET /api/user/wheel/status）
func GetWheelStatus(c *gin.Context) {
	userId := c.GetInt("id")
	status, err := model.GetWheelStatus(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, status)
}

// SpinWheel 执行一次大转盘抽奖（POST /api/user/wheel/spin）
func SpinWheel(c *gin.Context) {
	userId := c.GetInt("id")
	result, err := model.UserWheelSpin(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	prizeText := result.PrizeName
	if result.QuotaValue > 0 {
		prizeText = fmt.Sprintf("%s (%s)", result.PrizeName, logger.FormatQuota(result.QuotaValue))
	}
	model.RecordLog(userId, model.LogTypeSystem, common.NewMessage(
		"Lucky wheel: received {{prize}}",
		map[string]any{"prize": prizeText},
	))
	common.ApiSuccess(c, result)
}

// GetMyWheelWins 获取我的中奖记录（GET /api/user/wheel/records）
func GetMyWheelWins(c *gin.Context) {
	userId := c.GetInt("id")
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	items, total, err := model.ListMyWheelWins(userId, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      max(page, 1),
		"page_size": pageSize,
	})
}

// SubmitMyWheelWinAddress 填写实物奖品收货信息（PUT /api/user/wheel/records/:id/address）
func SubmitMyWheelWinAddress(c *gin.Context) {
	userId := c.GetInt("id")
	winId, err := strconv.Atoi(c.Param("id"))
	if err != nil || winId <= 0 {
		common.ApiErrorMsg(c, "Invalid record ID")
		return
	}
	var req struct {
		ReceiverName    string `json:"receiver_name"`
		ReceiverPhone   string `json:"receiver_phone"`
		ReceiverAddress string `json:"receiver_address"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	view, err := model.SubmitWheelWinAddress(userId, winId, req.ReceiverName, req.ReceiverPhone, req.ReceiverAddress)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, view)
}

// GetWheelPublicWins 获取公开中奖动态（GET /api/user/wheel/public-wins）
func GetWheelPublicWins(c *gin.Context) {
	wins, err := model.GetWheelPublicWins(0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": wins})
}

// ---------------------------------------------------------------------------
// 后台：奖品、库存、记录与概览
// ---------------------------------------------------------------------------

// AdminListWheelPrizes 列出全部奖品（GET /api/wheel/prizes）
func AdminListWheelPrizes(c *gin.Context) {
	prizes, err := model.ListWheelPrizes(true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": prizes})
}

// wheelPrizeRequest 后台提交的奖品字段
type wheelPrizeRequest struct {
	Name        string  `json:"name"`
	Icon        string  `json:"icon"`
	Type        string  `json:"type"`
	Label       string  `json:"label"`
	Description string  `json:"description"`
	Color       string  `json:"color"`
	Weight      float64 `json:"weight"`
	Stock       int     `json:"stock"`
	QuotaValue  int     `json:"quota_value"`
	PlanId      int     `json:"plan_id"`
	Enabled     bool    `json:"enabled"`
	SortOrder   int     `json:"sort_order"`
}

func (req *wheelPrizeRequest) toPrize() *model.WheelPrize {
	return &model.WheelPrize{
		Name:        req.Name,
		Icon:        req.Icon,
		Type:        req.Type,
		Label:       req.Label,
		Description: req.Description,
		Color:       req.Color,
		Weight:      req.Weight,
		Stock:       req.Stock,
		QuotaValue:  req.QuotaValue,
		PlanId:      req.PlanId,
		Enabled:     req.Enabled,
		SortOrder:   req.SortOrder,
	}
}

// AdminCreateWheelPrize 新建奖品（POST /api/wheel/prizes）
func AdminCreateWheelPrize(c *gin.Context) {
	var req wheelPrizeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	prize := req.toPrize()
	if err := model.CreateWheelPrize(prize); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, prize)
}

// AdminUpdateWheelPrize 更新奖品（PUT /api/wheel/prizes/:id）
func AdminUpdateWheelPrize(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid prize ID")
		return
	}
	var req wheelPrizeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	prize := req.toPrize()
	prize.Id = id
	if err := model.UpdateWheelPrize(prize); err != nil {
		common.ApiError(c, err)
		return
	}
	updated, err := model.GetWheelPrizeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, updated)
}

// AdminDeleteWheelPrize 删除奖品（DELETE /api/wheel/prizes/:id）
func AdminDeleteWheelPrize(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid prize ID")
		return
	}
	if err := model.DeleteWheelPrize(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminAdjustWheelPrizeStock 增减库存（POST /api/wheel/prizes/:id/stock）
func AdminAdjustWheelPrizeStock(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid prize ID")
		return
	}
	var req struct {
		Delta int `json:"delta"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	prize, err := model.AdjustWheelPrizeStock(id, req.Delta)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, prize)
}

// AdminListWheelPrizeCodes 查看卡密池（GET /api/wheel/prizes/:id/codes）
func AdminListWheelPrizeCodes(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid prize ID")
		return
	}
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	codes, total, err := model.ListWheelPrizeCodes(id, c.Query("status"), page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     codes,
		"total":     total,
		"page":      max(page, 1),
		"page_size": pageSize,
	})
}

// AdminAddWheelPrizeCodes 批量导入卡密（POST /api/wheel/prizes/:id/codes）
func AdminAddWheelPrizeCodes(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid prize ID")
		return
	}
	var req struct {
		Codes string `json:"codes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	lines := strings.FieldsFunc(req.Codes, func(r rune) bool {
		return r == '\n' || r == '\r' || r == ',' || r == ';'
	})
	if len(lines) == 0 {
		common.ApiErrorMsg(c, "Enter at least one card key")
		return
	}
	if len(lines) > 2000 {
		common.ApiErrorMsg(c, "Import at most 2000 card keys at a time")
		return
	}
	added, err := model.AddWheelPrizeCodes(id, lines)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"added": added})
}

// AdminDeleteWheelPrizeCode 删除未使用的卡密（DELETE /api/wheel/prizes/:id/codes/:codeId）
func AdminDeleteWheelPrizeCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid prize ID")
		return
	}
	codeId, err := strconv.Atoi(c.Param("codeId"))
	if err != nil || codeId <= 0 {
		common.ApiErrorMsg(c, "Invalid card key ID")
		return
	}
	if err := model.DeleteWheelPrizeCode(id, codeId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminListWheelWins 中奖记录（GET /api/wheel/records）
func AdminListWheelWins(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	prizeId, _ := strconv.Atoi(c.Query("prize_id"))
	items, total, err := model.ListWheelWins(model.WheelWinQuery{
		Keyword:   strings.TrimSpace(c.Query("keyword")),
		Status:    c.Query("status"),
		PrizeId:   prizeId,
		PrizeType: c.Query("prize_type"),
		Page:      page,
		PageSize:  pageSize,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"items":     items,
		"total":     total,
		"page":      max(page, 1),
		"page_size": pageSize,
	})
}

// AdminShipWheelWin 标记实物奖品已发货（POST /api/wheel/records/:id/ship）
func AdminShipWheelWin(c *gin.Context) {
	winId, err := strconv.Atoi(c.Param("id"))
	if err != nil || winId <= 0 {
		common.ApiErrorMsg(c, "Invalid record ID")
		return
	}
	var req struct {
		TrackingNo string `json:"tracking_no"`
		Note       string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	if err := model.ShipWheelWin(winId, req.TrackingNo, req.Note); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminDeliverWheelWin 手动标记已发放（POST /api/wheel/records/:id/deliver）
func AdminDeliverWheelWin(c *gin.Context) {
	winId, err := strconv.Atoi(c.Param("id"))
	if err != nil || winId <= 0 {
		common.ApiErrorMsg(c, "Invalid record ID")
		return
	}
	var req struct {
		Note string `json:"note"`
		Code string `json:"code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	if err := model.DeliverWheelWin(winId, req.Note, req.Code); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminCancelWheelWin 作废中奖记录（POST /api/wheel/records/:id/cancel）
func AdminCancelWheelWin(c *gin.Context) {
	winId, err := strconv.Atoi(c.Param("id"))
	if err != nil || winId <= 0 {
		common.ApiErrorMsg(c, "Invalid record ID")
		return
	}
	var req struct {
		Note string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	if err := model.CancelWheelWin(winId, req.Note); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminGetWheelOverview 后台概览（GET /api/wheel/overview）
func AdminGetWheelOverview(c *gin.Context) {
	overview, err := model.GetWheelOverview()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, overview)
}

// AdminGetWheelSetting 读取活动规则配置（GET /api/wheel/setting）
func AdminGetWheelSetting(c *gin.Context) {
	common.ApiSuccess(c, operation_setting.GetWheelSetting())
}

// AdminUpdateWheelSetting 保存活动规则配置（PUT /api/wheel/setting）
func AdminUpdateWheelSetting(c *gin.Context) {
	var req operation_setting.WheelSetting
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	if req.DailyFreeDraws < 0 || req.DailyFreeDraws > 100 {
		common.ApiErrorMsg(c, "Free daily draws must be between 0 and 100")
		return
	}
	if req.DailyDrawLimit < 0 || req.DailyDrawLimit > 1000 {
		common.ApiErrorMsg(c, "Daily draw limit must be between 0 and 1000")
		return
	}
	if req.SingleCostQuota < 0 {
		common.ApiErrorMsg(c, "Draw cost cannot be negative")
		return
	}
	if req.SingleCostQuota > 0 {
		if err := common.ValidateWalletQuota(req.SingleCostQuota); err != nil {
			common.ApiError(c, err)
			return
		}
	}
	if req.PublicWinsLimit < 0 || req.PublicWinsLimit > 50 {
		common.ApiErrorMsg(c, "Public win feed length must be between 0 and 50")
		return
	}
	if req.RedemptionExpireDays < 0 || req.RedemptionExpireDays > 3650 {
		common.ApiErrorMsg(c, "Redemption code validity must be between 0 and 3650 days")
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Subtitle = strings.TrimSpace(req.Subtitle)
	req.RulesText = strings.TrimSpace(req.RulesText)
	if len([]rune(req.Title)) > 64 || len([]rune(req.Subtitle)) > 128 {
		common.ApiErrorMsg(c, "Title or subtitle is too long")
		return
	}
	if len([]rune(req.RulesText)) > 2000 {
		common.ApiErrorMsg(c, "Rules text must be at most 2000 characters")
		return
	}

	mapped, err := config.ConfigToMap(&req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	values := make(map[string]string, len(mapped))
	for key, value := range mapped {
		values["wheel_setting."+key] = value
	}
	if err := model.UpdateOptionsBulk(values); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, operation_setting.GetWheelSetting())
}
