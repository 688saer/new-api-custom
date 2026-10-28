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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getMyTickets } from '../api'
import { TicketDetail } from '../components/ticket-detail'
import { useMyTickets } from '../hooks/use-tickets'
import type { Ticket, TicketListResult } from '../types'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    getMyTickets: vi.fn(),
    getMyTicket: vi.fn(),
  }
})

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 12,
    user_id: 13,
    title: 'Image and archive reproduction',
    category: 'api',
    status: 'pending',
    priority: 'normal',
    agent_id: 0,
    agent_name: 'Support',
    archived: false,
    unread_for_user: 0,
    unread_for_staff: 0,
    message_count: 1,
    last_author_type: 'user',
    last_message_at: 1793174000,
    created_at: 1793174000,
    updated_at: 1793174000,
    resolved_at: 0,
    closed_at: 0,
    unread_count: 0,
    replyable: true,
    messages: [],
    ...overrides,
  }
}

function makeListResult(items: Ticket[]): TicketListResult {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 100,
    unread_total: 0,
    system: {
      enabled: true,
      agent_name: 'Support',
      welcome: '',
      online: true,
      offline_reply: '',
      allow_attachments: true,
      max_open_tickets: 5,
      categories: ['api'],
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('archived ticket detail', () => {
  it('offers restore and blocks replying once support archived the ticket', () => {
    // 后台归档后用户端 detail 的 replyable 为 false，输入框必须换成提示
    render(
      <TicketDetail
        ticket={makeTicket({ archived: true, replyable: false })}
        agentName='Support'
        allowAttachments
        submitting={false}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onArchive={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument()
    expect(
      screen.getByText('This ticket is archived. Restore it to continue.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Mark as resolved' })
    ).not.toBeInTheDocument()
  })

  it('keeps the reply box for an open ticket', () => {
    render(
      <TicketDetail
        ticket={makeTicket()}
        agentName='Support'
        allowAttachments
        submitting={false}
        onReply={vi.fn()}
        onResolve={vi.fn()}
        onArchive={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})

describe('user ticket list freshness', () => {
  it('drops the ticket from the open list after support archives it', async () => {
    // 用户页面常常一直开着，列表必须自己重拉，否则归档后仍显示在「打开」里
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })

    const list = vi.mocked(getMyTickets)
    list.mockResolvedValue({
      success: true,
      data: makeListResult([makeTicket()]),
    })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = (props: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useMyTickets(false), { wrapper })

    // react-query 用真实宏任务批量通知订阅者，这里要让它跑完
    const flush = async (ms: number) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms)
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
    }

    await flush(1)
    expect(result.current.data?.items).toHaveLength(1)

    list.mockResolvedValue({ success: true, data: makeListResult([]) })
    await flush(21_000)
    await flush(1)

    expect(list).toHaveBeenCalledTimes(2)
    expect(result.current.data?.items).toHaveLength(0)
  })
})
