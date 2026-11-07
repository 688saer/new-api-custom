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
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { AlipayWithdrawDialog } from '../dialogs/alipay-withdraw-dialog'

describe('AlipayWithdrawDialog', () => {
  test('keeps submit disabled until account, name and a valid amount are entered', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockResolvedValue(true)

    render(
      <AlipayWithdrawDialog
        open
        onOpenChange={() => {}}
        onConfirm={onConfirm}
        availableQuota={1000000}
        feePercent={0}
        minQuota={0}
        submitting={false}
      />
    )

    const submit = screen.getByRole('button', { name: /Submit/ })
    expect(submit).toBeDisabled()

    await user.type(
      screen.getByLabelText('Alipay Account'),
      'alipay@example.com'
    )
    await user.type(screen.getByLabelText("Account Holder's Name"), '张三')
    expect(submit).not.toBeDisabled()

    await user.click(submit)
    expect(onConfirm).toHaveBeenCalledWith(
      expect.any(Number),
      'alipay@example.com',
      '张三'
    )
  })

  test('shows the estimated CNY payout for the current fee rate', () => {
    render(
      <AlipayWithdrawDialog
        open
        onOpenChange={() => {}}
        onConfirm={vi.fn().mockResolvedValue(true)}
        availableQuota={1000000}
        feePercent={10}
        minQuota={0}
        submitting={false}
      />
    )

    // Default store: 500000 quota per unit, USD rate 1. The initial amount is
    // the minimum (1 USD -> 500000 quota), so the payout is 450000 quota.
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByText('¥0.90')).toBeInTheDocument()
  })
})
