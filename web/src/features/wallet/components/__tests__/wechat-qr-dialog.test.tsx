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
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { WechatQrDialog } from '../dialogs/wechat-qr-dialog'

const requestWechatOrderStatus = vi.fn()

vi.mock('../../api', () => ({
  requestWechatOrderStatus: (request: { trade_no: string }) =>
    requestWechatOrderStatus(request),
}))

const CODE_URL = 'weixin://wxpay/bizpayurl?pr=test123'

function mockUserAgent(value: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value,
    configurable: true,
  })
}

describe('WechatQrDialog', () => {
  const originalUserAgent = window.navigator.userAgent

  beforeEach(() => {
    requestWechatOrderStatus.mockReset()
    requestWechatOrderStatus.mockResolvedValue({ status: 'pending' })
    mockUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36'
    )
  })

  afterEach(() => {
    mockUserAgent(originalUserAgent)
  })

  test('draws the weixin code and the order number on desktop', () => {
    render(
      <WechatQrDialog
        open
        onOpenChange={() => {}}
        codeUrl={CODE_URL}
        tradeNo='USR1NOABC123'
        onPaid={() => {}}
      />
    )

    expect(screen.getByText(/USR1NOABC123/)).toBeInTheDocument()
    expect(
      screen.getByText(/checked automatically every few seconds/i)
    ).toBeInTheDocument()
    expect(document.querySelector('svg')).not.toBeNull()
    // 桌面端不该出现唤起按钮，二维码才是主路径。
    expect(document.querySelector('a[href]')).toBeNull()
  })

  test('offers a one-tap WeChat link on phones', () => {
    mockUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
    )

    render(
      <WechatQrDialog
        open
        onOpenChange={() => {}}
        codeUrl={CODE_URL}
        tradeNo='USR1NOABC123'
        onPaid={() => {}}
      />
    )

    // 手机浏览器扫不了自己的屏幕，所以必须能一键跳进微信。
    const link = document.querySelector('a[href]')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe(CODE_URL)
  })

  test('keeps the dialog open while the order is unpaid', async () => {
    const user = userEvent.setup()
    const onPaid = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <WechatQrDialog
        open
        onOpenChange={onOpenChange}
        codeUrl={CODE_URL}
        tradeNo='USR1NOABC123'
        onPaid={onPaid}
      />
    )

    await user.click(
      screen.getByRole('button', { name: /Check payment status/ })
    )

    await waitFor(() =>
      expect(requestWechatOrderStatus).toHaveBeenCalledWith({
        trade_no: 'USR1NOABC123',
      })
    )
    expect(onPaid).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  test('refreshes the wallet and closes once the payment is confirmed', async () => {
    const user = userEvent.setup()
    requestWechatOrderStatus.mockResolvedValue({ status: 'success' })
    const onPaid = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <WechatQrDialog
        open
        onOpenChange={onOpenChange}
        codeUrl={CODE_URL}
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
