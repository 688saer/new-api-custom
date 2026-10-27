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
import { LifeBuoy, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { NewTicketDialog } from '../components/new-ticket-dialog'
import { TicketDetail } from '../components/ticket-detail'
import { TicketList } from '../components/ticket-list'
import {
  useArchiveTicket,
  useCreateTicket,
  useMyTicket,
  useMyTickets,
  useReplyTicket,
  useResolveTicket,
} from '../hooks/use-tickets'
import type { TicketCategory } from '../types'

/** 我的工单：左侧列表 + 右侧会话，和参考站点一致的两栏布局。 */
export function TicketsPage() {
  const { t } = useTranslation()
  const [archived, setArchived] = useState(false)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const listQuery = useMyTickets(archived)
  const detailQuery = useMyTicket(activeId)
  const createMutation = useCreateTicket()
  const replyMutation = useReplyTicket()
  const resolveMutation = useResolveTicket()
  const archiveMutation = useArchiveTicket()

  const tickets = useMemo(() => listQuery.data?.items ?? [], [listQuery.data])
  const system = listQuery.data?.system
  const submitting =
    replyMutation.isPending ||
    resolveMutation.isPending ||
    archiveMutation.isPending

  // 列表加载完后默认选中第一条，避免右侧空白
  useEffect(() => {
    if (activeId != null) return
    if (tickets.length === 0) return
    setActiveId(tickets[0].id)
  }, [activeId, tickets])

  // 切到已归档/进行中后，原选中项可能不在列表里
  useEffect(() => {
    if (activeId == null) return
    if (listQuery.isLoading) return
    if (tickets.some((ticket) => ticket.id === activeId)) return
    setActiveId(tickets.length > 0 ? tickets[0].id : null)
  }, [activeId, listQuery.isLoading, tickets])

  function reportError(error: unknown) {
    toast.error(error instanceof Error ? error.message : t('Action failed'))
  }

  function handleCreate(payload: {
    title: string
    category: TicketCategory
    content: string
    images: { file: File }[]
  }) {
    createMutation.mutate(
      {
        title: payload.title,
        category: payload.category,
        content: payload.content,
        files: payload.images,
      },
      {
        onSuccess: (envelope) => {
          setCreateOpen(false)
          setArchived(false)
          const created = envelope.data
          if (created) setActiveId(created.id)
          toast.success(t('Ticket created'))
        },
        onError: reportError,
      }
    )
  }

  function handleReply(content: string, images: { file: File }[]) {
    if (activeId == null) return
    replyMutation.mutate(
      { ticketId: activeId, content, files: images },
      { onError: reportError }
    )
  }

  function handleResolve() {
    if (activeId == null) return
    resolveMutation.mutate(activeId, {
      onSuccess: () => toast.success(t('Ticket marked as resolved')),
      onError: reportError,
    })
  }

  function handleArchive(next: boolean) {
    if (activeId == null) return
    archiveMutation.mutate(
      { ticketId: activeId, archived: next },
      {
        onSuccess: () =>
          toast.success(next ? t('Ticket archived') : t('Ticket restored')),
        onError: reportError,
      }
    )
  }

  if (system && !system.enabled) {
    return (
      <EmptyState
        icon={LifeBuoy}
        title={t('The ticket system is not enabled')}
        description={t(
          'This site has turned off support tickets. Reach out through the channels listed on the about page.'
        )}
      />
    )
  }

  const detail = detailQuery.data

  return (
    <>
      <SectionPageLayout fixedContent stackActionsOnMobile>
        <SectionPageLayout.Title>{t('My Tickets')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button type='button' size='sm' onClick={() => setCreateOpen(true)}>
            <Plus className='size-4' aria-hidden='true' />
            {t('New ticket')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div className='flex h-full min-h-0 gap-3'>
            <aside className='hidden w-80 shrink-0 flex-col overflow-hidden rounded-lg border md:flex'>
              <div className='border-b p-2'>
                <Tabs
                  value={archived ? 'archived' : 'open'}
                  onValueChange={(value) => setArchived(value === 'archived')}
                >
                  <TabsList className='w-full'>
                    <TabsTrigger value='open'>{t('Open')}</TabsTrigger>
                    <TabsTrigger value='archived'>{t('Archived')}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className='min-h-0 flex-1 overflow-y-auto'>
                {tickets.length === 0 && !listQuery.isLoading ? (
                  <p className='text-muted-foreground p-6 text-center text-sm'>
                    {archived
                      ? t('No archived tickets yet')
                      : t('No tickets yet. Start one and we will reply here.')}
                  </p>
                ) : (
                  <TicketList
                    tickets={tickets}
                    activeId={activeId}
                    loading={listQuery.isLoading}
                    onSelect={setActiveId}
                  />
                )}
              </div>
            </aside>

            <section className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border'>
              {detail ? (
                <TicketDetail
                  ticket={detail}
                  agentName={system?.agent_name || t('Support')}
                  allowAttachments={system?.allow_attachments ?? true}
                  submitting={submitting}
                  onReply={handleReply}
                  onResolve={handleResolve}
                  onArchive={handleArchive}
                />
              ) : (
                <EmptyState
                  icon={LifeBuoy}
                  title={t('Select or create a ticket')}
                  description={t(
                    'Reach out here for billing, model or account problems.'
                  )}
                  action={
                    <Button
                      type='button'
                      size='sm'
                      onClick={() => setCreateOpen(true)}
                    >
                      {t('New ticket')}
                    </Button>
                  }
                />
              )}
            </section>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      {/* SectionPageLayout 只渲染具名插槽，弹窗必须放在它外面 */}
      <NewTicketDialog
        open={createOpen}
        submitting={createMutation.isPending}
        allowAttachments={system?.allow_attachments ?? true}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
      />
    </>
  )
}
