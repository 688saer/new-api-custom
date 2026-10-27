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
import { describe, expect, it } from 'vitest'

import { ticketCategoryLabelKey, ticketStatusMeta } from '../lib/tickets'
import {
  isTicketEnded,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  type TicketStatus,
} from '../types'

describe('ticket status metadata', () => {
  it('maps pending and processing to the same user-facing label', () => {
    expect(ticketStatusMeta('pending').labelKey).toBe(
      ticketStatusMeta('processing').labelKey
    )
  })

  it('marks only resolved and closed as ended', () => {
    const ended = TICKET_STATUSES.filter((status) => isTicketEnded(status))
    expect(ended).toEqual(['resolved', 'closed'])
  })

  it('gives every status a non-empty label key', () => {
    for (const status of TICKET_STATUSES) {
      expect(ticketStatusMeta(status).labelKey.length).toBeGreaterThan(0)
    }
  })

  it('distinguishes statuses that need action from terminal ones', () => {
    const variants = new Set(
      TICKET_STATUSES.map(
        (status: TicketStatus) => ticketStatusMeta(status).variant
      )
    )
    expect(variants.size).toBeGreaterThan(1)
  })
})

describe('ticket categories', () => {
  it('covers all five reference categories', () => {
    expect(TICKET_CATEGORIES).toHaveLength(5)
  })

  it('gives every category a distinct label key', () => {
    const labels = TICKET_CATEGORIES.map((category) =>
      ticketCategoryLabelKey(category)
    )
    expect(new Set(labels).size).toBe(TICKET_CATEGORIES.length)
  })
})
