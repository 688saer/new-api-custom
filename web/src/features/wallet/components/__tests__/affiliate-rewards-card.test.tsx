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
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import type { UserWalletData } from '../../types'
import { AffiliateRewardsCard } from '../affiliate-rewards-card'

const baseUser: UserWalletData = {
  id: 1,
  username: 'alice',
  quota: 500000,
  used_quota: 0,
  request_count: 0,
  aff_quota: 0,
  aff_history_quota: 0,
  aff_count: 0,
  group: 'default',
}

function renderCard(overrides: Partial<UserWalletData> = {}) {
  const onTransfer = vi.fn()
  const onWithdrawAlipay = vi.fn()

  render(
    <AffiliateRewardsCard
      user={{ ...baseUser, ...overrides }}
      affiliateLink='https://example.com/sign-up?aff=u7M5'
      onTransfer={onTransfer}
      onWithdrawAlipay={onWithdrawAlipay}
      complianceConfirmed
    />
  )

  return { onTransfer, onWithdrawAlipay }
}

describe('AffiliateRewardsCard', () => {
  test('always shows the invite count and total income in yuan with two decimals', () => {
    renderCard({ aff_count: 3, aff_history_quota: 1500000, aff_quota: 500000 })

    expect(screen.getByText('Invites')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Total Earned')).toBeInTheDocument()
    expect(screen.getByText('$3.00')).toBeInTheDocument()
    expect(screen.getByText('$1.00')).toBeInTheDocument()
  })

  test('keeps the transfer and withdrawal entries visible without rewards', () => {
    renderCard({ aff_quota: 0, aff_withdraw_alipay_enabled: true })

    expect(
      screen.getByRole('button', { name: 'Transfer to Balance' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Withdraw to Alipay' })
    ).toBeDisabled()
    expect(
      screen.getByText(
        'Referral rewards become available for withdrawal after you earn them.'
      )
    ).toBeInTheDocument()
  })

  test('enables the entries once referral rewards are available', () => {
    renderCard({ aff_quota: 500000, aff_withdraw_alipay_enabled: true })

    expect(
      screen.getByRole('button', { name: 'Transfer to Balance' })
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Withdraw to Alipay' })
    ).toBeEnabled()
  })
})
