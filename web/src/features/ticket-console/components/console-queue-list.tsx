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
import {
  ticketCategoryLabelKey,
  ticketStatusMeta,
} from '@/features/tickets/lib/tickets'
import type { Ticket } from '@/features/tickets/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

type ConsoleQueueListProps = {
  tickets: Ticket[]
  activeId: number | null
  loading: boolean
  onSelect: (ticketId: number) => void
}

/** 后台工单队列，带用户与指派信息。 */
export function ConsoleQueueList(props: ConsoleQueueListProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  if (props.loading) {
    return (
      <p className='text-muted-foreground p-6 text-center text-sm'>
        {t('Loading…')}
      </p>
    )
  }

  if (props.tickets.length === 0) {
    return (
      <p className='text-muted-foreground p-6 text-center text-sm'>
        {t('No tickets match these filters')}
      </p>
    )
  }

  return (
    <ul className='divide-y' aria-label={t('Ticket queue')}>
      {props.tickets.map((ticket) => {
        const status = ticketStatusMeta(ticket.status)
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
                <span className='line-clamp-1 text-sm font-medium'>
                  #{ticket.id} {ticket.title}
                </span>
                <Badge variant={status.variant} className='shrink-0'>
                  {t(status.labelKey)}
                </Badge>
              </div>
              <p className='text-muted-foreground mt-1 line-clamp-1 text-xs'>
                {ticket.last_message ||
                  t(ticketCategoryLabelKey(ticket.category))}
              </p>
              <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'>
                <span>{ticket.username || `#${ticket.user_id}`}</span>
                <span>·</span>
                <span>{t(ticketCategoryLabelKey(ticket.category))}</span>
                <span>·</span>
                <span>{ticket.agent_name || t('Unassigned')}</span>
                <span>·</span>
                <span>
                  {formatTimestampRelative(
                    ticket.last_message_at,
                    'seconds',
                    locale
                  )}
                </span>
                {ticket.unread_for_staff > 0 && (
                  <Badge
                    variant='destructive'
                    className='h-4 px-1.5 text-[10px]'
                  >
                    {t('New')}
                  </Badge>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
