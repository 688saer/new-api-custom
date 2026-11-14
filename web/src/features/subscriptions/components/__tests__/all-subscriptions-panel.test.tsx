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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { getAdminPlans, listAllUserSubscriptions } from '../../api'
import type { AdminSubscriptionPage, AdminSubscriptionQuery } from '../../types'
import { AllSubscriptionsPanel } from '../all-subscriptions-panel'
import { SubscriptionsProvider } from '../subscriptions-provider'

vi.mock('../../api', () => ({
  getAdminPlans: vi.fn(),
  listAllUserSubscriptions: vi.fn(),
}))

const DAY = 86400
const NOW = Math.floor(Date.now() / 1000)

const PAGE: AdminSubscriptionPage = {
  items: [
    {
      id: 9311,
      user_id: 701,
      username: 'alice',
      display_name: 'Alice',
      email: 'alice@example.com',
      user_group: 'vip',
      plan_id: 9301,
      plan_title: 'Pro',
      price_amount: 20,
      status: 'active',
      source: 'order',
      start_time: NOW - DAY,
      end_time: NOW + 3 * DAY,
      next_reset_time: NOW + DAY,
      amount_total: 2000,
      amount_used: 500,
      token_limit_total: 0,
      token_used: 0,
      upgrade_group: 'vip',
      created_at: NOW - DAY,
    },
    {
      id: 9312,
      user_id: 702,
      username: 'bob',
      display_name: 'Bob',
      email: 'bob@example.com',
      user_group: 'default',
      plan_id: 9302,
      plan_title: 'Basic',
      price_amount: 5,
      status: 'expired',
      source: 'admin',
      start_time: NOW - 40 * DAY,
      end_time: NOW - DAY,
      next_reset_time: 0,
      amount_total: 500,
      amount_used: 500,
      token_limit_total: 0,
      token_used: 0,
      upgrade_group: '',
      created_at: NOW - 40 * DAY,
    },
  ],
  total: 2,
  page: 1,
  page_size: 20,
  summary: {
    total: 2,
    active: 1,
    expiring_soon: 1,
    expired: 1,
    amount_total: 2500,
    amount_used: 1000,
  },
}

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})

const clients: QueryClient[] = []

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <SubscriptionsProvider>
          <AllSubscriptionsPanel />
        </SubscriptionsProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )
}

function lastQuery(): AdminSubscriptionQuery {
  const last = vi.mocked(listAllUserSubscriptions).mock.calls.at(-1)
  if (!last) throw new Error('The panel never asked for subscriptions')
  return last[0]
}

beforeEach(() => {
  vi.mocked(getAdminPlans).mockResolvedValue({ success: true, data: [] })
  vi.mocked(listAllUserSubscriptions).mockResolvedValue({
    success: true,
    data: PAGE,
  })
  // The panel sits inside the subscriptions provider, which reads system
  // options on mount; every other request in this file is mocked above.
  vi.spyOn(api, 'get').mockResolvedValue({ data: { success: true, data: [] } })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

it('lists every card with its user, plan, and status next to the summary', async () => {
  renderPanel()

  expect(await screen.findByText('Alice')).toBeInTheDocument()
  expect(screen.getByText('Bob')).toBeInTheDocument()
  expect(screen.getByText('alice · #701 · alice@example.com')).toBeVisible()
  expect(screen.getByText('Pro')).toBeInTheDocument()
  expect(screen.getByText('Basic')).toBeInTheDocument()
  expect(screen.getByText('Active')).toBeInTheDocument()
  expect(screen.getByText('Expired')).toBeInTheDocument()
  expect(screen.getByText('Total cards')).toBeInTheDocument()
  expect(lastQuery()).toMatchObject({ page: 1, pageSize: 20 })
})

it('asks the server for the typed user and starts over from the first page', async () => {
  renderPanel()
  await screen.findByText('Alice')

  await userEvent.type(
    screen.getByPlaceholderText('Search user, email, or ID...'),
    'alice'
  )

  await waitFor(() => expect(lastQuery().keyword).toBe('alice'))
  expect(lastQuery()).toMatchObject({ page: 1, pageSize: 20 })
})

it('narrows the list to cards ending within a week', async () => {
  renderPanel()
  await screen.findByText('Alice')

  await userEvent.click(screen.getByRole('button', { name: /Status/ }))
  // The window option is also the third summary tile's label, so pick the
  // entry rendered inside the opened filter popover.
  const options = await screen.findAllByText('Ending within 7 days')
  const option = options.at(-1)
  if (!option) throw new Error('The status filter offered no window option')
  await userEvent.click(option)

  await waitFor(() => expect(lastQuery().expiringDays).toBe(7))
  expect(lastQuery().status).toBe('active')
  expect(lastQuery().page).toBe(1)
})

it('explains the empty state instead of an empty table', async () => {
  vi.mocked(listAllUserSubscriptions).mockResolvedValue({
    success: true,
    data: {
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
      summary: {
        total: 0,
        active: 0,
        expiring_soon: 0,
        expired: 0,
        amount_total: 0,
        amount_used: 0,
      },
    },
  })

  renderPanel()

  expect(await screen.findByText('No subscriptions yet')).toBeInTheDocument()
})
