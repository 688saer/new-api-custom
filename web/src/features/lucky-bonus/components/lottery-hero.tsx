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
import { Coins, Sparkles, Ticket, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Progress } from '@/components/ui/progress'
import { formatCurrencyUSD } from '@/lib/format'

import type { LotteryStatus } from '../types'

interface LotteryHeroProps {
  status: LotteryStatus
}

interface HeroMetricProps {
  icon: React.ReactNode
  label: string
  value: string
  emphasis?: boolean
}

function HeroMetric(props: HeroMetricProps) {
  return (
    <div className='flex items-center gap-2.5'>
      <IconBadge tone='neutral' size='sm'>
        {props.icon}
      </IconBadge>
      <div className='min-w-0'>
        <p className='text-muted-foreground truncate text-[11px] leading-tight font-medium'>
          {props.label}
        </p>
        <p
          className={
            props.emphasis
              ? 'text-warning truncate text-base leading-tight font-bold tabular-nums'
              : 'truncate text-base leading-tight font-bold tabular-nums'
          }
        >
          {props.value}
        </p>
      </div>
    </div>
  )
}

/**
 * Top of the lottery page: how many free draws are left, plus the three numbers
 * a visitor checks before deciding to spin.
 */
export function LotteryHero(props: LotteryHeroProps) {
  const { t } = useTranslation()
  const limit = props.status.daily_draw_limit
  const remaining = props.status.remaining_draws
  const usedPercent =
    limit > 0 ? Math.min(100, ((limit - remaining) / limit) * 100) : 100

  return (
    <Card className='from-primary/12 via-primary/5 overflow-hidden border-primary/25 bg-gradient-to-br to-transparent'>
      <CardContent className='flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 items-center gap-3.5'>
          <IconBadge tone='primary' size='lg' className='sm:size-12'>
            <Sparkles className='size-5 sm:size-6' />
          </IconBadge>
          <div className='min-w-0'>
            <p className='text-muted-foreground text-xs font-medium'>
              {t('Free draws left today')}
            </p>
            <p className='flex items-baseline gap-1.5 text-3xl leading-none font-bold tracking-tight tabular-nums'>
              {remaining}
              <span className='text-muted-foreground text-base font-medium'>
                / {limit}
              </span>
            </p>
            <Progress value={usedPercent} className='mt-2 h-1.5 w-32' />
          </div>
        </div>

        <div className='grid grid-cols-1 gap-3 min-[420px]:grid-cols-3 sm:gap-5'>
          <HeroMetric
            icon={<Coins className='size-3.5' />}
            label={t('Balance')}
            value={formatCurrencyUSD(props.status.quota)}
          />
          <HeroMetric
            icon={<TrendingUp className='size-3.5' />}
            label={t('Prize received today')}
            value={props.status.total_prize_display}
            emphasis
          />
          <HeroMetric
            icon={<Ticket className='size-3.5' />}
            label={t('Draws used today')}
            value={String(props.status.draws_used_today)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
