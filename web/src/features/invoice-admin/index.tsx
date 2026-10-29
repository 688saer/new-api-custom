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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Loader2, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTimestamp } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { downloadInvoiceAdmin, listInvoicesAdmin } from '../invoices/api'
import type { Invoice, InvoiceStatus } from '../invoices/types'
import { InvoiceIssueDialog } from './components/invoice-issue-dialog'
import { InvoiceReviewDialog } from './components/invoice-review-dialog'
import { InvoiceSettingsPanel } from './components/invoice-settings-panel'

const STATUS_TONE: Record<InvoiceStatus, string> = {
  pending: 'border-amber-500/40 bg-amber-500/10 text-amber-600',
  approved: 'border-sky-500/40 bg-sky-500/10 text-sky-600',
  issued: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  rejected: 'border-rose-500/40 bg-rose-500/10 text-rose-600',
}

export function InvoiceAdmin() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')

  const [reviewTarget, setReviewTarget] = useState<Invoice | null>(null)
  const [reviewApprove, setReviewApprove] = useState(true)
  const [issueTarget, setIssueTarget] = useState<Invoice | null>(null)

  const query = useQuery({
    queryKey: ['invoice', 'admin', page, status, search],
    queryFn: () =>
      listInvoicesAdmin({ status, keyword: search, page, pageSize: 20 }),
  })

  const downloadMutation = useMutation({
    mutationFn: (invoice: Invoice) => downloadInvoiceAdmin(invoice),
    onError: (error) =>
      handleServerError(error, t('Failed to download invoice')),
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['invoice'] })
  }

  const data = query.data?.data
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const statusLabel = (value: InvoiceStatus): string => {
    switch (value) {
      case 'pending':
        return t('Pending review')
      case 'approved':
        return t('Waiting to be issued')
      case 'issued':
        return t('Issued')
      case 'rejected':
        return t('Rejected')
      default:
        return value
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Invoice management')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto w-full max-w-6xl'>
          <Tabs defaultValue='requests'>
            <TabsList>
              <TabsTrigger value='requests'>
                {t('Invoice requests')}
              </TabsTrigger>
              <TabsTrigger value='settings'>{t('Settings')}</TabsTrigger>
            </TabsList>

            <TabsContent value='requests' className='space-y-4'>
              <div className='flex flex-wrap items-center gap-2'>
                <NativeSelect
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value)
                    setPage(1)
                  }}
                  aria-label={t('Status')}
                >
                  <NativeSelectOption value=''>
                    {t('All statuses')}
                  </NativeSelectOption>
                  <NativeSelectOption value='pending'>
                    {t('Pending review')}
                  </NativeSelectOption>
                  <NativeSelectOption value='approved'>
                    {t('Waiting to be issued')}
                  </NativeSelectOption>
                  <NativeSelectOption value='issued'>
                    {t('Issued')}
                  </NativeSelectOption>
                  <NativeSelectOption value='rejected'>
                    {t('Rejected')}
                  </NativeSelectOption>
                </NativeSelect>
                <div className='flex flex-1 items-center gap-2 sm:max-w-xs'>
                  <Input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        setSearch(keyword.trim())
                        setPage(1)
                      }
                    }}
                    placeholder={t(
                      'Search title, user, email or invoice number'
                    )}
                    aria-label={t('Search')}
                  />
                  <Button
                    variant='outline'
                    size='icon'
                    aria-label={t('Search')}
                    onClick={() => {
                      setSearch(keyword.trim())
                      setPage(1)
                    }}
                  >
                    <Search className='h-4 w-4' />
                  </Button>
                </div>
              </div>

              {query.isLoading ? (
                <div className='text-muted-foreground flex items-center gap-2 py-12 text-sm'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  {t('Loading')}
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  title={t('No invoice requests')}
                  description={t('Requests submitted by users appear here.')}
                  className='min-h-[220px]'
                />
              ) : (
                <div className='overflow-x-auto rounded-lg border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('User')}</TableHead>
                        <TableHead>{t('Invoice title')}</TableHead>
                        <TableHead className='text-right'>
                          {t('Amount')}
                        </TableHead>
                        <TableHead>{t('Status')}</TableHead>
                        <TableHead>{t('Submitted')}</TableHead>
                        <TableHead className='text-right'>
                          {t('Actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className='font-medium'>
                            {invoice.username || `#${invoice.user_id}`}
                          </TableCell>
                          <TableCell>
                            <div className='space-y-0.5'>
                              <div className='text-sm'>
                                {invoice.title_name}
                              </div>
                              <div className='text-muted-foreground text-xs'>
                                {invoice.email}
                                {invoice.tax_id ? ` · ${invoice.tax_id}` : ''}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className='text-right'>
                            ¥{(invoice.amount_cents / 100).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant='outline'
                              className={cn(
                                'text-[11px]',
                                STATUS_TONE[invoice.status]
                              )}
                            >
                              {statusLabel(invoice.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className='text-muted-foreground text-xs'>
                            {formatTimestamp(invoice.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className='flex justify-end gap-1.5'>
                              {invoice.status === 'pending' ? (
                                <>
                                  <Button
                                    size='sm'
                                    variant='outline'
                                    onClick={() => {
                                      setReviewApprove(true)
                                      setReviewTarget(invoice)
                                    }}
                                  >
                                    {t('Approve')}
                                  </Button>
                                  <Button
                                    size='sm'
                                    variant='ghost'
                                    onClick={() => {
                                      setReviewApprove(false)
                                      setReviewTarget(invoice)
                                    }}
                                  >
                                    {t('Reject')}
                                  </Button>
                                </>
                              ) : null}
                              {invoice.status === 'approved' ||
                              invoice.status === 'issued' ? (
                                <Button
                                  size='sm'
                                  onClick={() => setIssueTarget(invoice)}
                                >
                                  {invoice.status === 'issued'
                                    ? t('Re-issue')
                                    : t('Issue')}
                                </Button>
                              ) : null}
                              {invoice.status === 'issued' ? (
                                <Button
                                  size='sm'
                                  variant='ghost'
                                  aria-label={t('Download')}
                                  disabled={downloadMutation.isPending}
                                  onClick={() =>
                                    downloadMutation.mutate(invoice)
                                  }
                                >
                                  <Download className='h-4 w-4' />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {totalPages > 1 ? (
                <div className='flex items-center justify-between'>
                  <span className='text-muted-foreground text-xs'>
                    {t('Page {{page}} of {{total}}', {
                      page,
                      total: totalPages,
                    })}
                  </span>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={page <= 1}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      {t('Previous')}
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={page >= totalPages}
                      onClick={() => setPage((prev) => prev + 1)}
                    >
                      {t('Next')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value='settings'>
              <InvoiceSettingsPanel />
            </TabsContent>
          </Tabs>
        </div>

        <InvoiceReviewDialog
          open={reviewTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setReviewTarget(null)
            }
          }}
          invoice={reviewTarget}
          approve={reviewApprove}
          onDone={refresh}
        />
        <InvoiceIssueDialog
          open={issueTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setIssueTarget(null)
            }
          }}
          invoice={issueTarget}
          onDone={refresh}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
