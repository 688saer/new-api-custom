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

import { listAdminEnabledApiKeys } from '../../api'
import type {
  AdminEnabledApiKeyPage,
  AdminEnabledApiKeyQuery,
} from '../../types'
import { ApiKeyBoardPanel } from '../api-key-board-panel'

vi.mock('../../api', () => ({
  listAdminEnabledApiKeys: vi.fn(),
}))

const DAY = 86400
const NOW = Math.floor(Date.now() / 1000)

const PAGE: AdminEnabledApiKeyPage = {
  items: [
    {
      user_id: 801,
      username: 'alice',
      display_name: 'Alice',
      email: 'alice@example.com',
      user_group: 'vip',
      user_status: 1,
      key_count: 2,
      keys: [
        {
          id: 8102,
          name: 'alice-slow',
          masked_key: 'b**********bbbb',
          group: 'vip',
          remain_quota: 0,
          used_quota: 20,
          unlimited_quota: true,
          expired_time: -1,
          created_time: NOW - 2 * DAY,
          accessed_time: NOW - 60,
          model_limits_enabled: false,
          model_limits: '',
        },
        {
          id: 8101,
          name: 'alice-fast',
          masked_key: 'a**********aaaa',
          group: 'vip',
          remain_quota: 1000,
          used_quota: 500,
          unlimited_quota: false,
          expired_time: -1,
          created_time: NOW - 3 * DAY,
          accessed_time: 0,
          model_limits_enabled: true,
          model_limits: 'gpt-4o,claude-3',
        },
      ],
    },
    {
      user_id: 802,
      username: 'bob',
      display_name: 'Bob',
      email: 'bob@example.com',
      user_group: 'default',
      user_status: 1,
      key_count: 1,
      keys: [
        {
          id: 8104,
          name: 'bob-expired',
          masked_key: 'd**********dddd',
          group: '',
          remain_quota: 5000,
          used_quota: 0,
          unlimited_quota: false,
          expired_time: NOW - DAY,
          created_time: NOW - 40 * DAY,
          accessed_time: NOW - 30 * DAY,
          model_limits_enabled: false,
          model_limits: '',
        },
      ],
    },
  ],
  total: 2,
  key_total: 3,
  page: 1,
  page_size: 10,
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
        <ApiKeyBoardPanel />
      </QueryClientProvider>
    </I18nextProvider>
  )
}

function lastQuery(): AdminEnabledApiKeyQuery {
  const last = vi.mocked(listAdminEnabledApiKeys).mock.calls.at(-1)
  if (!last) throw new Error('The board never asked for API keys')
  return last[0]
}

/** Opens one user's group by its accessible name. */
async function openUser(name: RegExp) {
  await userEvent.click(screen.getByRole('button', { name }))
}

beforeEach(() => {
  vi.mocked(listAdminEnabledApiKeys).mockResolvedValue({
    success: true,
    data: PAGE,
  })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

it('groups the enabled keys under the user that owns them', async () => {
  renderPanel()

  expect(await screen.findByText('Alice')).toBeInTheDocument()
  expect(screen.getByText('Bob')).toBeInTheDocument()
  expect(screen.getByText(/Users with keys: 2/)).toBeVisible()
  expect(screen.getByText(/Enabled keys: 3/)).toBeVisible()
  expect(lastQuery()).toMatchObject({ page: 1, pageSize: 10 })
})

it('keeps every user collapsed until the operator opens them', async () => {
  renderPanel()
  await screen.findByText('Alice')

  const trigger = screen.getByRole('button', { name: /Alice/ })
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText('alice-fast')).not.toBeInTheDocument()

  await userEvent.click(trigger)

  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(await screen.findByText('alice-fast')).toBeVisible()
  expect(screen.getByText('alice-slow')).toBeVisible()
  expect(screen.getByText('sk-a**********aaaa')).toBeVisible()
})

it('opens several users at once so they can be compared', async () => {
  renderPanel()
  await screen.findByText('Alice')

  await openUser(/Alice/)
  await openUser(/Bob/)

  expect(await screen.findByText('alice-fast')).toBeVisible()
  expect(screen.getByText('bob-expired')).toBeVisible()
})

it('names a key unusable when it is expired or out of quota', async () => {
  renderPanel()
  await screen.findByText('Alice')

  await openUser(/Alice/)
  await openUser(/Bob/)

  // bob-expired is past its expiry; alice-fast and alice-slow are both live.
  expect(await screen.findByText('bob-expired')).toBeVisible()
  const usable = await screen.findAllByText('Usable')
  expect(usable.length).toBe(2)
  expect(screen.getByText('Not usable')).toBeVisible()
})

it('asks the server for the typed user and starts over from the first page', async () => {
  renderPanel()
  await screen.findByText('Alice')

  await userEvent.type(
    screen.getByPlaceholderText('Search user, key name, or ID...'),
    'alice'
  )

  await waitFor(() => expect(lastQuery().keyword).toBe('alice'))
  expect(lastQuery().page).toBe(1)
})

it('explains the empty state instead of an empty list', async () => {
  vi.mocked(listAdminEnabledApiKeys).mockResolvedValue({
    success: true,
    data: { items: [], total: 0, key_total: 0, page: 1, page_size: 10 },
  })

  renderPanel()

  expect(
    await screen.findByText('No user has an enabled API key yet')
  ).toBeInTheDocument()
})

it('says how many keys are hidden when a user owns more than are listed', async () => {
  vi.mocked(listAdminEnabledApiKeys).mockResolvedValue({
    success: true,
    data: {
      ...PAGE,
      items: [
        {
          ...PAGE.items[0],
          key_count: 60,
          keys: PAGE.items[0].keys,
        },
      ],
      total: 1,
      key_total: 60,
    },
  })

  renderPanel()
  await screen.findByText('Alice')
  await openUser(/Alice/)

  expect(
    await screen.findByText('Showing the newest 2 of 60 keys')
  ).toBeVisible()
})