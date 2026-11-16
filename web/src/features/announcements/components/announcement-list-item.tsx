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
import { useTranslation } from 'react-i18next'

import { RichContent } from '@/components/rich-content'
import { Badge } from '@/components/ui/badge'
import { toIntlLocale } from '@/i18n/languages'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatTimestampRelative } from '@/lib/format'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'

import { toAnnouncementType, type AnnouncementItem } from '../types'

interface AnnouncementListItemProps {
  announcement: AnnouncementItem
  unread: boolean
  onOpen: (announcement: AnnouncementItem) => void
}

/** Human label for a severity, translated at render time. */
function typeLabelKey(type: AnnouncementItem['type']): string {
  switch (toAnnouncementType(type)) {
    case 'ongoing':
      return 'Ongoing'
    case 'success':
      return 'Success'
    case 'warning':
      return 'Warning'
    case 'error':
      return 'Error'
    default:
      return 'Default'
  }
}

/**
 * One announcement, shown in full rather than clipped to a preview line.
 *
 * The dashboard panel is a teaser and truncates, but this page exists to be
 * read: an operator scanning it should not have to open every entry to find out
 * which one mentions the model they care about.
 */
export function AnnouncementListItem(props: AnnouncementListItemProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const publishDate = props.announcement.publishDate
  const parsed = publishDate ? Date.parse(publishDate) : NaN

  return (
    <button
      type='button'
      onClick={() => props.onOpen(props.announcement)}
      className='hover:bg-muted/40 focus-visible:bg-muted/40 w-full px-3 py-4 text-left transition-colors focus-visible:outline-none sm:px-5'
    >
      <div className='flex items-start gap-3'>
        <span
          aria-hidden='true'
          className={cn(
            'mt-1.5 inline-block size-2 shrink-0 rounded-full',
            getAnnouncementColorClass(props.announcement.type)
          )}
        />

        <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='outline' className='font-normal'>
              {t(typeLabelKey(props.announcement.type))}
            </Badge>
            {props.unread && (
              <span className='text-primary text-xs font-medium'>
                {t('Unread')}
              </span>
            )}
            {Number.isNaN(parsed) ? null : (
              <time
                dateTime={new Date(parsed).toISOString()}
                title={formatDateTimeObject(new Date(parsed))}
                className='text-muted-foreground/60 ml-auto text-xs'
              >
                {formatTimestampRelative(parsed, 'milliseconds', locale)}
              </time>
            )}
          </div>

          <RichContent
            breaks
            content={props.announcement.content}
            className='text-sm leading-relaxed'
          />

          {props.announcement.extra && (
            <p className='text-muted-foreground text-xs'>
              {props.announcement.extra}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}
