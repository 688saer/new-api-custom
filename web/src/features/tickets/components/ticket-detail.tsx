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
import { Archive, ArchiveRestore, CheckCheck, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampToDate } from '@/lib/format'

import { ticketCategoryLabelKey, ticketStatusMeta } from '../lib/tickets'
import type { Ticket } from '../types'
import { TicketComposer, type PendingImage } from './ticket-composer'
import { TicketThread } from './ticket-thread'

type TicketDetailProps = {
  ticket: Ticket
  agentName: string
  allowAttachments: boolean
  submitting: boolean
  onReply: (content: string, images: PendingImage[]) => void
  onResolve: () => void
  onArchive: (archived: boolean) => void
}

/** 用户侧工单详情：标题、元信息、会话流与操作按钮。 */
export function TicketDetail(props: TicketDetailProps) {
  const { t, i18n } = useTranslation()
  const [attachments, setAttachments] = useState<PendingImage[]>([])
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const status = ticketStatusMeta(props.ticket.status)
  const ended = !props.ticket.replyable

  function handleReply(content: string) {
    props.onReply(content, attachments)
    setAttachments([])
  }

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <header className='space-y-2 border-b px-4 py-3 sm:px-5'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div className='min-w-0'>
            <h3 className='truncate text-base font-semibold'>
              {props.ticket.title}
            </h3>
            <p className='text-muted-foreground mt-1 text-xs'>
              <span>#{props.ticket.id}</span>
              <span className='mx-1.5'>·</span>
              <span>{t(ticketCategoryLabelKey(props.ticket.category))}</span>
              <span className='mx-1.5'>·</span>
              <span>
                {t('Created on {{date}}', {
                  date: formatTimestampToDate(props.ticket.created_at),
                })}
              </span>
            </p>
          </div>
          <Badge variant={status.variant}>{t(status.labelKey)}</Badge>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          {!ended && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={props.onResolve}
              disabled={props.submitting}
            >
              {props.submitting ? (
                <Loader2 className='size-4 animate-spin' aria-hidden='true' />
              ) : (
                <CheckCheck className='size-4' aria-hidden='true' />
              )}
              {t('Mark as resolved')}
            </Button>
          )}
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => props.onArchive(!props.ticket.archived)}
            disabled={props.submitting}
          >
            {props.ticket.archived ? (
              <ArchiveRestore className='size-4' aria-hidden='true' />
            ) : (
              <Archive className='size-4' aria-hidden='true' />
            )}
            {props.ticket.archived ? t('Restore') : t('Archive')}
          </Button>
          <span className='text-muted-foreground text-xs' data-locale={locale}>
            {t('{{count}} messages', {
              count: props.ticket.message_count,
            })}
          </span>
        </div>
      </header>

      <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5'>
        <TicketThread
          messages={props.ticket.messages ?? []}
          agentName={props.agentName}
          selfSide='user'
        />
      </div>

      <TicketComposer
        placeholder={t('Add more details or reply to support...')}
        submitting={props.submitting}
        allowAttachments={props.allowAttachments}
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        onSubmit={handleReply}
        disabled={ended || props.ticket.archived}
        disabledHint={
          props.ticket.archived
            ? t('This ticket is archived. Restore it to continue.')
            : t('This ticket is closed. Open a new one if you still need help.')
        }
      />
    </div>
  )
}
