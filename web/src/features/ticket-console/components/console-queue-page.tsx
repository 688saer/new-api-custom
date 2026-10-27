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
import { LifeBuoy, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  ticketCategoryLabelKey,
  ticketStatusMeta,
} from '@/features/tickets/lib/tickets'
import {
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  type TicketCategory,
} from '@/features/tickets/types'

import {
  useConsoleAgents,
  useConsoleQueue,
  useConsoleTicket,
  useConsoleTicketActions,
  type ConsoleQueueFilter,
} from '../hooks/use-console'
import type { TicketAgentAccount, TicketPermission } from '../types'
import { ConsoleQueueList } from './console-queue-list'
import { ConsoleTicketDetail } from './console-ticket-detail'

type ConsoleQueuePageProps = {
  agents: TicketAgentAccount[]
  permissions: TicketPermission[]
}

const EMPTY_FILTER: ConsoleQueueFilter = {
  status: 'all',
  category: 'all',
  keyword: '',
  archived: false,
  assignment: 'all',
  page: 1,
}

/** 工单队列页：筛选条 + 左侧列表 + 右侧会话。 */
export function ConsoleQueuePage(props: ConsoleQueuePageProps) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<ConsoleQueueFilter>(EMPTY_FILTER)
  const [keywordDraft, setKeywordDraft] = useState('')
  const [activeId, setActiveId] = useState<number | null>(null)

  const queue = useConsoleQueue(filter, true)
  const detail = useConsoleTicket(activeId)
  const agentsQuery = useConsoleAgents(true)
  const actions = useConsoleTicketActions()

  const tickets = useMemo(() => queue.data?.items ?? [], [queue.data])
  const agentOptions = agentsQuery.data?.items ?? props.agents
  const canReply = props.permissions.includes('tickets.reply')
  const canAssign = props.permissions.includes('tickets.assign')
  const canClose = props.permissions.includes('tickets.close')

  useEffect(() => {
    if (activeId != null) return
    if (tickets.length === 0) return
    setActiveId(tickets[0].id)
  }, [activeId, tickets])

  function reportError(error: unknown) {
    toast.error(error instanceof Error ? error.message : t('Action failed'))
  }

  function handleReply(content: string, images: { file: File }[]) {
    if (activeId == null) return
    actions.reply.mutate(
      { ticketId: activeId, content, files: images },
      { onError: reportError }
    )
  }

  function handleAssign(agentId: number) {
    if (activeId == null) return
    actions.assign.mutate(
      { ticketId: activeId, agentId },
      {
        onSuccess: () => toast.success(t('Ticket assigned')),
        onError: reportError,
      }
    )
  }

  function handleStatus(status: string) {
    if (activeId == null) return
    actions.setStatus.mutate(
      { ticketId: activeId, status },
      {
        onSuccess: () => toast.success(t('Status updated')),
        onError: reportError,
      }
    )
  }

  function handleArchive(archived: boolean) {
    if (activeId == null) return
    actions.archive.mutate(
      { ticketId: activeId, archived },
      {
        onSuccess: () =>
          toast.success(archived ? t('Ticket archived') : t('Ticket restored')),
        onError: reportError,
      }
    )
  }

  // Base UI 的 Select 需要用 items 才能把值渲染成标签，否则触发器里会显示原始值
  const statusItems = useMemo(
    () => [
      { value: 'all', label: t('All statuses') },
      ...TICKET_STATUSES.map((status) => ({
        value: status as string,
        label: t(ticketStatusMeta(status).labelKey),
      })),
    ],
    [t]
  )
  const categoryItems = useMemo(
    () => [
      { value: 'all', label: t('All categories') },
      ...TICKET_CATEGORIES.map((category: TicketCategory) => ({
        value: category as string,
        label: t(ticketCategoryLabelKey(category)),
      })),
    ],
    [t]
  )
  const assignmentItems = useMemo(
    () => [
      { value: 'all', label: t('Anyone') },
      { value: 'mine', label: t('Assigned to me') },
      { value: 'unassigned', label: t('Unassigned') },
    ],
    [t]
  )

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative min-w-48 flex-1'>
          <Search
            className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2'
            aria-hidden='true'
          />
          <Input
            value={keywordDraft}
            onChange={(event) => setKeywordDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              setFilter((previous) => ({
                ...previous,
                keyword: keywordDraft.trim(),
                page: 1,
              }))
            }}
            placeholder={t('Search title, user or ticket number')}
            className='pl-8'
            aria-label={t('Search tickets')}
          />
        </div>

        <Select
          items={statusItems}
          value={filter.status}
          onValueChange={(value) => {
            if (value == null) return
            setFilter((previous) => ({ ...previous, status: value, page: 1 }))
          }}
        >
          <SelectTrigger size='sm' className='w-36'>
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

        <Select
          items={categoryItems}
          value={filter.category}
          onValueChange={(value) => {
            if (value == null) return
            setFilter((previous) => ({ ...previous, category: value, page: 1 }))
          }}
        >
          <SelectTrigger size='sm' className='w-36'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={assignmentItems}
          value={filter.assignment}
          onValueChange={(value) => {
            if (value == null) return
            setFilter((previous) => ({
              ...previous,
              assignment: value,
              page: 1,
            }))
          }}
        >
          <SelectTrigger size='sm' className='w-32'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {assignmentItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className='flex items-center gap-2 text-sm'>
          <Switch
            checked={filter.archived}
            onCheckedChange={(checked) =>
              setFilter((previous) => ({
                ...previous,
                archived: checked,
                page: 1,
              }))
            }
          />
          {t('Archived')}
        </label>

        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() =>
            setFilter((previous) => ({
              ...previous,
              keyword: keywordDraft.trim(),
              page: 1,
            }))
          }
        >
          {t('Search')}
        </Button>
      </div>

      <div className='flex min-h-0 flex-1 gap-3'>
        <aside className='hidden w-96 shrink-0 flex-col overflow-hidden rounded-lg border lg:flex'>
          <div className='text-muted-foreground border-b px-3 py-2 text-xs'>
            {t('{{count}} tickets', { count: queue.data?.total ?? 0 })}
          </div>
          <div className='min-h-0 flex-1 overflow-y-auto'>
            <ConsoleQueueList
              tickets={tickets}
              activeId={activeId}
              loading={queue.isLoading}
              onSelect={setActiveId}
            />
          </div>
        </aside>

        <section className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border'>
          {detail.data ? (
            <ConsoleTicketDetail
              ticket={detail.data}
              agents={agentOptions}
              canReply={canReply}
              canAssign={canAssign}
              canClose={canClose}
              submitting={actions.submitting}
              onReply={handleReply}
              onAssign={handleAssign}
              onStatus={handleStatus}
              onArchive={handleArchive}
            />
          ) : (
            <EmptyState
              icon={LifeBuoy}
              title={t('Select a ticket')}
              description={t('Pick a ticket from the queue to read and reply.')}
            />
          )}
        </section>
      </div>
    </div>
  )
}
