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

/**
 * Severity an announcement is published with. The set is fixed by the admin
 * editor, which only offers these five choices.
 */
export type AnnouncementType =
  | 'default'
  | 'ongoing'
  | 'success'
  | 'warning'
  | 'error'

export const ANNOUNCEMENT_TYPES: readonly AnnouncementType[] = [
  'default',
  'ongoing',
  'success',
  'warning',
  'error',
]

/**
 * One entry of `console_setting.announcements`, delivered through `/api/status`.
 *
 * The body is Markdown (the admin editor accepts it), `extra` is a short muted
 * note such as a deadline or a link label, and `publishDate` is the string the
 * operator picked in the date picker rather than a server timestamp.
 */
export interface AnnouncementItem {
  id?: number | string
  content: string
  publishDate?: string
  type?: AnnouncementType
  extra?: string
}

/** Narrow an arbitrary string from the status payload to a known type. */
export function toAnnouncementType(value?: string): AnnouncementType {
  const match = ANNOUNCEMENT_TYPES.find((type) => type === value)
  return match ?? 'default'
}
