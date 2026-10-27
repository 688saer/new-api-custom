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
import type { TicketCategory, TicketStatus } from '../types'

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'warning'
  | 'outline'

/**
 * 状态对应的展示文案与配色。
 * pending / processing 对用户是同一件事，因此共用「待客服回复」。
 */
export function ticketStatusMeta(status: TicketStatus): {
  labelKey: string
  variant: BadgeVariant
} {
  switch (status) {
    case 'pending':
      return { labelKey: 'Waiting for support', variant: 'warning' }
    case 'processing':
      return { labelKey: 'Waiting for support', variant: 'warning' }
    case 'awaiting_user':
      return { labelKey: 'Waiting for your reply', variant: 'default' }
    case 'resolved':
      return { labelKey: 'Resolved', variant: 'secondary' }
    case 'closed':
      return { labelKey: 'Closed', variant: 'outline' }
  }
}

/** 分类的翻译键。 */
export function ticketCategoryLabelKey(category: TicketCategory): string {
  switch (category) {
    case 'api':
      return 'API and integration'
    case 'billing':
      return 'Billing and top-up'
    case 'account':
      return 'Account'
    case 'model':
      return 'Model usage'
    case 'other':
      return 'Something else'
  }
}

/** 后台队列的状态筛选值。 */
export const TICKET_STATUS_FILTERS = [
  'all',
  'pending',
  'processing',
  'awaiting_user',
  'resolved',
  'closed',
] as const

export type TicketStatusFilter = (typeof TICKET_STATUS_FILTERS)[number]

/** 后台队列的指派筛选值。 */
export const TICKET_ASSIGNMENT_FILTERS = ['all', 'mine', 'unassigned'] as const

export type TicketAssignmentFilter = (typeof TICKET_ASSIGNMENT_FILTERS)[number]
