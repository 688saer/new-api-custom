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
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrencyUSD } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { LotteryRankBoard } from '../types'

type LotteryRankingCardProps = {
  title: string
  board: LotteryRankBoard | null
  loading: boolean
  error: string | null
}

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
  if (rank === 2) return 'bg-slate-400/15 text-slate-600 dark:text-slate-300'
  if (rank === 3) return 'bg-orange-500/15 text-orange-700 dark:text-orange-300'
  return 'bg-muted text-muted-foreground'
}

export function LotteryRankingCard(props: LotteryRankingCardProps) {
  const { t } = useTranslation()
  const board = props.board
  const meNotListed =
    board?.me != null &&
    !board.items.some((item) => item.rank === board.me?.rank && item.is_me)

  if (props.loading) {
    return (
      <Card>
        <CardHeader className='pb-2'>
          <CardTitle className='text-base'>{props.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className='h-24 w-full' />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base'>{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {props.error ? (
          <p className='text-muted-foreground py-6 text-center text-sm'>
            {props.error}
          </p>
        ) : !board || board.items.length === 0 ? (
          <p className='text-muted-foreground py-6 text-center text-sm'>
            {t('No lottery draws yet today')}
          </p>
        ) : (
          <ul className='space-y-1'>
            {board.items.map((item) => (
              <li
                key={`${item.rank}-${item.user_id}`}
                className={cn(
                  'flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                  item.is_me && 'bg-emerald-500/10 ring-1 ring-emerald-500/20'
                )}
              >
                <span
                  className={cn(
                    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                    rankBadgeClass(item.rank)
                  )}
                >
                  {item.rank}
                </span>
                <span className='min-w-0 flex-1 truncate'>{item.username}</span>
                <span className='shrink-0 font-medium tabular-nums'>
                  {formatCurrencyUSD(item.award)}
                </span>
              </li>
            ))}
            {meNotListed && board.me && (
              <li className='mt-1 flex min-w-0 items-center gap-2 rounded-md border-t px-2 pt-2 text-sm'>
                <span
                  className={cn(
                    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums',
                    rankBadgeClass(board.me.rank)
                  )}
                >
                  {board.me.rank}
                </span>
                <span className='min-w-0 flex-1 truncate'>
                  {t('My rank')} · {board.me.username}
                </span>
                <span className='shrink-0 font-medium tabular-nums'>
                  {formatCurrencyUSD(board.me.award)}
                </span>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
