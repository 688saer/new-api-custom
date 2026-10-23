package service

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// GeeTest validates a solved challenge against the V4 validation endpoint.
const geetestValidateEndpoint = "https://gcaptcha4.geetest.com/validate"

// GeeTestPayload is what the browser hands back after a challenge is solved.
type GeeTestPayload struct {
	LotNumber     string `json:"lot_number"`
	CaptchaOutput string `json:"captcha_output"`
	PassToken     string `json:"pass_token"`
	GenTime       string `json:"gen_time"`
}

// geetestValidateResponse is the V4 answer. A solved challenge reports
// result "success"; anything else carries a reason in the operator's logs.
type geetestValidateResponse struct {
	Status string `json:"status"`
	Result string `json:"result"`
	Reason string `json:"reason"`
}

// GeeTest is on the critical path of every guarded request, so it must never
// hang: a slow GeeTest outage should fail the check, not the whole site.
var geetestHTTPClient = &http.Client{Timeout: 10 * time.Second}

// signGeeTestLotNumber builds the sign_token the V4 API expects: an
// HMAC-SHA256 of the lot number keyed with the captcha key.
func signGeeTestLotNumber(lotNumber, captchaKey string) string {
	mac := hmac.New(sha256.New, []byte(captchaKey))
	mac.Write([]byte(lotNumber))
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyGeeTest redeems a solved challenge with GeeTest. Each payload is
// single-use, so a failed request consumes it and the browser must solve a
// fresh one before retrying.
func VerifyGeeTest(payload GeeTestPayload) error {
	setting := system_setting.GetGeeTestSetting()
	if !setting.IsConfigured() {
		return errors.New("geetest is not configured")
	}
	if payload.LotNumber == "" || payload.CaptchaOutput == "" ||
		payload.PassToken == "" || payload.GenTime == "" {
		return errors.New("the challenge result is incomplete")
	}

	form := url.Values{
		"lot_number":     {payload.LotNumber},
		"captcha_output": {payload.CaptchaOutput},
		"pass_token":     {payload.PassToken},
		"gen_time":       {payload.GenTime},
		"sign_token":     {signGeeTestLotNumber(payload.LotNumber, setting.CaptchaKey)},
	}
	endpoint := fmt.Sprintf(
		"%s?captcha_id=%s",
		geetestValidateEndpoint,
		url.QueryEscape(setting.CaptchaId),
	)

	response, err := geetestHTTPClient.PostForm(endpoint, form)
	if err != nil {
		return fmt.Errorf("could not reach the verification service: %w", err)
	}
	defer response.Body.Close()

	var result geetestValidateResponse
	if err := common.DecodeJson(response.Body, &result); err != nil {
		return fmt.Errorf("unexpected verification response: %w", err)
	}
	if result.Result != "success" {
		reason := result.Reason
		if reason == "" {
			reason = "rejected"
		}
		return fmt.Errorf("verification rejected (%s)", reason)
	}
	return nil
}
