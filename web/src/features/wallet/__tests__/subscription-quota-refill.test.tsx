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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SubscriptionPlansCard } from '@/features/wallet/components/subscription-plans-card'
import type { TopupInfo } from '@/features/wallet/types'
import { api } from '@/lib/api'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const DAY = 24 * 60 * 60

const topupInfo: TopupInfo = {
  enable_online_topup: false,
  enable_stripe_topup: false,
  pay_methods: [],
  min_topup: 1,
  stripe_min_topup: 1,
  amount_options: [],
  discount: {},
}

function planRecord(options: {
  id: number
  title: string
  resetPeriod: string
  tokenLimit: number
}) {
  return {
    plan: {
      id: options.id,
      title: options.title,
      subtitle: '',
      price_amount: 2,
      currency: 'USD',
      duration_unit: 'day',
      duration_value: 7,
      quota_reset_period: options.resetPeriod,
      token_limit: options.tokenLimit,
      allowed_models: [],
      enabled: true,
      sort_order: 0,
      allow_balance_pay: true,
      allow_wallet_overflow: true,
      max_purchase_per_user: 0,
      total_amount: 0,
    },
  }
}

function subscriptionRecord(options: {
  id: number
  planId: number
  secondsLeft: number
  tokenUsed: number
  tokenLimit: number
}) {
  const now = Math.floor(Date.now() / 1000)
  return {
    subscription: {
      id: options.id,
      user_id: 1,
      plan_id: options.planId,
      status: 'active',
      start_time: now - 2 * DAY,
      end_time: now + options.secondsLeft,
      amount_total: 0,
      amount_used: 0,
      token_limit_total: options.tokenLimit,
      token_used: options.tokenUsed,
      next_reset_time: now + 3600,
      allowed_models: [],
    },
  }
}

function mockApis(plans: unknown[], subscriptions: unknown[]) {
  vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url.includes('/api/subscription/plans')) {
      return Promise.resolve({ data: { success: true, data: plans } })
    }
    if (url.includes('/api/status')) {
      return Promise.resolve({ data: { success: true, data: {} } })
    }
    return Promise.resolve({
      data: {
        success: true,
        data: {
          billing_preference: 'subscription_first',
          subscriptions,
          all_subscriptions: subscriptions,
        },
      },
    })
  })
}

async function renderCard() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SubscriptionPlansCard topupInfo={topupInfo} userQuota={1000000} />
    </QueryClientProvider>
  )
  await screen.findByText(/Subscription #/)
}

describe('subscription allowance refill', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('offers the refill button on an exhausted daily allowance with days left', async () => {
    mockApis(
      [
        planRecord({
          id: 1,
          title: 'Week card',
          resetPeriod: 'daily',
          tokenLimit: 100,
        }),
      ],
      [
        subscriptionRecord({
          id: 7,
          planId: 1,
          secondsLeft: 5 * DAY,
          tokenUsed: 100,
          tokenLimit: 100,
        }),
      ]
    )

    await renderCard()

    expect(
      screen.getByRole('button', { name: /Refill allowance \(spends 1 days\)/ })
    ).toBeVisible()
  })

  it('still offers the refill button while the allowance has room left', async () => {
    mockApis(
      [
        planRecord({
          id: 1,
          title: 'Week card',
          resetPeriod: 'daily',
          tokenLimit: 100,
        }),
      ],
      [
        subscriptionRecord({
          id: 7,
          planId: 1,
          secondsLeft: 5 * DAY,
          tokenUsed: 10,
          tokenLimit: 100,
        }),
      ]
    )

    await renderCard()

    expect(
      screen.getByRole('button', { name: /Refill allowance \(spends 1 days\)/ })
    ).toBeVisible()
  })

  it('hides the refill button when the card has one day or less left', async () => {
    mockApis(
      [
        planRecord({
          id: 1,
          title: 'Week card',
          resetPeriod: 'daily',
          tokenLimit: 100,
        }),
      ],
      [
        subscriptionRecord({
          id: 7,
          planId: 1,
          secondsLeft: DAY / 2,
          tokenUsed: 100,
          tokenLimit: 100,
        }),
      ]
    )

    await renderCard()

    expect(
      screen.queryByRole('button', { name: /Refill allowance \(spends/ })
    ).not.toBeInTheDocument()
  })

  it('hides the refill button for a plan that never resets its allowance', async () => {
    mockApis(
      [
        planRecord({
          id: 1,
          title: 'One shot',
          resetPeriod: 'never',
          tokenLimit: 100,
        }),
      ],
      [
        subscriptionRecord({
          id: 7,
          planId: 1,
          secondsLeft: 5 * DAY,
          tokenUsed: 100,
          tokenLimit: 100,
        }),
      ]
    )

    await renderCard()

    expect(
      screen.queryByRole('button', { name: /Refill allowance \(spends/ })
    ).not.toBeInTheDocument()
  })

  it('charges a whole week when the plan resets weekly', async () => {
    mockApis(
      [
        planRecord({
          id: 1,
          title: 'Four weeks',
          resetPeriod: 'weekly',
          tokenLimit: 400,
        }),
      ],
      [
        subscriptionRecord({
          id: 7,
          planId: 1,
          secondsLeft: 10 * DAY,
          tokenUsed: 400,
          tokenLimit: 400,
        }),
      ]
    )

    await renderCard()

    expect(
      screen.getByRole('button', { name: /Refill allowance \(spends 7 days\)/ })
    ).toBeVisible()
  })

  it('hides the weekly refill button when less than a week remains', async () => {
    mockApis(
      [
        planRecord({
          id: 1,
          title: 'Four weeks',
          resetPeriod: 'weekly',
          tokenLimit: 400,
        }),
      ],
      [
        subscriptionRecord({
          id: 7,
          planId: 1,
          secondsLeft: 6 * DAY,
          tokenUsed: 400,
          tokenLimit: 400,
        }),
      ]
    )

    await renderCard()

    expect(
      screen.queryByRole('button', { name: /Refill allowance \(spends/ })
    ).not.toBeInTheDocument()
  })

  it('spends one reset period through the self endpoint after confirmation', async () => {
    const user = userEvent.setup()
    mockApis(
      [
        planRecord({
          id: 1,
          title: 'Week card',
          resetPeriod: 'daily',
          tokenLimit: 100,
        }),
      ],
      [
        subscriptionRecord({
          id: 7,
          planId: 1,
          secondsLeft: 5 * DAY,
          tokenUsed: 100,
          tokenLimit: 100,
        }),
      ]
    )
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, message: 'Allowance refilled' },
    })

    await renderCard()
    await user.click(
      screen.getByRole('button', { name: /Refill allowance \(spends 1 days\)/ })
    )

    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/card validity/)).toBeInTheDocument()

    await user.click(
      within(dialog).getByRole('button', { name: /Refill now \(spends 1 days\)/ })
    )

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/api/subscription/self/reset_quota', {
        user_subscription_id: 7,
      })
    })
  })
})
