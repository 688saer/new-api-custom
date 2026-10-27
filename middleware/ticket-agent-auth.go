package middleware

import (
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// 工单后台使用一套独立账号与会话，和站点用户登录互不影响。
//
// 为了不让站点管理员被锁在门外，这里允许两种身份进入后台：
//  1. 工单后台自己的账号（Authorization: Bearer <staff token>）
//  2. 站点管理员会话（role >= ADMIN），以 owner 权限代管
//
// 第二种只作为兜底：日常客服仍用独立账号登录。

const (
	ticketAgentContextKey       = "ticket_agent"
	ticketAgentSourceContextKey = "ticket_agent_source"
	ticketAgentSourceStaff      = "staff"
	ticketAgentSourceSiteAdmin  = "site-admin"
)

// GetTicketAgent 取出当前工单后台操作者。
// 站点管理员代管时返回的是合成的 owner 账号（Id 为 0）。
func GetTicketAgent(c *gin.Context) (*model.TicketAgent, bool) {
	value, ok := c.Get(ticketAgentContextKey)
	if !ok {
		return nil, false
	}
	agent, ok := value.(*model.TicketAgent)
	return agent, ok && agent != nil
}

// IsTicketSiteAdminSession 当前是否站点管理员代管（不能改自己的后台密码）
func IsTicketSiteAdminSession(c *gin.Context) bool {
	return c.GetString(ticketAgentSourceContextKey) == ticketAgentSourceSiteAdmin
}

func ticketAgentAuthError(c *gin.Context, err error) {
	fields := gin.H{"code": "TICKET_AGENT_UNAUTHORIZED", "reason": err.Error()}
	var ticketErr *model.TicketError
	if errors.As(err, &ticketErr) {
		fields["code"] = ticketErr.Code
		fields["reason"] = ticketErr.Message
	}
	c.JSON(http.StatusUnauthorized, gin.H{
		"success": false,
		"message": err.Error(),
		"code":    fields["code"],
		"reason":  fields["reason"],
	})
	c.Abort()
}

func syntheticSiteAdminAgent() *model.TicketAgent {
	return &model.TicketAgent{
		Id:          0,
		Username:    "site-admin",
		DisplayName: operation_setting.TicketAgentName(),
		Role:        model.TicketAgentRoleOwner,
		Enabled:     true,
	}
}

// TicketAgentAuth 校验工单后台身份，permission 为空时只要求已登录
func TicketAgentAuth(permission string) func(c *gin.Context) {
	return func(c *gin.Context) {
		if token, ok := authorizationToken(c.GetHeader("Authorization")); ok {
			agent, err := model.AuthenticateTicketAgentToken(token)
			if err == nil {
				if permission != "" && !agent.HasPermission(permission) {
					common.ApiErrorStatus(c, http.StatusForbidden, errTicketPermission())
					c.Abort()
					return
				}
				c.Set(ticketAgentContextKey, agent)
				c.Set(ticketAgentSourceContextKey, ticketAgentSourceStaff)
				c.Next()
				return
			}
			// 不是有效的后台会话时继续尝试站点管理员会话，
			// 两者都用 Authorization 头，无法只靠格式区分。
		}

		user, _, _, err := authenticateDashboardRequest(c)
		if err != nil || user == nil {
			ticketAgentAuthError(c, errTicketUnauthorized())
			return
		}
		if user.Role < common.RoleAdminUser {
			ticketAgentAuthError(c, errTicketUnauthorized())
			return
		}
		agent := syntheticSiteAdminAgent()
		if permission != "" && !agent.HasPermission(permission) {
			common.ApiErrorStatus(c, http.StatusForbidden, errTicketPermission())
			c.Abort()
			return
		}
		c.Set(ticketAgentContextKey, agent)
		c.Set(ticketAgentSourceContextKey, ticketAgentSourceSiteAdmin)
		c.Next()
	}
}

func errTicketUnauthorized() error {
	return &model.TicketError{
		Code:    model.TicketCodeAgentSession,
		Message: "Sign in to the ticket console to continue",
	}
}

func errTicketPermission() error {
	return &model.TicketError{
		Code:    model.TicketCodeAgentPermission,
		Message: "You do not have permission for this action",
	}
}
