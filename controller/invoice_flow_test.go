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
	"fmt"
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

	require.NoError(t, db.AutoMigrate(&model.Invoice{}, &model.InvoiceOrder{}, &model.TopUp{}, &model.PurchaseAgreementSignature{}))
	return db
}

// seedPaidTopUp 造一笔已支付订单，发票金额现在完全由这些订单决定
func seedPaidTopUp(t *testing.T, userId int, tradeNo string, money float64, status string) *model.TopUp {
	t.Helper()

	topUp := &model.TopUp{
		UserId:          userId,
		Amount:          int64(money * 500000),
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodAlipayOfficial,
		PaymentProvider: model.PaymentProviderAlipay,
		CreateTime:      1700000000,
		CompleteTime:    1700000100,
		Status:          status,
	}
	require.NoError(t, model.DB.Create(topUp).Error)
	return topUp
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
// 金额只能来自本账户已支付的订单，手写金额与重复开票都会被拒绝。
func TestInvoiceRequestLifecycle(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupInvoiceTestDB(t)
	t.Setenv("INVOICE_FILE_DIR", t.TempDir())

	setting := operation_setting.GetInvoiceSetting()
	setting.Enabled = true
	previousMin, previousMax := setting.MinAmount, setting.MaxAmount
	setting.MinAmount, setting.MaxAmount = 0, 0
	t.Cleanup(func() {
		setting.MinAmount, setting.MaxAmount = previousMin, previousMax
	})

	first := seedPaidTopUp(t, 7, "trade-paid-1", 88.5, "success")
	second := seedPaidTopUp(t, 7, "trade-paid-2", 11.5, "success")
	pending := seedPaidTopUp(t, 7, "trade-pending", 30, "pending")
	foreign := seedPaidTopUp(t, 99, "trade-foreign", 20, "success")

	create := func(body string) *httptest.ResponseRecorder {
		ctx, recorder := newInvoiceTestContext(t, 7, body)
		CreateMyInvoice(ctx)
		return recorder
	}

	invalid := create(`{"title_type":"company","title_name":"测试公司","email":"fin@example.com","topup_ids":[1]}`)
	assert.Contains(t, invalid.Body.String(), model.InvoiceCodeInvalidTaxId)

	// 未支付、他人订单、以及手写金额都不能通过
	unpaid := create(fmt.Sprintf(`{"title_type":"personal","title_name":"张三","email":"a@b.com","topup_ids":[%d]}`, pending.Id))
	assert.Contains(t, unpaid.Body.String(), "not a paid order")

	borrowed := create(fmt.Sprintf(`{"title_type":"personal","title_name":"张三","email":"a@b.com","topup_ids":[%d]}`, foreign.Id))
	assert.Contains(t, borrowed.Body.String(), "not a paid order")

	typed := create(fmt.Sprintf(`{"title_type":"personal","title_name":"张三","email":"a@b.com","topup_ids":[%d],"amount":10}`, first.Id))
	assert.Contains(t, typed.Body.String(), model.InvoiceCodeInvalidAmount)

	noOrder := create(`{"title_type":"personal","title_name":"张三","email":"a@b.com"}`)
	assert.Contains(t, noOrder.Body.String(), model.InvoiceCodeInvalidAmount)

	created := create(fmt.Sprintf(`{"title_type":"company","title_name":"测试公司","tax_id":"91310000MA1K35Q12X","email":"fin@example.com","topup_ids":[%d,%d],"content":"技术服务费"}`, first.Id, second.Id))
	require.Contains(t, created.Body.String(), `"success":true`)

	var invoice model.Invoice
	require.NoError(t, model.DB.Order("id desc").First(&invoice).Error)
	assert.Equal(t, model.InvoiceStatusPending, invoice.Status)
	assert.Equal(t, int64(10000), invoice.AmountCents)
	assert.Equal(t, 7, invoice.UserId)

	var orders []model.InvoiceOrder
	require.NoError(t, model.DB.Where("invoice_id = ?", invoice.Id).Find(&orders).Error)
	require.Len(t, orders, 2)
	assert.Equal(t, "trade-paid-1", orders[0].TradeNo)
	assert.Equal(t, int64(8850), orders[0].AmountCents)
	assert.Equal(t, int64(1150), orders[1].AmountCents)

	// 已被占用的订单不能再次开票
	again := create(fmt.Sprintf(`{"title_type":"personal","title_name":"张三","email":"a@b.com","topup_ids":[%d]}`, first.Id))
	assert.Contains(t, again.Body.String(), "already been invoiced")

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
	third := seedPaidTopUp(t, 7, "trade-paid-3", 20, "success")
	rejectedCtx, rejectedRecorder := newInvoiceTestContext(t, 7,
		fmt.Sprintf(`{"title_type":"personal","title_name":"张三","email":"a@b.com","topup_ids":[%d]}`, third.Id))
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

	// 驳回释放订单：同一笔订单可以重新申请
	available, err := model.InvoiceableOrders(7)
	require.NoError(t, err)
	var reopened model.InvoiceableOrder
	for _, order := range available {
		if order.TopUpId == third.Id {
			reopened = order
		}
	}
	require.NotZero(t, reopened.TopUpId)
	assert.Zero(t, reopened.InvoiceId)

	retry := create(fmt.Sprintf(`{"title_type":"personal","title_name":"张三","email":"a@b.com","topup_ids":[%d]}`, third.Id))
	assert.Contains(t, retry.Body.String(), `"success":true`)
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
