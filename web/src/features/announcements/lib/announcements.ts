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
import type { AnnouncementItem, AnnouncementType } from '../types'

/**
 * Stable identity for the read-state store.
 *
 * Announcements come from an option string an admin edits by hand, so the
 * server-assigned `id` is the exception rather than the rule. Without a
 * content fingerprint an announcement would never un-read after being edited,
 * because the old key would still be marked as read.
 */
export function getAnnouncementReadKey(item: AnnouncementItem): string {
  if (item.id !== undefined && item.id !== null) return `id:${item.id}`

  const fingerprint = [
    item.publishDate ?? '',
    item.content.trim(),
    item.extra?.trim() ?? '',
    item.type ?? '',
  ].join('\u0000')

  let hash = 0
  for (let index = 0; index < fingerprint.length; index += 1) {
    hash = (hash << 5) - hash + fingerprint.charCodeAt(index)
    hash |= 0
  }
  return `hash:${hash.toString(36)}`
}

/**
 * Newest first.
 *
 * The backend already sorts, but the status payload is cached in localStorage
 * across releases and older copies are not guaranteed to be ordered, so the
 * page sorts what it is given instead of trusting the order it arrives in.
 */
export function sortAnnouncements(
  items: readonly AnnouncementItem[]
): AnnouncementItem[] {
  const time = (item: AnnouncementItem) => {
    const parsed = item.publishDate ? Date.parse(item.publishDate) : NaN
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return [...items].sort((left, right) => time(right) - time(left))
}

export interface AnnouncementFilter {
  /** Case-insensitive substring, matched against the body and the note. */
  query?: string
  /** `all` keeps every severity. */
  type?: AnnouncementType | 'all'
}

export function filterAnnouncements(
  items: readonly AnnouncementItem[],
  filter: AnnouncementFilter
): AnnouncementItem[] {
  const query = filter.query?.trim().toLowerCase() ?? ''
  const type = filter.type ?? 'all'

  return items.filter((item) => {
    if (type !== 'all' && (item.type ?? 'default') !== type) return false
    if (!query) return true
    const haystack = `${item.content}\n${item.extra ?? ''}`.toLowerCase()
    return haystack.includes(query)
  })
}

/** How many of `items` the operator has not opened yet. */
export function countUnread(
  items: readonly AnnouncementItem[],
  isRead: (key: string) => boolean
): number {
  return items.reduce(
    (total, item) => (isRead(getAnnouncementReadKey(item)) ? total : total + 1),
    0
  )
}
