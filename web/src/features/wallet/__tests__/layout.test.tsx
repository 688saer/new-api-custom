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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Wallet } from '@/features/wallet'
import { api } from '@/lib/api'

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { children?: unknown }) => (
    <a href='/invoices'>{props.children as never}</a>
  ),
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: { price: 1 } }),
}))

vi.mock('@/hooks/use-system-config', () => ({
  useSystemConfig: () => ({
    currency: { quotaDisplayType: 'USD', usdExchangeRate: 1 },
  }),
}))

vi.mock('@/features/purchase-agreement', () => ({
  PurchaseAgreementGate: () => null,
  ensurePurchaseAgreement: async () => true,
}))

function planRecord(id: number, title: string) {
  return {
    plan: {
      id,
      title,
      subtitle: '',
      price_amount: 2,
      currency: 'USD',
      duration_unit: 'day',
      duration_value: 7,
      quota_reset_period: 'daily',
      token_limit: 100,
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

function mockWalletApis(options: {
  plans: unknown[]
  subscriptions?: unknown[]
}) {
  vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url.includes('/api/user/self')) {
      return Promise.resolve({
        data: {
          success: true,
          data: { quota: 100, used_quota: 20, request_count: 3 },
        },
      })
    }
    if (url.includes('/api/subscription/plans')) {
      return Promise.resolve({ data: { success: true, data: options.plans } })
    }
    if (url.includes('/api/subscription/self')) {
      return Promise.resolve({
        data: {
          success: true,
          data: {
            billing_preference: 'subscription_first',
            subscriptions: options.subscriptions || [],
            all_subscriptions: options.subscriptions || [],
            plan_purchase_counts: {},
          },
        },
      })
    }
    if (url.includes('/api/user/aff/withdrawals')) {
      return Promise.resolve({ data: { success: true, data: { items: [] } } })
    }
    return Promise.resolve({ data: { success: true, data: {} } })
  })
  vi.spyOn(api, 'post').mockResolvedValue({ data: { success: true, data: {} } })
}

function renderWallet() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Wallet />
    </QueryClientProvider>
  )
}

describe('wallet page sections', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('groups the cards into four labelled sections in reading order', async () => {
    mockWalletApis({ plans: [planRecord(1, 'Week card')] })

    renderWallet()

    const regions = await screen.findAllByRole('region')
    expect(
      regions.map((region) => region.getAttribute('aria-labelledby'))
    ).toEqual([
      'wallet-overview',
      'wallet-topup',
      'wallet-subscriptions',
      'wallet-referral',
    ])
    expect(regions[0]).toHaveAccessibleName('Account overview')
    expect(regions[2]).toHaveAccessibleName('Subscription Plans')
  })

  it('keeps the referral history inside the referral section', async () => {
    mockWalletApis({ plans: [planRecord(1, 'Week card')] })

    renderWallet()

    const referral = await screen.findByRole('region', {
      name: 'Referral rewards',
    })
    expect(within(referral).getByText('Withdrawal History')).toBeVisible()
  })

  it('keeps the top-up anchor and the redemption input in the top-up section', async () => {
    mockWalletApis({ plans: [planRecord(1, 'Week card')] })

    renderWallet()

    const topup = await screen.findByRole('region', { name: 'Top up & redeem' })
    expect(topup.querySelector('#wallet-add-funds')).not.toBeNull()
    expect(
      within(topup).getByPlaceholderText('Enter your redemption code')
    ).toBeVisible()
  })

  it('drops the subscription section when the store sells no plans', async () => {
    mockWalletApis({ plans: [] })

    renderWallet()

    await screen.findByRole('region', { name: 'Account overview' })
    await waitFor(() => {
      expect(
        screen.queryByRole('region', { name: 'Subscription Plans' })
      ).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('region', { name: 'Top up & redeem' })
    ).toBeVisible()
  })
})
