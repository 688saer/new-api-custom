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
import { createFileRoute } from '@tanstack/react-router'

import { TicketConsoleApp } from '@/features/ticket-console'

/**
 * 工单后台独立面板，位于站点布局之外：
 * 它有独立账号与登录态，站点会话和侧边栏都不参与。
 */
export const Route = createFileRoute('/tickets-admin')({
  component: TicketConsoleApp,
})
