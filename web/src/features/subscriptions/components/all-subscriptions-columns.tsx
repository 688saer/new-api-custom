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
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { GroupBadge } from '@/components/group-badge'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { toIntlLocale } from '@/i18n/languages'
import { formatCompactNumber, formatQuota } from '@/lib/format'

import {
  formatTimestamp,
  getDaysRemaining,
  getTokenUsagePercent,
  formatTokenAllowance,
} from '../lib'
import type { AdminSubscriptionRow } from '../types'

/** Status of one card, as the operator panel names it. */
function statusTone(status: string): {
  variant: StatusVariant
  labelKey: string
} {
  if (status === 'active') {
    return { variant: 'success', labelKey: 'Active' }
  }
  if (status === 'cancelled') {
    return { variant: 'warning', labelKey: 'Cancelled' }
  }
  return { variant: 'neutral', labelKey: 'Expired' }
}

export function useAllSubscriptionsColumns(
  nowSeconds: number
): ColumnDef<AdminSubscriptionRow>[] {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  return useMemo(
    (): ColumnDef<AdminSubscriptionRow>[] => [
      {
        accessorKey: 'user_id',
        id: 'user',
        header: t('User'),
        meta: { mobileTitle: true },
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className='flex min-w-0 flex-col'>
              <span className='truncate font-medium'>
                {item.display_name || item.username}
              </span>
              <span className='text-muted-foreground truncate text-xs'>
                {item.username} · #{item.user_id}
                {item.email ? ` · ${item.email}` : ''}
              </span>
            </div>
          )
        },
        size: 220,
      },
      {
        accessorKey: 'plan_title',
        id: 'plan',
        header: t('Plan'),
        cell: ({ row }) => (
          <div className='flex min-w-0 flex-col'>
            <span className='truncate'>{row.original.plan_title}</span>
            <span className='text-muted-foreground text-xs tabular-nums'>
              ${Number(row.original.price_amount || 0).toFixed(2)}
            </span>
          </div>
        ),
        size: 140,
      },
      {
        accessorKey: 'status',
        id: 'status',
        header: t('Status'),
        meta: { mobileBadge: true },
        cell: ({ row }) => {
          const tone = statusTone(row.original.status)
          return (
            <StatusBadge
              label={t(tone.labelKey)}
              variant={tone.variant}
              copyable={false}
            />
          )
        },
        size: 100,
      },
      {
        accessorKey: 'end_time',
        id: 'validity',
        header: t('Validity'),
        cell: ({ row }) => {
          const item = row.original
          const days = getDaysRemaining(item.end_time, nowSeconds)
          return (
            <div className='flex flex-col'>
              <span className='text-xs tabular-nums'>
                {formatTimestamp(item.end_time)}
              </span>
              <span className='text-muted-foreground text-xs'>
                {days > 0
                  ? t('{{count}} days left', { count: days })
                  : t('Ended')}
              </span>
            </div>
          )
        },
        size: 160,
      },
      {
        accessorKey: 'amount_used',
        id: 'quota',
        header: t('Quota Used'),
        cell: ({ row }) => {
          const item = row.original
          const total = Number(item.amount_total || 0)
          const used = Number(item.amount_used || 0)
          const percent =
            total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
          return (
            <div className='flex flex-col'>
              <span className='text-xs tabular-nums'>
                {formatQuota(used)}
                {total > 0 ? ` / ${formatQuota(total)}` : ''}
              </span>
              {total > 0 && (
                <span className='text-muted-foreground text-xs tabular-nums'>
                  {t('{{percent}}% used', { percent })}
                </span>
              )}
            </div>
          )
        },
        size: 170,
      },
      {
        accessorKey: 'token_used',
        id: 'tokens',
        header: t('Token Allowance'),
        meta: { mobileHidden: true },
        cell: ({ row }) => {
          const item = row.original
          const limit = Number(item.token_limit_total || 0)
          if (limit <= 0) {
            return (
              <span className='text-muted-foreground text-xs'>
                {t('Unlimited')}
              </span>
            )
          }
          const used = Number(item.token_used || 0)
          return (
            <div className='flex flex-col'>
              <span className='text-xs tabular-nums'>
                {formatCompactNumber(used, locale)}
                <span className='text-muted-foreground'>
                  {' / '}
                  {formatTokenAllowance(limit, t, locale)}
                </span>
              </span>
              <span className='text-muted-foreground text-xs tabular-nums'>
                {t('{{percent}}% used', {
                  percent: getTokenUsagePercent(used, limit),
                })}
              </span>
            </div>
          )
        },
        size: 170,
      },
      {
        accessorKey: 'user_group',
        id: 'group',
        header: t('Group'),
        meta: { mobileHidden: true },
        cell: ({ row }) =>
          row.original.user_group ? (
            <GroupBadge group={row.original.user_group} />
          ) : (
            <span className='text-muted-foreground'>-</span>
          ),
        size: 110,
      },
      {
        accessorKey: 'next_reset_time',
        id: 'next_reset',
        header: t('Next Reset'),
        meta: { mobileHidden: true },
        cell: ({ row }) =>
          row.original.next_reset_time ? (
            <span className='text-muted-foreground text-xs tabular-nums'>
              {formatTimestamp(row.original.next_reset_time)}
            </span>
          ) : (
            <span className='text-muted-foreground text-xs'>
              {t('No Reset')}
            </span>
          ),
        size: 150,
      },
      {
        accessorKey: 'source',
        id: 'source',
        header: t('Source'),
        meta: { mobileHidden: true },
        cell: ({ row }) => (
          <span className='text-muted-foreground text-xs'>
            {row.original.source === 'admin'
              ? t('Granted by admin')
              : t('Bought')}
          </span>
        ),
        size: 120,
      },
      {
        accessorKey: 'id',
        id: 'id',
        header: t('Card ID'),
        meta: { mobileHidden: true },
        cell: ({ row }) => <TableId value={row.original.id} />,
        size: 80,
      },
    ],
    [t, locale, nowSeconds]
  )
}
