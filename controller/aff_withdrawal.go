package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetMyAffWithdrawals 当前用户的提现记录（GET /api/user/aff/withdrawals）
func GetMyAffWithdrawals(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))

	result, err := model.ListAffWithdrawalsForUser(c.GetInt("id"), page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

// CreateMyAffWithdrawal 提交支付宝提现申请（POST /api/user/aff/withdrawals）
func CreateMyAffWithdrawal(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	var req struct {
		Quota   int    `json:"quota"`
		Account string `json:"account"`
		Name    string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	withdrawal, err := model.CreateAffWithdrawal(model.CreateAffWithdrawalParams{
		UserId:   c.GetInt("id"),
		Username: currentUsername(c),
		Quota:    req.Quota,
		Account:  req.Account,
		Name:     req.Name,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, withdrawal)
}

// ListAffWithdrawalsAdmin 后台提现列表（GET /api/aff_withdrawals/）
func ListAffWithdrawalsAdmin(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))

	result, err := model.ListAffWithdrawals(model.AffWithdrawalFilter{
		Status:   c.Query("status"),
		Keyword:  c.Query("keyword"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

// ReviewAffWithdrawalAdmin 审核提现（PUT /api/aff_withdrawals/:id）
func ReviewAffWithdrawalAdmin(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	var req struct {
		Approve   bool   `json:"approve"`
		AdminNote string `json:"admin_note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	withdrawal, err := model.ReviewAffWithdrawal(id, req.Approve, req.AdminNote, currentUsername(c))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, withdrawal)
}
