/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type topUpInfoResponse struct {
	Success bool `json:"success"`
	Data    struct {
		EnableOnlineTopup bool                     `json:"enable_online_topup"`
		EnableAlipayTopup bool                     `json:"enable_alipay_topup"`
		AlipayProduct     string                   `json:"alipay_product"`
		PayMethods        []map[string]interface{} `json:"pay_methods"`
	} `json:"data"`
}

// TestGetTopUpInfoExposesOfficialAlipayBesideEpay pins the contract that broke
// once: with the aggregator (epay) and the official Alipay channel enabled at
// the same time, the wallet must still receive an `alipay_official` method.
// Otherwise the console only offers the aggregator button and users can never
// reach the official checkout.
func TestGetTopUpInfoExposesOfficialAlipayBesideEpay(t *testing.T) {
	gin.SetMode(gin.TestMode)

	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousMain, previousLog := common.MainDatabaseType(), common.LogDatabaseType()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, i18n.Init())
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Option{}, &model.Log{}))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)

	previousPayMethods := operation_setting.PayMethods
	operation_setting.PayMethods = []map[string]string{
		{"name": "支付宝", "type": "alipay"},
		{"name": "微信", "type": "wxpay"},
	}
	paymentSetting := operation_setting.GetPaymentSetting()
	previousConfirmed := paymentSetting.ComplianceConfirmed
	previousVersion := paymentSetting.ComplianceTermsVersion
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	previousEnabled := setting.AlipayEnabled
	previousAppId, previousPrivateKey, previousPublicKey := setting.AlipayAppId, setting.AlipayPrivateKey, setting.AlipayPublicKey
	previousProduct := setting.AlipayProductType
	setting.AlipayEnabled = true
	setting.AlipayAppId = "2021000000000000"
	setting.AlipayPrivateKey = "test-private-key"
	setting.AlipayPublicKey = "test-public-key"
	setting.AlipayProductType = service.AlipayProductQr

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetDatabaseTypes(previousMain, previousLog)
		operation_setting.PayMethods = previousPayMethods
		paymentSetting.ComplianceConfirmed = previousConfirmed
		paymentSetting.ComplianceTermsVersion = previousVersion
		setting.AlipayEnabled = previousEnabled
		setting.AlipayAppId = previousAppId
		setting.AlipayPrivateKey = previousPrivateKey
		setting.AlipayPublicKey = previousPublicKey
		setting.AlipayProductType = previousProduct
	})

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/user/topup/info", nil)
	context.Set("id", 1)

	GetTopUpInfo(context)

	var body topUpInfoResponse
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	require.True(t, body.Success)
	assert.True(t, body.Data.EnableAlipayTopup)
	assert.Equal(t, "qr", body.Data.AlipayProduct)

	var official bool
	var aggregator bool
	for _, method := range body.Data.PayMethods {
		switch method["type"] {
		case model.PaymentMethodAlipayOfficial:
			official = true
		case model.PaymentProviderAlipay:
			aggregator = true
		}
	}

	assert.True(t, aggregator, "易支付渠道仍应保留")
	assert.True(t, official, "官方支付宝渠道必须出现在充值方式里")
}
