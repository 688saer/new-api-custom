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
import type { Ticket } from '@/features/tickets/types'

/** 工单后台角色。owner 始终拥有全部权限。 */
export type TicketAgentRole = 'owner' | 'admin' | 'agent'

export const TICKET_AGENT_ROLES: readonly TicketAgentRole[] = [
  'owner',
  'admin',
  'agent',
]

/** 权限点，与后端 ticket_agent.go 保持一致。 */
export type TicketPermission =
  | 'tickets.view_all'
  | 'tickets.reply'
  | 'tickets.assign'
  | 'tickets.close'
  | 'agents.manage'
  | 'settings.manage'

export interface TicketAgentAccount {
  id: number
  username: string
  display_name: string
  role: TicketAgentRole
  permissions: TicketPermission[]
  enabled: boolean
  last_login_at: number
  last_login_ip: string
  created_at: number
  locked_until: number
}

export interface TicketAgentRoleDefinition {
  id: TicketAgentRole
  permissions: TicketPermission[]
}

export interface TicketAgentListResult {
  items: TicketAgentAccount[]
  permissions: TicketPermission[]
  roles: TicketAgentRoleDefinition[]
}

export interface TicketConsoleIdentity {
  agent: TicketAgentAccount
  site_admin: boolean
  permissions: TicketPermission[]
}

export interface TicketConsoleCounts {
  pending: number
  processing: number
  awaiting_user: number
  resolved: number
  closed: number
  unassigned: number
  unread: number
  total: number
}

export interface TicketConsoleSettings {
  enabled: boolean
  agent_name: string
  welcome: string
  online: boolean
  offline_reply: string
  max_open_tickets: number
  allow_attachments: boolean
}

export interface TicketConsoleTicketPage {
  items: Ticket[]
  total: number
  page: number
  page_size: number
}

/** 后台账号是否拥有某个权限。 */
export function agentHasPermission(
  account: TicketAgentAccount | null | undefined,
  permission: TicketPermission
): boolean {
  if (!account) return false
  if (account.role === 'owner') return true
  return account.permissions.includes(permission)
}

/** 权限点的翻译键。 */
export function permissionLabelKey(permission: TicketPermission): string {
  switch (permission) {
    case 'tickets.view_all':
      return 'View every ticket'
    case 'tickets.reply':
      return 'Reply to tickets'
    case 'tickets.assign':
      return 'Assign tickets'
    case 'tickets.close':
      return 'Resolve, close and archive'
    case 'agents.manage':
      return 'Manage console accounts'
    case 'settings.manage':
      return 'Change ticket settings'
  }
}

/** 角色的翻译键。 */
export function roleLabelKey(role: TicketAgentRole): string {
  switch (role) {
    case 'owner':
      return 'Owner'
    case 'admin':
      return 'Administrator'
    case 'agent':
      return 'Agent'
  }
}
