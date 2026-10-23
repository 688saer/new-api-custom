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
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { STATUS_QUERY_KEY, type StatusData } from '@/lib/status-query'

import { SiteMascot } from '../site-mascot'

let client: QueryClient

beforeEach(() => {
  localStorage.clear()
  client = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  })
})

afterEach(() => {
  cleanup()
  client.clear()
  localStorage.clear()
})

function renderMascot(status: Partial<StatusData>) {
  client.setQueryData(STATUS_QUERY_KEY, status as StatusData)
  return render(
    <QueryClientProvider client={client}>
      <SiteMascot />
    </QueryClientProvider>
  )
}

describe('site mascot', () => {
  it('renders nothing when the operator turned it off', () => {
    renderMascot({ mascot_enabled: false })

    expect(screen.queryByTestId('site-mascot')).not.toBeInTheDocument()
  })

  it('shows the greeting bubble once and remembers it for the next visit', async () => {
    const view = renderMascot({
      mascot_enabled: true,
      mascot_greeting: 'Hello from the whale',
    })

    await waitFor(() => {
      expect(screen.getByTestId('site-mascot-bubble')).toBeInTheDocument()
    })
    expect(screen.getByText('Hello from the whale')).toBeInTheDocument()
    expect(localStorage.getItem('mascot_greeted')).toBe('1')

    view.unmount()
    renderMascot({
      mascot_enabled: true,
      mascot_greeting: 'Hello from the whale',
    })

    await new Promise((resolve) => setTimeout(resolve, 1400))
    expect(screen.queryByTestId('site-mascot-bubble')).not.toBeInTheDocument()
  })

  it('places the character in the configured corner', async () => {
    renderMascot({ mascot_enabled: true, mascot_placement: 'bottom-left' })

    const root = screen.getByTestId('site-mascot')
    expect(root.className).toContain('left-4')
    expect(root.className).not.toContain('right-4')
  })

  it('hides the mascot for good when the visitor dismisses it', async () => {
    const user = userEvent.setup()
    const view = renderMascot({ mascot_enabled: true })

    await user.click(screen.getByRole('button', { name: /hide/i }))

    expect(screen.queryByTestId('site-mascot')).not.toBeInTheDocument()
    expect(localStorage.getItem('mascot_hidden')).toBe('1')

    view.unmount()
    renderMascot({ mascot_enabled: true })

    expect(screen.queryByTestId('site-mascot')).not.toBeInTheDocument()
  })

  it('toggles the bubble from the character and exposes the expanded state', async () => {
    localStorage.setItem('mascot_greeted', '1')
    const user = userEvent.setup()
    renderMascot({
      mascot_enabled: true,
      mascot_name: '泡泡',
      mascot_greeting: 'Need anything?',
    })

    const trigger = screen.getByTestId('site-mascot-trigger')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    // The name is the only thing announcing the character, so it must carry
    // the configured label rather than a generic one.
    expect(trigger).toHaveAccessibleName(/泡泡/)

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Need anything?')).toBeInTheDocument()

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the greeting on Escape', async () => {
    localStorage.setItem('mascot_greeted', '1')
    const user = userEvent.setup()
    renderMascot({ mascot_enabled: true, mascot_greeting: 'Hi there' })

    await user.click(screen.getByTestId('site-mascot-trigger'))
    expect(screen.getByTestId('site-mascot-bubble')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByTestId('site-mascot-bubble')).not.toBeInTheDocument()
  })
})
