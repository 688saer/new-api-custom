package middleware

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// GeeTestCheck guards one action with a GeeTest V4 challenge.
//
// The solved challenge travels in the `geetest` query parameter as the JSON
// object the browser received, mirroring how the Turnstile check passes its
// token, so both providers can guard the same route.
func GeeTestCheck(action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !system_setting.GetGeeTestSetting().ShouldVerify(action) {
			c.Next()
			return
		}

		raw := c.Query("geetest")
		if raw == "" {
			common.ApiErrorT(c, "Complete the human verification first")
			c.Abort()
			return
		}

		var payload service.GeeTestPayload
		if err := common.UnmarshalJsonStr(raw, &payload); err != nil {
			common.ApiErrorT(c, "The human verification result could not be read")
			c.Abort()
			return
		}

		if err := service.VerifyGeeTest(payload); err != nil {
			// The reason stays in the server log: it can name the upstream
			// rejection and must not be echoed to the caller.
			common.SysLog("geetest verification failed: " + err.Error())
			common.ApiErrorT(c, "Human verification failed, please try again")
			c.Abort()
			return
		}

		c.Next()
	}
}
