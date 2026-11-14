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
import { useQuery } from '@tanstack/react-query'
import type {
  ColumnFiltersState,
  OnChangeFn,
  PaginationState,
} from '@tanstack/react-table'
import { Clock, Coins, ShieldCheck, Users } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getAdminPlans, listAllUserSubscriptions } from '../api'
import { useAllSubscriptionsColumns } from './all-subscriptions-columns'
import { useSubscriptions } from './subscriptions-provider'

const DEFAULT_PAGE_SIZE = 20

/** The window the "ending soon" filter and tile both use. */
const EXPIRING_DAYS = 7

type SummaryTile = {
  key: string
  label: string
  value: string
  description: string
  icon: typeof Users
  tone: IconBadgeTone
}

/**
 * Every user's card in one place: how many are live, which ones are about to
 * run out, and how much quota each of them still holds.
 */
export function AllSubscriptionsPanel() {
  const { t } = useTranslation()
  // One reading of the clock per mount keeps the "days left" column stable while
  // the operator filters and pages through the list.
  const [nowSeconds] = useState(() => Math.floor(Date.now() / 1000))
  const columns = useAllSubscriptionsColumns(nowSeconds)
  const { refreshTrigger } = useSubscriptions()

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [keyword, setKeyword] = useState('')

  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) || []
  const planFilter =
    (columnFilters.find((filter) => filter.id === 'plan')?.value as
      | string[]
      | undefined) || []

  const selectedStatus = statusFilter[0] || ''
  const expiringDays = selectedStatus === 'expiring' ? EXPIRING_DAYS : undefined
  const status = selectedStatus === 'expiring' ? 'active' : selectedStatus
  const planId = planFilter[0] ? Number(planFilter[0]) : undefined

  const plansQuery = useQuery({
    queryKey: ['admin-subscription-plans', refreshTrigger],
    queryFn: async () => {
      const result = requireServerSuccess(await getAdminPlans())
      return result.data || []
    },
    placeholderData: (prev) => prev,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'admin-user-subscriptions',
      {
        keyword,
        status,
        planId,
        expiringDays,
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
      },
    ],
    queryFn: async () =>
      requireServerSuccess(
        await listAllUserSubscriptions({
          keyword,
          status,
          planId,
          expiringDays,
          page: pagination.pageIndex + 1,
          pageSize: pagination.pageSize,
        })
      ),
    placeholderData: (prev) => prev,
  })

  const rows = data?.data?.items || []
  const total = data?.data?.total || 0
  const summary = data?.data?.summary

  // Any filter change starts the list over, so the operator never lands on an
  // empty page 3 of a narrower result set.
  const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = useCallback(
    (updater) => {
      setColumnFilters((previous) =>
        typeof updater === 'function' ? updater(previous) : updater
      )
      setPagination((previous) => ({ ...previous, pageIndex: 0 }))
    },
    []
  )

  const handleKeywordChange: OnChangeFn<string> = useCallback((updater) => {
    setKeyword((previous) =>
      typeof updater === 'function' ? updater(previous) : updater
    )
    setPagination((previous) => ({ ...previous, pageIndex: 0 }))
  }, [])

  const { table } = useDataTable({
    data: rows,
    columns,
    totalCount: total,
    columnFilters,
    pagination,
    globalFilter: keyword,
    onColumnFiltersChange: handleColumnFiltersChange,
    onPaginationChange: setPagination,
    onGlobalFilterChange: handleKeywordChange,
    manualPagination: true,
    manualFiltering: true,
    withSortedRowModel: false,
  })

  const statusOptions = useMemo(
    () => [
      { label: t('Active'), value: 'active' },
      {
        label: t('Ending within {{count}} days', { count: EXPIRING_DAYS }),
        value: 'expiring',
      },
      { label: t('Expired'), value: 'expired' },
      { label: t('Cancelled'), value: 'cancelled' },
    ],
    [t]
  )

  const planOptions = useMemo(
    () =>
      (plansQuery.data || []).map((record) => ({
        label: record.plan.title,
        value: String(record.plan.id),
      })),
    [plansQuery.data]
  )

  const tiles = useMemo((): SummaryTile[] => {
    const totalAmount = summary?.amount_total || 0
    const usedAmount = summary?.amount_used || 0
    return [
      {
        key: 'total',
        label: t('Total cards'),
        value: String(summary?.total ?? 0),
        description: t('{{count}} ended', { count: summary?.expired ?? 0 }),
        icon: Users,
        tone: 'primary',
      },
      {
        key: 'active',
        label: t('Active cards'),
        value: String(summary?.active ?? 0),
        description: t('Currently in use'),
        icon: ShieldCheck,
        tone: 'success',
      },
      {
        key: 'expiring',
        label: t('Ending within {{count}} days', { count: EXPIRING_DAYS }),
        value: String(summary?.expiring_soon ?? 0),
        description: t('Worth a renewal reminder'),
        icon: Clock,
        tone: 'warning',
      },
      {
        key: 'quota',
        label: t('Quota consumed'),
        value: formatQuota(usedAmount),
        description: t('of {{total}} sold', {
          total: formatQuota(totalAmount),
        }),
        icon: Coins,
        tone: 'info',
      },
    ]
  }, [summary, t])

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='grid grid-cols-2 gap-2 lg:grid-cols-4'>
        {tiles.map((tile) => (
          <div key={tile.key} className='min-w-0 rounded-lg border px-3 py-2.5'>
            <div className='flex items-center gap-2'>
              <IconBadge tone={tile.tone} size='sm'>
                <tile.icon />
              </IconBadge>
              <span className='text-muted-foreground truncate text-xs'>
                {tile.label}
              </span>
            </div>
            {isLoading && !summary ? (
              <Skeleton className='mt-2 h-6 w-16' />
            ) : (
              <p className='mt-1.5 truncate text-lg font-semibold tabular-nums'>
                {tile.value}
              </p>
            )}
            <p className='text-muted-foreground truncate text-xs'>
              {tile.description}
            </p>
          </div>
        ))}
      </div>

      <div className='flex min-h-0 flex-1 flex-col'>
        <DataTablePage
          table={table}
          columns={columns}
          isLoading={isLoading}
          isFetching={isFetching}
          emptyTitle={t('No subscriptions yet')}
          emptyDescription={t(
            'Once someone buys or is granted a plan, their card shows up here'
          )}
          skeletonKeyPrefix='user-subscriptions-skeleton'
          applyHeaderSize
          toolbarProps={{
            searchPlaceholder: t('Search user, email, or ID...'),
            searchDebounceMs: 400,
            filters: [
              {
                columnId: 'status',
                title: t('Status'),
                options: statusOptions,
                singleSelect: true,
              },
              {
                columnId: 'plan',
                title: t('Plan'),
                options: planOptions,
                singleSelect: true,
              },
            ],
          }}
        />
      </div>
    </div>
  )
}
