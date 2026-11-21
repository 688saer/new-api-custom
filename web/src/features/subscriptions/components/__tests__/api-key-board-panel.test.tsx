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

import { listAdminEnabledApiKeys, revealAdminApiKey } from '../../api'
import type {
  AdminEnabledApiKeyPage,
  AdminEnabledApiKeyQuery,
} from '../../types'
import { ApiKeyBoardPanel } from '../api-key-board-panel'

vi.mock('../../api', () => ({
  listAdminEnabledApiKeys: vi.fn(),
  revealAdminApiKey: vi.fn(),
}))

// The panel mounts the shared step-up dialog, whose method lookup and proof
// exchange are separate network calls; stub them to a session proof so these
// tests stay about the board.
const requestVerification = vi.fn()
vi.mock('@/features/auth/secure-verification', () => ({
  useSecureVerification: () => ({
    requestVerification,
    isActive: false,
    dialogProps: {},
  }),
  SecureVerificationDialog: () => null,
}))

const writeText = vi.fn().mockResolvedValue(undefined)

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
          remain_quota: 1000000,
          used_quota: 500000,
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

async function openUser(name: RegExp) {
  await userEvent.click(screen.getByRole('button', { name }))
}

beforeEach(() => {
  vi.mocked(listAdminEnabledApiKeys).mockResolvedValue({
    success: true,
    data: PAGE,
  })
  vi.mocked(revealAdminApiKey).mockReset()
  requestVerification.mockReset()
  writeText.mockClear()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
})

it('summarises the board before listing anyone', async () => {
  renderPanel()
  await screen.findByText('Alice')

  expect(screen.getByText('Users with keys')).toBeVisible()
  expect(screen.getByText('Enabled keys')).toBeVisible()
  expect(screen.getByText('Usable now')).toBeVisible()
  // Two users, three enabled keys, and two of them live.
  expect(screen.getAllByText('2').length).toBeGreaterThan(0)
  expect(screen.getByText('3')).toBeVisible()
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

it('copies one key as masked information', async () => {
  renderPanel()
  await screen.findByText('Alice')
  await openUser(/Alice/)

  const buttons = await screen.findAllByRole('button', {
    name: 'Copy key information',
  })
  await userEvent.click(buttons[1])

  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
  const copied = writeText.mock.calls[0][0] as string
  expect(copied).toContain('Name: alice-fast')
  expect(copied).toContain('Key: sk-a**********aaaa')
  // A copy never carries a usable secret unless it was revealed first.
  expect(copied).not.toMatch(/sk-[A-Za-z0-9]{16,}/)
})

it('copies every key of a user in one block', async () => {
  renderPanel()
  await screen.findByText('Alice')
  await openUser(/Alice/)

  await userEvent.click(
    screen.getByRole('button', {
      name: 'Copy all key information of this user',
    })
  )

  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
  const copied = writeText.mock.calls[0][0] as string
  expect(copied).toContain('Alice (alice · #801)')
  expect(copied).toContain('Name: alice-fast')
  expect(copied).toContain('Name: alice-slow')
})

it('reveals the full key only after a proof, then copies it', async () => {
  requestVerification.mockResolvedValue({ proof_token: 'proof-for-this-key' })
  vi.mocked(revealAdminApiKey).mockResolvedValue({
    success: true,
    data: { id: 8101, key: 'sk-abcdefghijklmnopqrst' },
  })

  renderPanel()
  await screen.findByText('Alice')
  await openUser(/Alice/)

  const revealButtons = await screen.findAllByRole('button', { name: 'Reveal' })
  await userEvent.click(revealButtons[1])

  await waitFor(() =>
    expect(revealAdminApiKey).toHaveBeenCalledWith(8101, 'proof-for-this-key')
  )
  // The proof has to name the key it unlocks.
  expect(requestVerification).toHaveBeenCalledWith(
    expect.objectContaining({
      scope: 'admin.user.api_key.read',
      context: { user_id: 801, key_id: 8101 },
    })
  )
  expect(await screen.findByText('sk-abcdefghijklmnopqrst')).toBeVisible()
})

it('reveals nothing when the operator cancels the proof', async () => {
  requestVerification.mockResolvedValue(null)

  renderPanel()
  await screen.findByText('Alice')
  await openUser(/Alice/)

  const revealButtons = await screen.findAllByRole('button', { name: 'Reveal' })
  await userEvent.click(revealButtons[0])

  await waitFor(() => expect(requestVerification).toHaveBeenCalled())
  expect(revealAdminApiKey).not.toHaveBeenCalled()
  expect(screen.queryByText(/sk-[A-Za-z0-9]{16,}/)).not.toBeInTheDocument()
})

it('copies the revealed key once it is on screen', async () => {
  requestVerification.mockResolvedValue({ proof_token: 'proof' })
  vi.mocked(revealAdminApiKey).mockResolvedValue({
    success: true,
    data: { id: 8101, key: 'sk-abcdefghijklmnopqrst' },
  })

  renderPanel()
  await screen.findByText('Alice')
  await openUser(/Alice/)

  const revealButtons = await screen.findAllByRole('button', { name: 'Reveal' })
  await userEvent.click(revealButtons[1])
  await screen.findByText('sk-abcdefghijklmnopqrst')

  const copyButtons = await screen.findAllByRole('button', {
    name: 'Copy key information',
  })
  await userEvent.click(copyButtons[1])

  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
  expect(writeText.mock.calls[0][0]).toContain('Key: sk-abcdefghijklmnopqrst')
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
