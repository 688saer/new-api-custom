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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { AlipayQrDialog } from '../dialogs/alipay-qr-dialog'

const requestAlipayOrderStatus = vi.fn()

vi.mock('../../api', () => ({
  requestAlipayOrderStatus: (request: { trade_no: string }) =>
    requestAlipayOrderStatus(request),
}))

describe('AlipayQrDialog', () => {
  beforeEach(() => {
    requestAlipayOrderStatus.mockReset()
    requestAlipayOrderStatus.mockResolvedValue({ status: 'pending' })
  })

  test('shows the scanned code and the order number', () => {
    render(
      <AlipayQrDialog
        open
        onOpenChange={() => {}}
        qrCode='https://qr.alipay.com/bax01234'
        tradeNo='USR1NOABC123'
        onPaid={() => {}}
      />
    )

    expect(screen.getByText(/USR1NOABC123/)).toBeInTheDocument()
    expect(
      screen.getByText(/checked automatically every few seconds/i)
    ).toBeInTheDocument()
    expect(document.querySelector('svg')).not.toBeNull()
  })

  test('keeps the dialog open while the order is unpaid', async () => {
    const user = userEvent.setup()
    const onPaid = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <AlipayQrDialog
        open
        onOpenChange={onOpenChange}
        qrCode='https://qr.alipay.com/bax01234'
        tradeNo='USR1NOABC123'
        onPaid={onPaid}
      />
    )

    await user.click(
      screen.getByRole('button', { name: /Check payment status/ })
    )

    await waitFor(() =>
      expect(requestAlipayOrderStatus).toHaveBeenCalledWith({
        trade_no: 'USR1NOABC123',
      })
    )
    expect(onPaid).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  test('refreshes the wallet and closes once the payment is confirmed', async () => {
    const user = userEvent.setup()
    requestAlipayOrderStatus.mockResolvedValue({ status: 'success' })
    const onPaid = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <AlipayQrDialog
        open
        onOpenChange={onOpenChange}
        qrCode='https://qr.alipay.com/bax01234'
        tradeNo='USR1NOABC123'
        onPaid={onPaid}
      />
    )

    await user.click(
      screen.getByRole('button', { name: /Check payment status/ })
    )

    await waitFor(() => expect(onPaid).toHaveBeenCalledTimes(1))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
