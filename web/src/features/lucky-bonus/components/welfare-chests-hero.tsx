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
import { CalendarClock, Gift, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { formatCurrencyUSD } from '@/lib/format'

interface WelfareChestsHeroProps {
  weeklyConsumptionUsd: number
  countdown: number | null
  hasOpened: boolean
  unlimited: boolean
}

function formatCountdown(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '--:--:--'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(secs)}`
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
}

/** Weekly consumption, the reset countdown, and this week's claim state. */
export function WelfareChestsHero(props: WelfareChestsHeroProps) {
  const { t } = useTranslation()

  return (
    <Card className='from-primary/12 via-primary/5 overflow-hidden border-primary/25 bg-gradient-to-br to-transparent'>
      <CardContent className='flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 items-center gap-3.5'>
          <IconBadge tone='primary' size='lg' className='sm:size-12'>
            <Gift className='size-5 sm:size-6' />
          </IconBadge>
          <div className='min-w-0'>
            <p className='text-muted-foreground text-xs font-medium'>
              {t('This Week Consumption')}
            </p>
            <p className='text-2xl leading-tight font-bold tracking-tight tabular-nums'>
              {formatCurrencyUSD(props.weeklyConsumptionUsd)}
            </p>
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2.5'>
          <span className='bg-background/70 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs'>
            <CalendarClock
              className='text-muted-foreground size-3.5 shrink-0'
              aria-hidden='true'
            />
            <span className='text-muted-foreground'>
              {t('Reset Countdown')}
            </span>
            <span className='font-mono font-semibold tabular-nums'>
              {formatCountdown(props.countdown)}
            </span>
          </span>
          {props.hasOpened && !props.unlimited && (
            <span className='inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400'>
              <Sparkles className='size-3.5' aria-hidden='true' />
              {t('Claimed This Week')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
