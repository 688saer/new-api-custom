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
import { describe, expect, it } from 'vitest'

import { RewardTicket } from '../components/reward-ticket'
import type { RewardTicketCopy } from '../types'

const COPY: RewardTicketCopy = {
  label: 'New API',
  title: '感谢你的支持',
  subtitle: '每一次创造，都值得被支持。',
  footer: '奖励金可用于本站模型调用',
  stub_text: '专属奖励',
  stub_font_size: 28,
  button_text: '领取奖励金',
}

function renderTicket(overrides: Partial<RewardTicketCopy> = {}) {
  render(
    <RewardTicket
      style='aurora'
      copy={{ ...COPY, ...overrides }}
      amount='$5.00'
    />
  )
  return screen.getByTestId('reward-ticket')
}

describe('reward ticket decoration', () => {
  it('draws exactly one punch notch at the top and one at the bottom of the stub seam', () => {
    renderTicket()
    expect(screen.getAllByTestId('reward-ticket-notch')).toHaveLength(2)
  })

  it('renders one perforation column along the stub seam', () => {
    renderTicket()
    expect(screen.getAllByTestId('reward-ticket-perforation')).toHaveLength(1)
  })

  it('renders one stub glyph per visible character and skips whitespace', () => {
    renderTicket({ stub_text: '专属 奖励' })
    const stub = screen.getByTestId('reward-ticket-stub')
    expect(stub.querySelectorAll('span')).toHaveLength(4)
    expect(stub.textContent).toBe('专属奖励')
  })

  it('shows the formatted amount as its own element', () => {
    renderTicket()
    expect(screen.getByTestId('reward-ticket-amount')).toHaveTextContent(
      '$5.00'
    )
  })

  it('still renders every decoration when the style is not recognised', () => {
    render(
      <RewardTicket style={'unknown' as 'aurora'} copy={COPY} amount='$1.00' />
    )
    expect(screen.getAllByTestId('reward-ticket-notch')).toHaveLength(2)
    expect(screen.getAllByTestId('reward-ticket-perforation')).toHaveLength(1)
  })
})
