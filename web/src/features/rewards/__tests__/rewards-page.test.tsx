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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { RewardsPage } from '../components/rewards-page'
import { getRewardClaimState } from '../lib/rewards'
import type {
  RewardClaimResult,
  RewardHistoryResult,
  RewardItem,
  RewardPendingResult,
} from '../types'

const api = vi.hoisted(() => ({
  getPendingRewards: vi.fn(),
  getRewardHistory: vi.fn(),
  claimReward: vi.fn(),
}))

vi.mock('../api', () => api)

// The claim dialog renders a Base UI Dialog, whose portal measures running
// animations on mount. jsdom implements neither.
const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})

afterAll(() => {
  if (getAnimationsDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'getAnimations',
      getAnimationsDescriptor
    )
    return
  }
  Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
})

const COPY = {
  label: 'New API',
  title: 'Thanks for your support',
  subtitle: 'Every build deserves support.',
  footer: 'Usable for model calls',
  stub_text: '专属奖励',
  stub_font_size: 28,
  button_text: 'Claim reward',
}

function makeReward(overrides: Partial<RewardItem> = {}): RewardItem {
  return {
    id: 1,
    status: 'pending',
    campaign_name: 'Autumn thanks',
    style: 'aurora',
    copy: { ...COPY },
    amount_quota: 500000,
    claim_start_at: 0,
    expires_at: 0,
    created_at: 1_760_000_000,
    claimed_at: 0,
    ...overrides,
  }
}

function makePending(items: RewardItem[], enabled = true): RewardPendingResult {
  const claimable = items.filter(
    (item) =>
      getRewardClaimState(item.status, item.claim_start_at, item.expires_at) ===
      'claimable'
  )
  return {
    enabled,
    count: items.length,
    total_quota: items.reduce((sum, item) => sum + item.amount_quota, 0),
    claimable_count: claimable.length,
    claimable_quota: claimable.reduce(
      (sum, item) => sum + item.amount_quota,
      0
    ),
    items,
    quota_per_unit: 500000,
  }
}

const EMPTY_HISTORY: RewardHistoryResult = {
  items: [],
  total: 0,
  page: 1,
  page_size: 20,
}

const CLAIMED: RewardClaimResult = {
  already_claimed: false,
  amount_quota: 500000,
  balance: 1500000,
  quota_per_unit: 500000,
}

function mockSuccess(pending: RewardPendingResult) {
  api.getPendingRewards.mockResolvedValue({ success: true, data: pending })
  api.getRewardHistory.mockResolvedValue({
    success: true,
    data: EMPTY_HISTORY,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RewardsPage', () => {
  it('renders one ticket per pending reward and the summed total', async () => {
    mockSuccess(
      makePending([
        makeReward({ id: 1, amount_quota: 500000 }),
        makeReward({
          id: 2,
          amount_quota: 1000000,
          campaign_name: 'Winter thanks',
          copy: { ...COPY, title: 'A second reward' },
        }),
      ])
    )

    render(<RewardsPage />)

    expect(await screen.findAllByTestId('reward-ticket')).toHaveLength(2)
    expect(screen.getByText('A second reward')).toBeInTheDocument()
    expect(
      screen.getByText('{{count}} rewards to claim'.replace('{{count}}', '2'))
    ).toBeInTheDocument()
  })

  it('shows the empty state when the operator issued nothing', async () => {
    mockSuccess(makePending([]))

    render(<RewardsPage />)

    expect(await screen.findByText('No rewards to claim')).toBeInTheDocument()
    expect(screen.queryAllByTestId('reward-ticket')).toHaveLength(0)
  })

  it('explains that the feature is off instead of showing an empty list', async () => {
    mockSuccess(makePending([], false))

    render(<RewardsPage />)

    expect(
      await screen.findByText('Reward feature is not enabled')
    ).toBeInTheDocument()
    expect(screen.queryByText('No rewards to claim')).not.toBeInTheDocument()
  })

  it('disables the claim button once the deadline has passed', async () => {
    mockSuccess(
      makePending([
        makeReward({ status: 'pending', expires_at: 1_600_000_000 }),
      ])
    )

    render(<RewardsPage />)

    const button = await screen.findByRole('button', { name: 'Expired' })
    expect(button).toBeDisabled()
  })

  it('shows a scheduled reward without letting the user claim it early', async () => {
    const startAt = Math.floor(Date.now() / 1000) + 3600
    mockSuccess(makePending([makeReward({ claim_start_at: startAt })]))

    render(<RewardsPage />)

    const button = await screen.findByRole('button', { name: 'Not Started' })
    expect(button).toBeDisabled()
    expect(screen.getByTestId('reward-ticket')).toBeInTheDocument()
    expect(
      screen.getByText(/^Claimable from \d{4}-\d{2}-\d{2}/)
    ).toBeInTheDocument()
  })

  it('leaves scheduled rewards out of the claimable total', async () => {
    const startAt = Math.floor(Date.now() / 1000) + 3600
    mockSuccess(
      makePending([
        makeReward({ id: 1, amount_quota: 500000 }),
        makeReward({ id: 2, amount_quota: 1000000, claim_start_at: startAt }),
      ])
    )

    render(<RewardsPage />)

    // 只有一张现在就能领，页头金额不能把预约的那张算进去
    expect(await screen.findByTestId('reward-pending-total')).toHaveTextContent(
      '$1'
    )
    expect(screen.getByTestId('reward-pending-total')).not.toHaveTextContent(
      '$3'
    )
    expect(
      screen.getByText('{{count}} rewards to claim'.replace('{{count}}', '1'))
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        '{{count}} more rewards will open for claiming later'.replace(
          '{{count}}',
          '1'
        )
      )
    ).toBeInTheDocument()
  })

  it('claims a reward, reports the new balance, and drops the ticket', async () => {
    const user = userEvent.setup()
    mockSuccess(makePending([makeReward()]))
    api.claimReward.mockResolvedValue({ success: true, data: CLAIMED })

    render(<RewardsPage />)

    await user.click(
      await screen.findByRole('button', { name: /Claim reward/ })
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('You have a reward')).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', { name: 'Claim reward' })
    )

    await waitFor(() => {
      expect(api.claimReward).toHaveBeenCalledWith(1)
    })
    expect(
      await within(dialog).findByText('Reward credited')
    ).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Done' }))

    await waitFor(() => {
      expect(screen.queryAllByTestId('reward-ticket')).toHaveLength(0)
    })
    expect(screen.getByText('No rewards to claim')).toBeInTheDocument()
  })

  it('reports a business failure inside the dialog instead of claiming success', async () => {
    const user = userEvent.setup()
    mockSuccess(makePending([makeReward()]))
    api.claimReward.mockResolvedValue({
      success: false,
      code: 'REWARD_ALREADY_CLAIMED',
      reason: 'already claimed',
    })

    render(<RewardsPage />)

    await user.click(
      await screen.findByRole('button', { name: /Claim reward/ })
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', { name: 'Claim reward' })
    )

    expect(
      await within(dialog).findByText('This reward has already been claimed')
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByText('Reward credited')
    ).not.toBeInTheDocument()
  })

  it('surfaces a failed pending request as an error state', async () => {
    api.getPendingRewards.mockResolvedValue({
      success: false,
      reason: 'boom',
    })
    api.getRewardHistory.mockResolvedValue({
      success: true,
      data: EMPTY_HISTORY,
    })

    render(<RewardsPage />)

    expect(await screen.findByText('boom')).toBeInTheDocument()
  })
})
