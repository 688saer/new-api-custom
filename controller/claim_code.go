package controller

import (
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// 用户侧：输入口令兑换奖品
// ---------------------------------------------------------------------------

// RedeemClaimCode 用户输入口令领取奖品（POST /api/user/claim-codes/redeem）
func RedeemClaimCode(c *gin.Context) {
	userId := c.GetInt("id")
	var req struct {
		Code string `json:"code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}

	claim, err := model.RedeemClaimCode(userId, req.Code)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	prizeText := claim.Name
	if claim.Quota > 0 {
		prizeText = claim.Name + " (" + logger.FormatQuota(claim.Quota) + ")"
	}
	model.RecordLog(userId, model.LogTypeSystem, common.NewMessage(
		"Claimed {{prize}} with a claim code",
		map[string]any{"prize": prizeText},
	))
	common.ApiSuccess(c, claim)
}

// GetMyClaimCodeClaims 我的领取记录（GET /api/user/claim-codes/records）
func GetMyClaimCodeClaims(c *gin.Context) {
	userId := c.GetInt("id")
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	items, total, err := model.ListMyClaimCodeClaims(userId, page, pageSize)
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

// SubmitMyClaimCodeAddress 填写实物收货信息（PUT /api/user/claim-codes/records/:id/address）
func SubmitMyClaimCodeAddress(c *gin.Context) {
	userId := c.GetInt("id")
	claimId, err := strconv.Atoi(c.Param("id"))
	if err != nil || claimId <= 0 {
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
	view, err := model.SubmitClaimCodeAddress(userId, claimId, req.ReceiverName, req.ReceiverPhone, req.ReceiverAddress)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, view)
}

// ---------------------------------------------------------------------------
// 后台：口令管理、卡密池与领取记录
// ---------------------------------------------------------------------------

// claimCodeRequest 后台提交的口令字段
type claimCodeRequest struct {
	Name         string `json:"name"`
	Type         string `json:"type"`
	Quota        int    `json:"quota"`
	PlanId       int    `json:"plan_id"`
	Description  string `json:"description"`
	TotalCount   int    `json:"total_count"`
	PerUserLimit int    `json:"per_user_limit"`
	GroupLimit   string `json:"group_limit"`
	ExpiredTime  int64  `json:"expired_time"`
	Status       int    `json:"status"`
	Count        int    `json:"count"`
}

// toClaimCode 把请求转成口令模型
func (req claimCodeRequest) toClaimCode(adminId int) model.ClaimCode {
	return model.ClaimCode{
		Name:         req.Name,
		Type:         req.Type,
		Quota:        req.Quota,
		PlanId:       req.PlanId,
		Description:  req.Description,
		TotalCount:   req.TotalCount,
		PerUserLimit: req.PerUserLimit,
		GroupLimit:   req.GroupLimit,
		ExpiredTime:  req.ExpiredTime,
		Status:       req.Status,
		CreatedBy:    adminId,
	}
}

// AdminListClaimCodes 口令列表（GET /api/claim-codes）
func AdminListClaimCodes(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	status, _ := strconv.Atoi(c.Query("status"))
	items, total, err := model.ListClaimCodes(model.ClaimCodeFilter{
		Keyword:  c.Query("keyword"),
		Type:     c.Query("type"),
		Status:   status,
		Page:     page,
		PageSize: pageSize,
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

// AdminGetClaimCodeOverview 口令概览（GET /api/claim-codes/overview）
func AdminGetClaimCodeOverview(c *gin.Context) {
	overview, err := model.GetClaimCodeOverview()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, overview)
}

// AdminGetClaimCodeOptions 口令可配置的用户分组（GET /api/claim-codes/groups）
func AdminGetClaimCodeOptions(c *gin.Context) {
	groups := make([]string, 0, 8)
	for group := range ratio_setting.GetGroupRatioCopy() {
		groups = append(groups, group)
	}
	sort.Strings(groups)
	common.ApiSuccess(c, gin.H{"groups": groups})
}

// AdminCreateClaimCodes 生成口令（POST /api/claim-codes）
func AdminCreateClaimCodes(c *gin.Context) {
	var req claimCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	count := req.Count
	if count <= 0 {
		count = 1
	}
	codes, err := model.CreateClaimCodes(req.toClaimCode(c.GetInt("id")), count)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"items": codes, "count": len(codes)})
}

// AdminUpdateClaimCode 修改口令（PUT /api/claim-codes/:id）
func AdminUpdateClaimCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid claim code ID")
		return
	}
	var req claimCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	code, err := model.UpdateClaimCode(id, req.toClaimCode(0))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, code)
}

// AdminDeleteClaimCode 删除或停用口令（DELETE /api/claim-codes/:id）
func AdminDeleteClaimCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid claim code ID")
		return
	}
	if err := model.DeleteClaimCode(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminListClaimCodeCards 卡密池列表（GET /api/claim-codes/:id/cards）
func AdminListClaimCodeCards(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid claim code ID")
		return
	}
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	items, total, err := model.ListClaimCodeCards(id, c.Query("status"), page, pageSize)
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

// AdminAddClaimCodeCards 导入卡密（POST /api/claim-codes/:id/cards）
func AdminAddClaimCodeCards(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid claim code ID")
		return
	}
	var req struct {
		Codes string `json:"codes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	added, err := model.AddClaimCodeCards(id, req.Codes)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"added": added})
}

// AdminDeleteClaimCodeCard 删除未使用的卡密（DELETE /api/claim-codes/:id/cards/:cardId）
func AdminDeleteClaimCodeCard(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid claim code ID")
		return
	}
	cardId, err := strconv.Atoi(c.Param("cardId"))
	if err != nil || cardId <= 0 {
		common.ApiErrorMsg(c, "Invalid card key ID")
		return
	}
	if err := model.DeleteClaimCodeCard(id, cardId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminListClaimCodeClaims 领取记录（GET /api/claim-codes/claims）
func AdminListClaimCodeClaims(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	claimCodeId, _ := strconv.Atoi(c.Query("claim_code_id"))
	items, total, err := model.ListClaimCodeClaims(model.ClaimCodeClaimFilter{
		Keyword:     c.Query("keyword"),
		Type:        c.Query("type"),
		Status:      c.Query("status"),
		ClaimCodeId: claimCodeId,
		Page:        page,
		PageSize:    pageSize,
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

// claimCodeClaimActionRequest 领取记录操作参数
type claimCodeClaimActionRequest struct {
	TrackingNo string `json:"tracking_no"`
	Note       string `json:"note"`
}

// AdminShipClaimCodeClaim 发货并登记运单号（POST /api/claim-codes/claims/:id/ship）
func AdminShipClaimCodeClaim(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid record ID")
		return
	}
	var req claimCodeClaimActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	if err := model.ShipClaimCodeClaim(id, req.TrackingNo, req.Note); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminDeliverClaimCodeClaim 标记为已发放（POST /api/claim-codes/claims/:id/deliver）
func AdminDeliverClaimCodeClaim(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid record ID")
		return
	}
	var req claimCodeClaimActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	if err := model.DeliverClaimCodeClaim(id, strings.TrimSpace(req.Note)); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminCancelClaimCodeClaim 作废领取记录（POST /api/claim-codes/claims/:id/cancel）
func AdminCancelClaimCodeClaim(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "Invalid record ID")
		return
	}
	var req claimCodeClaimActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid parameters")
		return
	}
	if err := model.CancelClaimCodeClaim(id, req.Note); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
