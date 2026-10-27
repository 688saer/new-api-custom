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
import { describe, expect, it } from 'vitest'

import { NoticeCarousel } from '../components/notice-carousel'

const FIRST = 'Manage models, keys, usage and subscriptions in one place'
const SECOND = 'Compatible with OpenAI, Anthropic and Gemini API protocols'
const LAST = 'Create a separate API key for each tool and project'

describe('notice carousel', () => {
  it('starts on the first notice', () => {
    render(<NoticeCarousel />)

    expect(screen.getByText(FIRST)).toBeInTheDocument()
    expect(screen.queryByText(SECOND)).not.toBeInTheDocument()
  })

  it('advances to the next notice when the next control is used', async () => {
    render(<NoticeCarousel />)

    await userEvent.click(screen.getByRole('button', { name: 'Next notice' }))

    expect(screen.getByText(SECOND)).toBeInTheDocument()
    expect(screen.queryByText(FIRST)).not.toBeInTheDocument()
  })

  it('wraps to the last notice when stepping back from the first', async () => {
    render(<NoticeCarousel />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Previous notice' })
    )

    expect(screen.getByText(LAST)).toBeInTheDocument()
  })

  it('jumps to a notice through its indicator', async () => {
    render(<NoticeCarousel />)

    await userEvent.click(screen.getByRole('button', { name: 'Show notice 3' }))

    expect(screen.getByText(LAST)).toBeInTheDocument()
  })

  it('marks only the active indicator as current', async () => {
    render(<NoticeCarousel />)

    expect(
      screen.getByRole('button', { name: 'Show notice 1' })
    ).toHaveAttribute('aria-current', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Show notice 2' }))

    expect(
      screen.getByRole('button', { name: 'Show notice 2' })
    ).toHaveAttribute('aria-current', 'true')
    expect(
      screen.getByRole('button', { name: 'Show notice 1' })
    ).toHaveAttribute('aria-current', 'false')
  })

  it('exposes the announcement region with an accessible name', () => {
    render(<NoticeCarousel />)

    expect(
      screen.getByRole('complementary', { name: 'Site notices' })
    ).toBeInTheDocument()
  })
})
