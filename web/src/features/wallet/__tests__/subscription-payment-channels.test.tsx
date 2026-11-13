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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SubscriptionPlansCard } from '@/features/wallet/components/subscription-plans-card'
import type { TopupInfo } from '@/features/wallet/types'
import { api } from '@/lib/api'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: { value: string }) => (
    <div data-testid='qr-code'>{props.value}</div>
  ),
}))

const baseTopupInfo: TopupInfo = {
  enable_online_topup: false,
  enable_stripe_topup: false,
  pay_methods: [],
  min_topup: 1,
  stripe_min_topup: 1,
  amount_options: [],
  discount: {},
}

function planRecord(stripePriceId: string) {
  return {
    plan: {
      id: 1,
      title: 'Week card',
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
      stripe_price_id: stripePriceId,
    },
  }
}

function mockApis(plan: unknown) {
  vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url.includes('/api/subscription/plans')) {
      return Promise.resolve({ data: { success: true, data: [plan] } })
    }
    if (url.includes('/api/status')) {
      return Promise.resolve({ data: { success: true, data: {} } })
    }
    return Promise.resolve({
      data: {
        success: true,
        data: {
          billing_preference: 'subscription_first',
          subscriptions: [],
          all_subscriptions: [],
        },
      },
    })
  })
}

async function openPurchaseDialog(topupInfo: TopupInfo) {
  const user = userEvent.setup()
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SubscriptionPlansCard topupInfo={topupInfo} userQuota={1000000} />
    </QueryClientProvider>
  )
  await user.click(await screen.findByRole('button', { name: 'Subscribe Now' }))
  return screen.findByRole('dialog')
}

describe('subscription plan payment channels', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('offers Stripe for a plan when only the subscription gateway is configured', async () => {
    mockApis(planRecord('price_123'))

    const dialog = await openPurchaseDialog({
      ...baseTopupInfo,
      enable_stripe_topup: false,
      enable_stripe_subscription: true,
    })

    expect(await screen.findByRole('button', { name: 'Stripe' })).toBeVisible()
    expect(
      screen.queryByText(/Online payment is not configured/)
    ).not.toBeInTheDocument()
    expect(dialog).toBeVisible()
  })

  it('keeps the Stripe button when an older backend only reports the top-up flag', async () => {
    mockApis(planRecord('price_123'))

    await openPurchaseDialog({
      ...baseTopupInfo,
      enable_stripe_topup: true,
    })

    expect(await screen.findByRole('button', { name: 'Stripe' })).toBeVisible()
  })

  it('explains that only balance payment works when no gateway is usable', async () => {
    mockApis(planRecord(''))

    await openPurchaseDialog({ ...baseTopupInfo })

    expect(
      await screen.findByText(/Online payment is not configured/)
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Stripe' })
    ).not.toBeInTheDocument()
  })

  it('offers the official Alipay channel and opens its QR when the plan is paid by scan', async () => {
    const payload = planRecord('')
    mockApis(payload)
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        message: 'success',
        qr_code: 'https://qr.alipay.com/abc',
        trade_no: 'SUB1',
      },
    } as never)

    const user = userEvent.setup()
    await openPurchaseDialog({
      ...baseTopupInfo,
      enable_alipay_topup: true,
      enable_alipay_subscription: true,
    })

    await user.click(await screen.findByRole('button', { name: 'Alipay' }))

    expect(post).toHaveBeenCalledWith(
      '/api/subscription/alipay/pay',
      expect.objectContaining({ plan_id: 1, renew_mode: 'extend' }),
      expect.anything()
    )
    expect(
      await screen.findByText('https://qr.alipay.com/abc')
    ).toBeInTheDocument()
  })

  it('offers the official WeChat channel and opens its QR from the native code url', async () => {
    mockApis(planRecord(''))
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        message: 'success',
        code_url: 'weixin://wxpay/native',
        trade_no: 'SUB2',
      },
    } as never)

    const user = userEvent.setup()
    await openPurchaseDialog({
      ...baseTopupInfo,
      enable_wechat_topup: true,
      enable_wechat_subscription: true,
    })

    await user.click(await screen.findByRole('button', { name: 'WeChat Pay' }))

    expect(post).toHaveBeenCalledWith(
      '/api/subscription/wechat/pay',
      expect.objectContaining({ plan_id: 1 }),
      expect.anything()
    )
    expect(await screen.findByText('weixin://wxpay/native')).toBeInTheDocument()
  })
})
