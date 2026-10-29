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
import { Download, Loader2, Plus, Receipt } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TitledCard } from '@/components/ui/titled-card'
import { formatNumber, formatTimestamp } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { downloadMyInvoice, getMyInvoices } from './api'
import { InvoiceApplyDialog } from './components/invoice-apply-dialog'
import type { Invoice, InvoiceStatus } from './types'

const STATUS_TONE: Record<InvoiceStatus, string> = {
  pending: 'border-amber-500/40 bg-amber-500/10 text-amber-600',
  approved: 'border-sky-500/40 bg-sky-500/10 text-sky-600',
  issued: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  rejected: 'border-rose-500/40 bg-rose-500/10 text-rose-600',
}

export function Invoices() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [applyOpen, setApplyOpen] = useState(false)

  const query = useQuery({
    queryKey: ['invoices', 'self', page],
    queryFn: () => getMyInvoices(page, 20),
  })

  const downloadMutation = useMutation({
    mutationFn: (invoice: Invoice) => downloadMyInvoice(invoice),
    onError: (error) =>
      handleServerError(error, t('Failed to download invoice')),
  })

  const data = query.data?.data
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? 20
  const setting = data?.setting ?? null
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const statusLabel = (status: InvoiceStatus): string => {
    switch (status) {
      case 'pending':
        return t('Under review')
      case 'approved':
        return t('Approved, waiting to be issued')
      case 'issued':
        return t('Issued')
      case 'rejected':
        return t('Rejected')
      default:
        return status
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Invoices')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          onClick={() => setApplyOpen(true)}
          disabled={setting ? !setting.enabled : false}
          className='gap-2'
        >
          <Plus className='h-4 w-4' />
          {t('Request an invoice')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='mx-auto w-full max-w-4xl space-y-4 sm:space-y-6'>
          <TitledCard
            title={t('Invoice requests')}
            description={t(
              'We review every request before issuing the invoice. Issued invoices can be downloaded here.'
            )}
            icon={<Receipt className='h-4 w-4' />}
            iconTone='info'
            disableHoverEffect
          >
            {setting?.seller_name ? (
              <p className='text-muted-foreground mb-4 text-xs'>
                {t('Invoices are issued by {{seller}}', {
                  seller: setting.seller_name,
                })}
                {setting.contact ? ` · ${setting.contact}` : ''}
              </p>
            ) : null}

            {query.isLoading ? (
              <div className='text-muted-foreground flex items-center gap-2 py-10 text-sm'>
                <Loader2 className='h-4 w-4 animate-spin' />
                {t('Loading')}
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                title={t('No invoice requests yet')}
                description={t(
                  'Request an invoice for the amount you have paid, and we will issue it after review.'
                )}
              />
            ) : (
              <div className='space-y-2.5'>
                {items.map((invoice) => (
                  <Card key={invoice.id} className='border-muted shadow-none'>
                    <CardContent className='flex flex-wrap items-center gap-3 p-3 sm:gap-4 sm:p-4'>
                      <div className='min-w-0 flex-1 space-y-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <span className='font-semibold'>
                            ¥{formatNumber(invoice.amount_cents / 100)}
                          </span>
                          <Badge
                            variant='outline'
                            className={cn(
                              'text-[11px]',
                              STATUS_TONE[invoice.status]
                            )}
                          >
                            {statusLabel(invoice.status)}
                          </Badge>
                        </div>
                        <div className='text-muted-foreground truncate text-xs'>
                          {invoice.title_name} · {invoice.email}
                        </div>
                        <div className='text-muted-foreground text-xs'>
                          {formatTimestamp(invoice.created_at)}
                          {invoice.invoice_no
                            ? ` · ${t('Invoice number')}: ${invoice.invoice_no}`
                            : ''}
                        </div>
                        {invoice.status === 'rejected' &&
                        invoice.reject_reason ? (
                          <div className='text-xs text-rose-600'>
                            {t('Rejected reason')}: {invoice.reject_reason}
                          </div>
                        ) : null}
                      </div>
                      {invoice.status === 'issued' ? (
                        <Button
                          variant='outline'
                          size='sm'
                          className='gap-2'
                          disabled={downloadMutation.isPending}
                          onClick={() => downloadMutation.mutate(invoice)}
                        >
                          {downloadMutation.isPending ? (
                            <Loader2 className='h-4 w-4 animate-spin' />
                          ) : (
                            <Download className='h-4 w-4' />
                          )}
                          {t('Download')}
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {totalPages > 1 ? (
              <div className='mt-4 flex items-center justify-between'>
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
          </TitledCard>
        </div>

        <InvoiceApplyDialog
          open={applyOpen}
          onOpenChange={setApplyOpen}
          setting={setting}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: ['invoices'] })
          }}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
