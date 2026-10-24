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
import { describe, expect, it } from 'vitest'

import {
  countUnread,
  filterAnnouncements,
  getAnnouncementReadKey,
  sortAnnouncements,
} from '../lib/announcements'
import type { AnnouncementItem } from '../types'

function item(overrides: Partial<AnnouncementItem> = {}): AnnouncementItem {
  return { content: 'Body', ...overrides }
}

describe('getAnnouncementReadKey', () => {
  it('prefers the server id when one exists', () => {
    expect(getAnnouncementReadKey(item({ id: 7 }))).toBe('id:7')
  })

  it('fingerprints the body when the operator authored no id', () => {
    const key = getAnnouncementReadKey(
      item({ content: 'Maintenance', publishDate: '2026-10-01T00:00:00Z' })
    )

    expect(key.startsWith('hash:')).toBe(true)
    expect(key).toBe(
      getAnnouncementReadKey({
        content: 'Maintenance',
        publishDate: '2026-10-01T00:00:00Z',
      })
    )
  })

  it('changes when the body is edited so an edited notice reads as unread', () => {
    const before = getAnnouncementReadKey(item({ content: 'Old body' }))
    const after = getAnnouncementReadKey(item({ content: 'New body' }))

    expect(after).not.toBe(before)
  })
})

describe('sortAnnouncements', () => {
  it('returns newest first', () => {
    const sorted = sortAnnouncements([
      item({ content: 'middle', publishDate: '2026-05-01T00:00:00Z' }),
      item({ content: 'oldest', publishDate: '2026-01-01T00:00:00Z' }),
      item({ content: 'newest', publishDate: '2026-10-01T00:00:00Z' }),
    ])

    expect(sorted.map((entry) => entry.content)).toEqual([
      'newest',
      'middle',
      'oldest',
    ])
  })

  it('keeps entries without a usable date at the end and leaves the input alone', () => {
    const input = [
      item({ content: 'undated' }),
      item({ content: 'dated', publishDate: '2026-01-01T00:00:00Z' }),
      item({ content: 'broken', publishDate: 'not a date' }),
    ]

    const sorted = sortAnnouncements(input)

    expect(sorted.map((entry) => entry.content)).toEqual([
      'dated',
      'undated',
      'broken',
    ])
    expect(input.map((entry) => entry.content)).toEqual([
      'undated',
      'dated',
      'broken',
    ])
  })
})

describe('filterAnnouncements', () => {
  const list = [
    item({ content: 'Model gpt-5 is live', type: 'success' }),
    item({
      content: 'Scheduled maintenance',
      extra: 'Sunday 02:00',
      type: 'warning',
    }),
    item({ content: 'Nothing to see' }),
  ]

  it('keeps everything for the default filter', () => {
    expect(filterAnnouncements(list, {})).toHaveLength(3)
  })

  it('matches the body and the extra note case-insensitively', () => {
    expect(
      filterAnnouncements(list, { query: 'GPT' }).map((entry) => entry.content)
    ).toEqual(['Model gpt-5 is live'])
    expect(
      filterAnnouncements(list, { query: 'sunday' }).map(
        (entry) => entry.content
      )
    ).toEqual(['Scheduled maintenance'])
  })

  it('filters by severity and treats a missing type as default', () => {
    expect(
      filterAnnouncements(list, { type: 'warning' }).map(
        (entry) => entry.content
      )
    ).toEqual(['Scheduled maintenance'])
    expect(
      filterAnnouncements(list, { type: 'default' }).map(
        (entry) => entry.content
      )
    ).toEqual(['Nothing to see'])
  })

  it('combines the keyword and the severity', () => {
    expect(
      filterAnnouncements(list, { query: 'model', type: 'warning' })
    ).toEqual([])
  })
})

describe('countUnread', () => {
  it('counts the entries the reader has not opened yet', () => {
    const list = [
      item({ id: 1, content: 'one' }),
      item({ id: 2, content: 'two' }),
      item({ id: 3, content: 'three' }),
    ]

    expect(countUnread(list, (key) => key === 'id:1')).toBe(2)
    expect(countUnread(list, () => true)).toBe(0)
    expect(countUnread([], () => false)).toBe(0)
  })
})
