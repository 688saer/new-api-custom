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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'
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
import { formatQuotaFixed, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

import { formatCNY } from '../wallet/lib/aff-withdrawal'
import type { AffWithdrawal, AffWithdrawalStatus } from '../wallet/types'
import { listAffWithdrawalsAdmin } from './api'
import { AffWithdrawalReviewDialog } from './components/aff-withdrawal-review-dialog'

const STATUS_TONE: Record<AffWithdrawalStatus, string> = {
  pending: 'border-amber-500/40 bg-amber-500/10 text-amber-600',
  approved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  rejected: 'border-rose-500/40 bg-rose-500/10 text-rose-600',
}

export function AffWithdrawalAdmin() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')

  const [reviewTarget, setReviewTarget] = useState<AffWithdrawal | null>(null)
  const [reviewApprove, setReviewApprove] = useState(true)

  const query = useQuery({
    queryKey: ['aff-withdrawals', 'admin', page, status, search],
    queryFn: () =>
      listAffWithdrawalsAdmin({ status, keyword: search, page, pageSize: 20 }),
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['aff-withdrawals'] })
  }

  const data = query.data?.data
  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const statusLabel = (value: AffWithdrawalStatus): string => {
    switch (value) {
      case 'pending':
        return t('Pending review')
      case 'approved':
        return t('Paid')
      case 'rejected':
        return t('Rejected')
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Referral Withdrawals')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto w-full max-w-6xl space-y-4'>
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
                {t('Paid')}
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
                placeholder={t('Search user, account or name')}
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
          ) : null}

          {!query.isLoading && items.length === 0 ? (
            <EmptyState
              title={t('No withdrawal requests')}
              description={t(
                'Withdrawal requests submitted by users appear here.'
              )}
              className='min-h-[220px]'
            />
          ) : null}

          {!query.isLoading && items.length > 0 ? (
            <div className='overflow-x-auto rounded-lg border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('User')}</TableHead>
                    <TableHead>{t('Alipay Account')}</TableHead>
                    <TableHead className='text-right'>{t('Amount')}</TableHead>
                    <TableHead className='text-right'>
                      {t('Estimated payout')}
                    </TableHead>
                    <TableHead>{t('Status')}</TableHead>
                    <TableHead>{t('Submitted')}</TableHead>
                    <TableHead className='text-right'>{t('Actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className='font-medium'>
                        {item.username || `#${item.user_id}`}
                      </TableCell>
                      <TableCell>
                        <div className='space-y-0.5'>
                          <div className='font-mono text-sm'>
                            {item.account}
                          </div>
                          <div className='text-muted-foreground text-xs'>
                            {item.name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {formatQuotaFixed(item.quota)}
                        <span className='text-muted-foreground text-xs'>
                          {item.fee_percent > 0
                            ? ` (${item.fee_percent}%)`
                            : ''}
                        </span>
                      </TableCell>
                      <TableCell className='text-right font-medium tabular-nums'>
                        {formatCNY(item.money)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant='outline'
                          className={cn(
                            'text-[11px]',
                            STATUS_TONE[item.status]
                          )}
                        >
                          {statusLabel(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-muted-foreground text-xs'>
                        {formatTimestamp(item.create_time)}
                      </TableCell>
                      <TableCell>
                        <div className='flex justify-end gap-1.5'>
                          {item.status === 'pending' ? (
                            <>
                              <Button
                                size='sm'
                                variant='outline'
                                onClick={() => {
                                  setReviewApprove(true)
                                  setReviewTarget(item)
                                }}
                              >
                                {t('Mark as Paid')}
                              </Button>
                              <Button
                                size='sm'
                                variant='ghost'
                                onClick={() => {
                                  setReviewApprove(false)
                                  setReviewTarget(item)
                                }}
                              >
                                {t('Reject')}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

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

          <AffWithdrawalReviewDialog
            open={reviewTarget !== null}
            onOpenChange={(open) => {
              if (!open) {
                setReviewTarget(null)
              }
            }}
            withdrawal={reviewTarget}
            approve={reviewApprove}
            onDone={refresh}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
