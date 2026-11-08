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
import { WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatQuotaFixed, formatTimestamp } from '@/lib/format'

import { formatCNY } from '../lib/aff-withdrawal'
import type { AffWithdrawal, AffWithdrawalStatus } from '../types'

const STATUS_TONE: Record<AffWithdrawalStatus, string> = {
  pending: 'border-amber-500/40 bg-amber-500/10 text-amber-600',
  approved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  rejected: 'border-rose-500/40 bg-rose-500/10 text-rose-600',
}

interface AffWithdrawalHistoryCardProps {
  items: AffWithdrawal[]
  loading?: boolean
}

export function AffWithdrawalHistoryCard({
  items,
  loading,
}: AffWithdrawalHistoryCardProps) {
  const { t } = useTranslation()

  const statusLabel = (status: AffWithdrawalStatus): string => {
    switch (status) {
      case 'pending':
        return t('Pending review')
      case 'approved':
        return t('Paid')
      case 'rejected':
        return t('Rejected')
    }
  }

  return (
    <Card data-card-hover='false' className='bg-muted/20 py-0'>
      <CardHeader className='flex flex-row items-center gap-2 p-3 sm:p-4'>
        <WalletCards
          className='text-muted-foreground size-4'
          aria-hidden='true'
        />
        <h3 className='text-sm font-semibold'>{t('Withdrawal History')}</h3>
      </CardHeader>
      <CardContent className='p-3 pt-0 sm:p-4 sm:pt-0'>
        {!loading && items.length === 0 ? (
          <EmptyState
            icon={WalletCards}
            title={t('No withdrawal requests')}
            description={t(
              'When you withdraw referral rewards to Alipay, the requests appear here.'
            )}
            className='min-h-[120px]'
          />
        ) : (
          <div className='divide-y'>
            {items.map((item) => (
              <div
                key={item.id}
                className='flex flex-wrap items-center justify-between gap-2 py-2 text-sm'
              >
                <div className='flex min-w-0 items-center gap-2'>
                  <span className='text-muted-foreground text-xs tabular-nums'>
                    #{item.id}
                  </span>
                  <span className='truncate font-mono text-xs'>
                    {formatQuotaFixed(item.quota)}
                  </span>
                  <Badge className={STATUS_TONE[item.status]}>
                    {statusLabel(item.status)}
                  </Badge>
                </div>
                <div className='flex items-center gap-3 text-xs'>
                  {item.status === 'approved' ? (
                    <span className='font-semibold tabular-nums'>
                      {formatCNY(item.money)}
                    </span>
                  ) : null}
                  <span className='text-muted-foreground'>
                    {formatTimestamp(item.create_time)}
                  </span>
                </div>
                {item.admin_note ? (
                  <p className='text-muted-foreground w-full text-xs'>
                    {item.admin_note}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
