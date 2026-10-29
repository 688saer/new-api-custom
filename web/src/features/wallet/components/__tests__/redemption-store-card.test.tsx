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
import { describe, expect, it, vi } from 'vitest'

import { RedemptionStoreCard } from '../redemption-store-card'

describe('RedemptionStoreCard', () => {
  it('renders nothing when there is no purchase link', () => {
    const { container } = render(<RedemptionStoreCard />)

    expect(container).toBeEmptyDOMElement()
  })

  it('opens the purchase page in a new tab when buying', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const user = userEvent.setup()

    render(<RedemptionStoreCard topupLink='https://shop.example.com/code' />)
    await user.click(screen.getByRole('button', { name: /Buy now/ }))

    expect(openSpy).toHaveBeenCalledWith(
      'https://shop.example.com/code',
      '_blank',
      'noopener,noreferrer'
    )
    openSpy.mockRestore()
  })

  it('focuses the redemption input when the user already has a code', async () => {
    const user = userEvent.setup()
    const input = document.createElement('input')
    input.id = 'redemption-code'
    document.body.appendChild(input)

    render(<RedemptionStoreCard topupLink='https://shop.example.com/code' />)
    await user.click(screen.getByRole('button', { name: /I have a code/ }))

    expect(document.activeElement).toBe(input)
    input.remove()
  })
})
