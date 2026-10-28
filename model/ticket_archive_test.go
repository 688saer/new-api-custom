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
package model

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// resetTicketTables 清空工单相关表，保证每个用例独立
func resetTicketTables(t *testing.T) {
	t.Helper()
	for _, table := range []any{&Ticket{}, &TicketMessage{}, &TicketAttachment{}, &TicketAgentSession{}} {
		require.NoError(t, DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(table).Error)
	}
}

func insertTicketForUser(t *testing.T, userId int, title string) *Ticket {
	t.Helper()
	now := common.GetTimestamp()
	ticket := &Ticket{
		UserId:        userId,
		Title:         title,
		Category:      TicketCategoryApi,
		Status:        TicketStatusPending,
		Priority:      TicketPriorityNormal,
		LastMessageAt: now,
		CreatedAt:     now,
		UpdatedAt:     now,
		MessageCount:  1,
	}
	require.NoError(t, DB.Create(ticket).Error)
	require.NoError(t, DB.Create(&TicketMessage{
		TicketId:   ticket.Id,
		AuthorType: TicketAuthorUser,
		AuthorId:   userId,
		Content:    "Please take a look",
		CreatedAt:  now,
	}).Error)
	return ticket
}

// ownerAgent 用超管身份操作后台接口，跳过权限矩阵
func ownerAgent() *TicketAgent {
	return &TicketAgent{Id: 1, Username: "owner", Role: TicketAgentRoleOwner, Enabled: true}
}

func ticketErrorCode(err error) string {
	var ticketErr *TicketError
	if errors.As(err, &ticketErr) {
		return ticketErr.Code
	}
	return ""
}

// 后台归档后，用户侧必须同步看到归档结果，不能只留在「打开」列表里
func TestArchiveStaffTicketHidesTicketFromUserOpenList(t *testing.T) {
	resetTicketTables(t)
	ticket := insertTicketForUser(t, 13, "Archive sync")

	_, err := ArchiveStaffTicket(ownerAgent(), ticket.Id, true)
	require.NoError(t, err)

	openPage, err := ListUserTickets(13, false, 1, 20)
	require.NoError(t, err)
	require.Empty(t, openPage.Items)
	require.Zero(t, openPage.Total)

	archivedPage, err := ListUserTickets(13, true, 1, 20)
	require.NoError(t, err)
	require.Len(t, archivedPage.Items, 1)
	require.Equal(t, ticket.Id, archivedPage.Items[0].Id)

	detail, err := GetUserTicketView(13, ticket.Id)
	require.NoError(t, err)
	require.True(t, detail.Archived)
	require.False(t, detail.Replyable)
}

// 归档后用户点「恢复」应回到进行中列表
func TestRestoreStaffTicketReturnsTicketToUserOpenList(t *testing.T) {
	resetTicketTables(t)
	ticket := insertTicketForUser(t, 13, "Restore sync")

	_, err := ArchiveStaffTicket(ownerAgent(), ticket.Id, true)
	require.NoError(t, err)
	_, err = ArchiveStaffTicket(ownerAgent(), ticket.Id, false)
	require.NoError(t, err)

	openPage, err := ListUserTickets(13, false, 1, 20)
	require.NoError(t, err)
	require.Len(t, openPage.Items, 1)
	require.True(t, openPage.Items[0].Replyable)
}

// 已归档的工单不能再被任何一侧追加消息，否则会静默写进归档会话
func TestArchivedTicketRejectsRepliesFromBothSides(t *testing.T) {
	resetTicketTables(t)
	ticket := insertTicketForUser(t, 13, "No reply while archived")

	_, err := ArchiveStaffTicket(ownerAgent(), ticket.Id, true)
	require.NoError(t, err)

	_, err = ReplyStaffTicket(ownerAgent(), ticket.Id, "We are on it", nil)
	require.Error(t, err)
	require.Equal(t, TicketCodeClosed, ticketErrorCode(err))

	_, err = ReplyUserTicket(13, ticket.Id, "Any update?", nil)
	require.Error(t, err)
	require.Equal(t, TicketCodeClosed, ticketErrorCode(err))
}

// 归档不改状态，用户侧仍要显示原状态而不是被当成已结束
func TestArchivedTicketKeepsStatusButStopsReply(t *testing.T) {
	resetTicketTables(t)
	ticket := insertTicketForUser(t, 13, "Status untouched")

	view, err := ArchiveStaffTicket(ownerAgent(), ticket.Id, true)
	require.NoError(t, err)
	require.Equal(t, TicketStatusPending, view.Status)
	require.True(t, view.Archived)
	require.False(t, view.Replyable)

	require.True(t, operation_setting.IsTicketEnabled())
}
