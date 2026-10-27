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

/** 工单状态；pending 与 processing 对用户都表现为「待客服回复」。 */
export type TicketStatus =
  | 'pending'
  | 'processing'
  | 'awaiting_user'
  | 'resolved'
  | 'closed'

/** 工单分类，与后端 ticket_category 常量一一对应。 */
export type TicketCategory = 'api' | 'billing' | 'account' | 'model' | 'other'

/** 消息作者类型。 */
export type TicketAuthorType = 'user' | 'agent' | 'system'

export const TICKET_STATUSES: readonly TicketStatus[] = [
  'pending',
  'processing',
  'awaiting_user',
  'resolved',
  'closed',
]

export const TICKET_CATEGORIES: readonly TicketCategory[] = [
  'api',
  'billing',
  'account',
  'model',
  'other',
]

/** 结束态：已解决与已关闭都不能再回复。 */
export const TICKET_ENDED_STATUSES: readonly TicketStatus[] = [
  'resolved',
  'closed',
]

export interface TicketAttachment {
  id: number
  ticket_id: number
  message_id: number
  file_name: string
  mime_type: string
  size: number
  created_at: number
}

export interface TicketMessage {
  id: number
  ticket_id: number
  author_type: TicketAuthorType
  author_id: number
  author_name: string
  content: string
  created_at: number
  attachments: TicketAttachment[]
}

export interface Ticket {
  id: number
  user_id: number
  title: string
  category: TicketCategory
  status: TicketStatus
  priority: string
  agent_id: number
  agent_name: string
  archived: boolean
  unread_for_user: number
  unread_for_staff: number
  message_count: number
  last_author_type: TicketAuthorType
  last_message_at: number
  created_at: number
  updated_at: number
  resolved_at: number
  closed_at: number
  username?: string
  email?: string
  messages?: TicketMessage[]
  unread_count: number
  replyable: boolean
  last_message?: string
}

/** 工单系统公开配置，决定入口是否展示与文案。 */
export interface TicketSystemState {
  enabled: boolean
  agent_name: string
  welcome: string
  online: boolean
  offline_reply: string
  allow_attachments: boolean
  max_open_tickets: number
  categories: TicketCategory[]
}

export interface TicketListResult {
  items: Ticket[]
  total: number
  page: number
  page_size: number
  unread_total: number
  system: TicketSystemState
}

export interface UploadedTicketImage {
  id: number
  file_name: string
  mime_type: string
  size: number
}

export function isTicketEnded(status: TicketStatus): boolean {
  return TICKET_ENDED_STATUSES.includes(status)
}
