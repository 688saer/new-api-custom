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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { useNotificationStore } from '@/stores/notification-store'

import { AnnouncementsPage } from '../components/announcements-page'
import type { AnnouncementItem } from '../types'

// The detail dialog renders a Base UI ScrollArea, whose viewport measures
// running animations on mount. jsdom implements neither, so the dialog test
// would fail on that unhandled error instead of the behaviour it checks.
const getAnimationsDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})

afterAll(() => {
  if (getAnimationsDescriptor) {
    Object.defineProperty(
      HTMLElement.prototype,
      'getAnimations',
      getAnimationsDescriptor
    )
    return
  }
  Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
})

const statusState = vi.hoisted(() => ({
  value: {
    status: null as Record<string, unknown> | null,
    loading: false,
  },
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => statusState.value,
}))

const ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 2,
    content: 'Scheduled maintenance on Sunday',
    extra: 'Sunday 02:00 UTC',
    publishDate: '2026-10-01T00:00:00Z',
    type: 'warning',
  },
  {
    id: 1,
    content: 'GPT-5 is now available',
    publishDate: '2026-05-01T00:00:00Z',
    type: 'success',
  },
]

function setStatus(announcements: AnnouncementItem[] | undefined) {
  statusState.value = {
    status: {
      announcements_enabled: announcements !== undefined,
      announcements,
    },
    loading: false,
  }
}

function renderPage() {
  return render(<AnnouncementsPage />)
}

beforeEach(() => {
  useNotificationStore.setState({ readAnnouncementKeys: [] })
  localStorage.clear()
  setStatus(ANNOUNCEMENTS)
})

describe('AnnouncementsPage', () => {
  it('lists every announcement with the newest one first', () => {
    renderPage()

    const items = screen.getAllByRole('button', { name: /Scheduled|GPT-5/ })

    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Scheduled maintenance on Sunday')
    expect(items[1]).toHaveTextContent('GPT-5 is now available')
  })

  it('shows the unread count and clears it once everything is marked read', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByTestId('announcements-unread-count')).toHaveTextContent(
      '2 unread'
    )

    await user.click(screen.getByRole('button', { name: 'Mark all as read' }))

    expect(
      screen.queryByTestId('announcements-unread-count')
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Mark all as read' })
    ).toBeDisabled()
    expect(useNotificationStore.getState().readAnnouncementKeys).toEqual([
      'id:2',
      'id:1',
    ])
  })

  it('narrows the list by keyword and reports how much is hidden', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Search announcements'), 'gpt')

    expect(screen.getByText('GPT-5 is now available')).toBeInTheDocument()
    expect(
      screen.queryByText('Scheduled maintenance on Sunday')
    ).not.toBeInTheDocument()
    expect(
      screen.getByTestId('announcements-filter-summary')
    ).toHaveTextContent('Showing 1 of 2')
  })

  it('offers a reset when the filters match nothing', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByLabelText('Search announcements'), 'zzz')

    expect(
      screen.getByText('No announcements match your filters')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(screen.getByLabelText('Search announcements')).toHaveValue('')
    expect(screen.getByText('GPT-5 is now available')).toBeInTheDocument()
  })

  it('marks an announcement read and opens its detail dialog on click', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(
      screen.getByRole('button', { name: /GPT-5 is now available/ })
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Announcement Details')).toBeInTheDocument()
    expect(dialog).toHaveTextContent('GPT-5 is now available')
    expect(useNotificationStore.getState().readAnnouncementKeys).toEqual([
      'id:1',
    ])
  })

  it('explains that the panel is off instead of showing an empty list', () => {
    setStatus(undefined)
    renderPage()

    expect(screen.getByText('Announcements are turned off')).toBeInTheDocument()
    expect(
      screen.queryByLabelText('Search announcements')
    ).not.toBeInTheDocument()
  })
})
