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
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { STATUS_QUERY_KEY, type StatusData } from '@/lib/status-query'

import { GREETING_PORTRAIT, MASCOT_PORTRAITS } from '../portraits'
import { SiteMascot } from '../site-mascot'

let client: QueryClient

beforeEach(() => {
  localStorage.clear()
  client = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  })
  // jsdom implements neither media queries nor object URLs; both are incidental
  // to the behaviour under test but the component calls them on mount.
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  )
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  client.clear()
  // A test that fakes timers must not leave them installed: userEvent waits on
  // real ones and would hang instead of failing.
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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

  it('renders the character when enabled', () => {
    renderMascot({ mascot_enabled: true, mascot_name: '泡泡' })

    expect(screen.getByTestId('site-mascot')).toBeInTheDocument()
    expect(screen.getByTestId('site-mascot-character')).toBeInTheDocument()
  })

  it('names the greeting control after the configured mascot name', () => {
    renderMascot({ mascot_enabled: true, mascot_name: '泡泡' })

    expect(screen.getByRole('button', { name: /泡泡/ })).toBeInTheDocument()
  })

  it('hides the character and remembers the choice', async () => {
    const user = userEvent.setup()
    renderMascot({ mascot_enabled: true })

    await user.click(screen.getByRole('button', { name: /hide mascot/i }))

    expect(screen.queryByTestId('site-mascot')).not.toBeInTheDocument()
    expect(localStorage.getItem('mascot_hidden')).toBe('1')
  })

  it('stays hidden after a remount once dismissed', () => {
    localStorage.setItem('mascot_hidden', '1')

    renderMascot({ mascot_enabled: true })

    expect(screen.queryByTestId('site-mascot')).not.toBeInTheDocument()
  })

  it('grows the bubble away from the configured edge', async () => {
    const user = userEvent.setup()
    renderMascot({
      mascot_enabled: true,
      mascot_name: '泡泡',
      mascot_placement: 'bottom-left',
    })

    await user.click(screen.getByRole('button', { name: /泡泡/ }))

    // The character is always laid out at the viewport origin and placed by its
    // transform, so the corner choice is visible on the bubble alignment:
    // docked left, the bubble must grow rightwards rather than off screen.
    const bubble = screen.getByTestId('site-mascot-bubble')
    expect(bubble.className).toContain('left-0')
    expect(bubble.className).not.toContain('right-0')
  })

  it('keeps the bubble anchored to the right edge by default', async () => {
    const user = userEvent.setup()
    renderMascot({ mascot_enabled: true, mascot_name: '泡泡' })

    await user.click(screen.getByRole('button', { name: /泡泡/ }))

    expect(screen.getByTestId('site-mascot-bubble').className).toContain('right-0')
  })

  it('reacts to a click with a portrait that is not the greeting one', async () => {
    const user = userEvent.setup()
    renderMascot({ mascot_enabled: true, mascot_name: '泡泡' })

    await user.click(screen.getByRole('button', { name: /泡泡/ }))

    const portrait = screen.getByTestId('site-mascot-portrait')
    const reactionIds = MASCOT_PORTRAITS.filter(
      (candidate) => candidate.id !== GREETING_PORTRAIT.id
    ).map((candidate) => `/mascot/portraits/${candidate.id}.png`)
    expect(reactionIds).toContain(portrait.getAttribute('src'))
    // Decorative: the character's name and greeting already carry the meaning.
    expect(portrait).toHaveAttribute('aria-hidden', 'true')
  })

  it('uses the greeting portrait for the first-visit greeting', async () => {
    vi.useFakeTimers()
    renderMascot({ mascot_enabled: true, mascot_name: '泡泡' })

    // The greeting waits for the config, then a short delay, so it never flashes
    // fallback text.
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByTestId('site-mascot-portrait')).toHaveAttribute(
      'src',
      `/mascot/portraits/${GREETING_PORTRAIT.id}.png`
    )
  })

  it('opens the greeting bubble when the character is activated', async () => {
    const user = userEvent.setup()
    renderMascot({
      mascot_enabled: true,
      mascot_name: '泡泡',
      mascot_greeting: '你好呀',
    })

    const trigger = screen.getByRole('button', { name: /泡泡/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('site-mascot-bubble')).toHaveTextContent('你好呀')
  })

  it('stops the running clip when reduced motion is turned on mid-session', async () => {
    // The preference can change while the page is open. Guarding the clip chain
    // alone would let an already-playing clip keep running, so the player has to
    // pause the elements that are already on screen.
    let reduceMotion = false
    const listeners: Array<() => void> = []
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        get matches() {
          return reduceMotion
        },
        addEventListener: (_event: string, handler: () => void) => listeners.push(handler),
        removeEventListener: vi.fn(),
      })
    )

    renderMascot({ mascot_enabled: true, mascot_name: '泡泡' })

    // jsdom has no media pipeline, so watch the calls the player makes instead.
    const pauseSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, 'pause')
      .mockImplementation(() => {})

    reduceMotion = true
    await act(async () => {
      for (const listener of listeners) listener()
    })

    expect(pauseSpy).toHaveBeenCalled()
  })

  it('closes the bubble on Escape', async () => {
    const user = userEvent.setup()
    renderMascot({ mascot_enabled: true, mascot_name: '泡泡' })

    await user.click(screen.getByRole('button', { name: /泡泡/ }))
    expect(screen.getByTestId('site-mascot-bubble')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(screen.queryByTestId('site-mascot-bubble')).not.toBeInTheDocument()
  })
})
