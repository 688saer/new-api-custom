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
import { AlertTriangle, Gift, PackageCheck, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'

import type { WheelOverview } from '../types'

interface OverviewPanelProps {
  overview: WheelOverview | null
  loading: boolean
}

/** 活动概览：核心指标、7 日走势、奖品发放与库存预警。 */
export function OverviewPanel(props: OverviewPanelProps) {
  const { t } = useTranslation()

  if (props.loading && props.overview == null) {
    return (
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className='h-24 rounded-xl' />
        ))}
      </div>
    )
  }

  const overview = props.overview
  if (overview == null) {
    return <EmptyState title={t('No data yet')} />
  }

  const maxTrend = overview.trend.reduce(
    (max, day) => Math.max(max, day.count),
    0
  )
  const lowStock = overview.prizes.filter(
    (prize) => prize.type !== 'none' && prize.stock >= 0 && prize.stock <= 3
  )

  const metrics = [
    {
      label: t('Total wins'),
      value: formatNumber(overview.total_wins),
      hint: t('{{count}} today', { count: formatNumber(overview.today_wins) }),
      icon: Gift,
    },
    {
      label: t('Participating users'),
      value: formatNumber(overview.unique_users),
      hint: t('Users who won at least once'),
      icon: Users,
    },
    {
      label: t('Quota distributed'),
      value: overview.quota_distributed_display,
      hint: t('Including redemption codes'),
      icon: PackageCheck,
    },
    {
      label: t('Pending shipments'),
      value: formatNumber(overview.pending_shipments),
      hint: t('Physical prizes waiting to ship'),
      icon: AlertTriangle,
    },
  ]

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className='flex items-start justify-between gap-2 py-4'>
              <div className='min-w-0'>
                <p className='text-muted-foreground text-xs'>{metric.label}</p>
                <p className='mt-1 truncate text-2xl font-bold tabular-nums'>
                  {metric.value}
                </p>
                <p className='text-muted-foreground mt-0.5 truncate text-xs'>
                  {metric.hint}
                </p>
              </div>
              <metric.icon
                aria-hidden='true'
                className='text-muted-foreground size-4 shrink-0'
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm'>
              {t('Wins in the last 7 days')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='flex h-40 items-end gap-2'>
              {overview.trend.map((day) => {
                const height =
                  maxTrend > 0 ? Math.max(6, (day.count / maxTrend) * 100) : 6
                return (
                  <div
                    key={day.date}
                    className='flex min-w-0 flex-1 flex-col items-center gap-1'
                  >
                    <span className='text-muted-foreground text-[10px] tabular-nums'>
                      {day.count}
                    </span>
                    <div
                      className='w-full rounded-t-md bg-gradient-to-t from-amber-500 to-amber-300 transition-[height] duration-500'
                      style={{ height: `${height}%` }}
                      role='img'
                      aria-label={t('{{date}}: {{count}} wins', {
                        date: day.date,
                        count: day.count,
                      })}
                    />
                    <span className='text-muted-foreground text-[10px]'>
                      {day.date.slice(5)}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='flex items-center justify-between text-sm'>
              {t('Stock alerts')}
              <Badge variant={lowStock.length > 0 ? 'warning' : 'secondary'}>
                {t('{{count}} prizes', { count: lowStock.length })}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className='text-muted-foreground py-6 text-center text-sm'>
                {t('All prizes have enough stock.')}
              </p>
            ) : (
              <ul className='divide-border divide-y'>
                {lowStock.map((prize) => (
                  <li
                    key={prize.id}
                    className='flex items-center justify-between gap-2 py-2 text-sm'
                  >
                    <span className='flex min-w-0 items-center gap-1.5'>
                      <span aria-hidden='true'>{prize.icon || '🎁'}</span>
                      <span className='truncate'>{prize.name}</span>
                    </span>
                    <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
                      {t('Stock')} {prize.stock}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-sm'>{t('Prize performance')}</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.prizes.length === 0 ? (
            <EmptyState title={t('No prize configured yet')} />
          ) : (
            <ul className='divide-border divide-y'>
              {overview.prizes.map((prize) => (
                <li
                  key={prize.id}
                  className='flex flex-wrap items-center justify-between gap-2 py-2 text-sm'
                >
                  <span className='flex min-w-0 items-center gap-2'>
                    <span aria-hidden='true'>{prize.icon || '🎁'}</span>
                    <span className='truncate font-medium'>{prize.name}</span>
                    {prize.enabled ? null : (
                      <Badge variant='outline'>{t('Disabled')}</Badge>
                    )}
                  </span>
                  <span className='text-muted-foreground flex shrink-0 items-center gap-3 text-xs tabular-nums'>
                    <span>
                      {t('Issued')} {prize.issued_count}
                    </span>
                    <span>
                      {t('Today')} {prize.today_issued}
                    </span>
                    <span>
                      {t('Stock')}{' '}
                      {prize.stock < 0 ? t('Unlimited') : prize.stock}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
