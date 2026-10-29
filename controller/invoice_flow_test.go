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
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupInvoiceTestDB 与其它 controller 测试一致：默认 SQLite，
// 通过 TEST_MYSQL_DSN / TEST_POSTGRES_DSN 可在真实 MySQL / PostgreSQL 上重跑。
func setupInvoiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	previousDB, previousLogDB := model.DB, model.LOG_DB
	dialect := os.Getenv("TEST_INVOICE_DIALECT")
	if dialect == "" {
		dialect = "sqlite"
	}
	dsn := os.Getenv("TEST_" + strings.ToUpper(dialect) + "_DSN")
	db, _ := newAuditTestDatabase(t, dialect, dsn)
	model.DB, model.LOG_DB = db, db

	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	require.NoError(t, db.AutoMigrate(&model.Invoice{}, &model.PurchaseAgreementSignature{}))
	return db
}

func newInvoiceTestContext(t *testing.T, userId int, body string) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("POST", "/", strings.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", userId)
	ctx.Set("username", "invoice-tester")
	return ctx, recorder
}

// 申请 → 审核 → 开具 → 下载 的完整链路，以及驳回必须带原因。
func TestInvoiceRequestLifecycle(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupInvoiceTestDB(t)
	t.Setenv("INVOICE_FILE_DIR", t.TempDir())

	create := func(body string) *httptest.ResponseRecorder {
		ctx, recorder := newInvoiceTestContext(t, 7, body)
		CreateMyInvoice(ctx)
		return recorder
	}

	invalid := create(`{"title_type":"company","title_name":"测试公司","email":"fin@example.com","amount":10}`)
	assert.Contains(t, invalid.Body.String(), model.InvoiceCodeInvalidTaxId)

	created := create(`{"title_type":"company","title_name":"测试公司","tax_id":"91310000MA1K35Q12X","email":"fin@example.com","amount":88.5,"content":"技术服务费"}`)
	require.Contains(t, created.Body.String(), `"success":true`)

	var invoice model.Invoice
	require.NoError(t, model.DB.Order("id desc").First(&invoice).Error)
	assert.Equal(t, model.InvoiceStatusPending, invoice.Status)
	assert.Equal(t, int64(8850), invoice.AmountCents)
	assert.Equal(t, 7, invoice.UserId)

	reviewed, err := model.ReviewInvoice(invoice.Id, true, "", 1, "admin")
	require.NoError(t, err)
	assert.Equal(t, model.InvoiceStatusApproved, reviewed.Status)

	_, err = model.IssueInvoice(invoice.Id, "INV-2026-0001", "invoice.pdf",
		[]byte("not a pdf"), 1, "admin")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "PDF")

	pdf := append([]byte("%PDF-1.4\n"), []byte("fake invoice body")...)
	issued, err := model.IssueInvoice(invoice.Id, "INV-2026-0001", "invoice.pdf", pdf, 1, "admin")
	require.NoError(t, err)
	assert.Equal(t, model.InvoiceStatusIssued, issued.Status)
	assert.Equal(t, "INV-2026-0001", issued.InvoiceNo)

	file, err := model.OpenInvoiceFile(issued)
	require.NoError(t, err)
	stored, err := os.ReadFile(file.Name())
	require.NoError(t, err)
	_ = file.Close()
	assert.Equal(t, pdf, stored)

	// 驳回路径：原因必填，驳回后不再允许开具
	rejectedCtx, rejectedRecorder := newInvoiceTestContext(t, 7,
		`{"title_type":"personal","title_name":"张三","email":"a@b.com","amount":20}`)
	CreateMyInvoice(rejectedCtx)
	require.Contains(t, rejectedRecorder.Body.String(), `"success":true`)

	var personal model.Invoice
	require.NoError(t, model.DB.Order("id desc").First(&personal).Error)

	_, err = model.ReviewInvoice(personal.Id, false, "   ", 1, "admin")
	require.Error(t, err)

	rejected, err := model.ReviewInvoice(personal.Id, false, "抬头与付款主体不一致", 1, "admin")
	require.NoError(t, err)
	assert.Equal(t, model.InvoiceStatusRejected, rejected.Status)
	assert.Equal(t, "抬头与付款主体不一致", rejected.RejectReason)

	_, err = model.IssueInvoice(personal.Id, "INV-2026-0002", "invoice.pdf", pdf, 1, "admin")
	require.Error(t, err)
}

// 购买协议：未签署时 confirm 拒绝购买，签署后放行，重复签署不产生第二条记录。
func TestPurchaseAgreementGateRequiresSignature(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupInvoiceTestDB(t)

	setting := operation_setting.GetPurchaseAgreementSetting()
	previousEnabled := setting.Enabled
	previousVersion := setting.Version
	setting.Enabled = true
	setting.Version = "1.0"
	setting.RequireForTopup = true
	t.Cleanup(func() {
		setting.Enabled = previousEnabled
		setting.Version = previousVersion
	})

	blockedCtx, blockedRecorder := newInvoiceTestContext(t, 42, `{"scene":"topup"}`)
	ConfirmPurchaseAgreement(blockedCtx)
	assert.Contains(t, blockedRecorder.Body.String(), "AGREEMENT_REQUIRED")

	signCtx, signRecorder := newInvoiceTestContext(t, 42, `{"scene":"topup"}`)
	SignPurchaseAgreement(signCtx)
	require.Contains(t, signRecorder.Body.String(), `"success":true`)

	signAgainCtx, signAgainRecorder := newInvoiceTestContext(t, 42, `{"scene":"topup"}`)
	SignPurchaseAgreement(signAgainCtx)
	require.Contains(t, signAgainRecorder.Body.String(), `"success":true`)

	var signatures []model.PurchaseAgreementSignature
	require.NoError(t, model.DB.Find(&signatures).Error)
	assert.Len(t, signatures, 1)
	assert.Equal(t, "topup", signatures[0].Scene)

	allowedCtx, allowedRecorder := newInvoiceTestContext(t, 42, `{"scene":"topup"}`)
	ConfirmPurchaseAgreement(allowedCtx)
	assert.Contains(t, allowedRecorder.Body.String(), `"success":true`)

	// 新版本要求重新签署
	signed, err := model.HasSignedPurchaseAgreement(42, "2.0")
	require.NoError(t, err)
	assert.False(t, signed)

	// 关闭开关后不再拦截
	setting.Enabled = false
	openCtx, openRecorder := newInvoiceTestContext(t, 43, `{"scene":"topup"}`)
	ConfirmPurchaseAgreement(openCtx)
	assert.Contains(t, openRecorder.Body.String(), `"success":true`)
}
