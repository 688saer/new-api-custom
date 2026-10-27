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

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import { ticketCategoryLabelKey, ticketStatusMeta } from '../lib/tickets'
import type { Ticket } from '../types'

type TicketListProps = {
  tickets: Ticket[]
  activeId: number | null
  loading: boolean
  onSelect: (ticketId: number) => void
}

/** 工单列表（左侧栏），选中项高亮，未读用角标提示。 */
export function TicketList(props: TicketListProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  if (props.loading) {
    return (
      <div className='space-y-2 p-3' aria-busy='true'>
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className='space-y-2 rounded-lg border p-3'>
            <Skeleton className='h-4 w-2/3' />
            <Skeleton className='h-3 w-1/2' />
          </div>
        ))}
      </div>
    )
  }

  return (
    <ul className='divide-y' aria-label={t('Ticket list view')}>
      {props.tickets.map((ticket) => {
        const status = ticketStatusMeta(ticket.status)
        const unread = ticket.unread_count > 0
        const active = ticket.id === props.activeId

        return (
          <li key={ticket.id}>
            <button
              type='button'
              onClick={() => props.onSelect(ticket.id)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'hover:bg-muted/60 w-full px-3 py-3 text-left transition-colors',
                active && 'bg-muted'
              )}
            >
              <div className='flex items-start justify-between gap-2'>
                <span
                  className={cn(
                    'line-clamp-1 text-sm',
                    unread ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {ticket.title}
                </span>
                <Badge variant={status.variant} className='shrink-0'>
                  {t(status.labelKey)}
                </Badge>
              </div>
              <p className='text-muted-foreground mt-1 line-clamp-1 text-xs'>
                {ticket.last_message ||
                  t(ticketCategoryLabelKey(ticket.category))}
              </p>
              <div className='text-muted-foreground mt-1 flex items-center justify-between text-xs'>
                <span>
                  {formatTimestampRelative(
                    ticket.last_message_at,
                    'seconds',
                    locale
                  )}
                </span>
                <span className='flex items-center gap-2'>
                  <span>{t(ticketCategoryLabelKey(ticket.category))}</span>
                  {unread && (
                    <Badge
                      variant='destructive'
                      className='h-4 px-1.5 text-[10px]'
                    >
                      {t('New')}
                    </Badge>
                  )}
                </span>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
