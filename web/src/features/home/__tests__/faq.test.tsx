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

import { Faq } from '../components/sections/faq'

const FIRST_QUESTION = 'What is an AI gateway?'

describe('home faq', () => {
  it('renders every question as a collapsed disclosure', () => {
    render(<Faq />)

    const triggers = screen.getAllByRole('button')

    expect(triggers).toHaveLength(5)
    for (const trigger of triggers) {
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    }
  })

  it('reveals the answer when a question is opened', async () => {
    render(<Faq />)

    await userEvent.click(screen.getByRole('button', { name: FIRST_QUESTION }))

    expect(
      screen.getByRole('button', { name: FIRST_QUESTION })
    ).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByText(/single layer between your application/)
    ).toBeVisible()
  })

  it('collapses the answer again when the question is clicked twice', async () => {
    render(<Faq />)

    const trigger = screen.getByRole('button', { name: FIRST_QUESTION })
    await userEvent.click(trigger)
    await userEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByText(/single layer between your application/)
    ).not.toBeInTheDocument()
  })
})
