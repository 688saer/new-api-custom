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
import { Archive, ArchiveRestore } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TicketComposer,
  type PendingImage,
} from '@/features/tickets/components/ticket-composer'
import { TicketThread } from '@/features/tickets/components/ticket-thread'
import {
  ticketCategoryLabelKey,
  ticketStatusMeta,
} from '@/features/tickets/lib/tickets'
import { TICKET_STATUSES, type Ticket } from '@/features/tickets/types'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampToDate } from '@/lib/format'

import type { TicketAgentAccount } from '../types'

type ConsoleTicketDetailProps = {
  ticket: Ticket
  agents: TicketAgentAccount[]
  canReply: boolean
  canAssign: boolean
  canClose: boolean
  submitting: boolean
  onReply: (content: string, images: PendingImage[]) => void
  onAssign: (agentId: number) => void
  onStatus: (status: string) => void
  onArchive: (archived: boolean) => void
}

/** 客服侧工单详情：会话流 + 状态/指派操作。 */
export function ConsoleTicketDetail(props: ConsoleTicketDetailProps) {
  const { t, i18n } = useTranslation()
  const [attachments, setAttachments] = useState<PendingImage[]>([])
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const status = ticketStatusMeta(props.ticket.status)
  const ended = !props.ticket.replyable

  // Base UI 的 Select 需要 items 才能把值渲染成标签
  const assigneeItems = useMemo(
    () => [
      { value: '0', label: t('Unassigned') },
      ...props.agents.map((agent) => ({
        value: String(agent.id),
        label: agent.display_name || agent.username,
      })),
    ],
    [props.agents, t]
  )
  const statusItems = useMemo(
    () =>
      TICKET_STATUSES.map((item) => ({
        value: item as string,
        label: t(ticketStatusMeta(item).labelKey),
      })),
    [t]
  )

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <header className='space-y-3 border-b px-4 py-3'>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div className='min-w-0'>
            <h3 className='truncate text-base font-semibold'>
              #{props.ticket.id} {props.ticket.title}
            </h3>
            <p className='text-muted-foreground mt-1 text-xs'>
              <span>{props.ticket.username || `#${props.ticket.user_id}`}</span>
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
          {props.canAssign && (
            <Select
              items={assigneeItems}
              value={String(props.ticket.agent_id)}
              onValueChange={(value) => props.onAssign(Number(value))}
            >
              <SelectTrigger size='sm' className='w-44'>
                <SelectValue placeholder={t('Unassigned')} />
              </SelectTrigger>
              <SelectContent>
                {assigneeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {props.canClose && (
            <Select
              items={statusItems}
              value={props.ticket.status}
              onValueChange={(value) => {
                if (value == null) return
                props.onStatus(value)
              }}
            >
              <SelectTrigger size='sm' className='w-40'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {props.canClose && (
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
          )}

          <span className='text-muted-foreground text-xs' data-locale={locale}>
            {t('{{count}} messages', { count: props.ticket.message_count })}
          </span>
        </div>
      </header>

      <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4'>
        <TicketThread
          messages={props.ticket.messages ?? []}
          agentName={props.ticket.agent_name || t('Support')}
          selfSide='agent'
        />
      </div>

      <TicketComposer
        placeholder={t('Write a reply to the user...')}
        submitting={props.submitting}
        allowAttachments
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        onSubmit={(content) => {
          props.onReply(content, attachments)
          setAttachments([])
        }}
        disabled={ended || !props.canReply}
        disabledHint={
          ended
            ? t('This ticket is closed. Reopen it to reply.')
            : t('Your account can view tickets but not reply.')
        }
      />
    </div>
  )
}
