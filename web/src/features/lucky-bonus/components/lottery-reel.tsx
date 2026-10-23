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
import { Dices } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrencyUSD } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { LotteryPrizeTier } from '../types'

interface LotteryReelProps {
  /** Prize tiers cycled across the visible cells. */
  slots: LotteryPrizeTier[]
  activeSlot: number
  highlightSlot: number | null
  running: boolean
  drawing: boolean
  lastPrizes: number[] | null
}

/** Big prizes get a warmer tone than small ones, so a glance reads the result. */
function resultChipClass(prize: number): string {
  if (prize >= 5000000) return 'border-amber-400/60 bg-amber-500/15'
  if (prize >= 1000000) return 'border-sky-400/50 bg-sky-500/10'
  return ''
}

/**
 * The spinning reel. Purely presentational: every animation frame is driven by
 * the page so the reveal stays in step with the settled draw response.
 */
export function LotteryReel(props: LotteryReelProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between gap-2 pb-2'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Dices className='text-primary size-4' />
          {t('Prize slot')}
        </CardTitle>
        {props.running ? (
          <span className='text-primary text-xs font-medium'>
            {t('Rolling...')}
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className='bg-muted/40 rounded-2xl border p-2 shadow-inner'>
          <div className='grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6'>
            {props.slots.map((prize, idx) => {
              const active = props.activeSlot === idx && props.running
              const highlighted = props.highlightSlot === idx
              return (
                <div
                  key={idx}
                  className={cn(
                    'bg-background flex h-16 items-center justify-center rounded-xl border text-sm font-bold tabular-nums transition-all duration-100',
                    prize.quota === 0 && 'text-muted-foreground font-medium',
                    active && 'border-primary bg-primary/10 scale-105',
                    highlighted &&
                      'border-amber-400 bg-amber-500/20 text-amber-700 shadow-lg shadow-amber-500/30 dark:text-amber-300'
                  )}
                >
                  {prize.quota === 0
                    ? t('No prize')
                    : formatCurrencyUSD(prize.quota)}
                </div>
              )
            })}
          </div>
        </div>

        {props.lastPrizes && props.lastPrizes.length > 0 && (
          <div className='bg-muted/30 mt-4 rounded-xl border p-3'>
            <div className='mb-2 flex items-center justify-between gap-2 text-sm'>
              <span className='font-medium'>{t('This round')}</span>
              <span className='text-muted-foreground text-xs'>
                {t('Total')}{' '}
                <span className='text-warning text-sm font-bold tabular-nums'>
                  {formatCurrencyUSD(
                    props.lastPrizes.reduce((sum, prize) => sum + prize, 0)
                  )}
                </span>
              </span>
            </div>
            <div className='flex flex-wrap gap-2'>
              {props.lastPrizes.map((prize, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'bg-background rounded-lg border px-2 py-1 text-sm font-semibold tabular-nums',
                    prize === 0 && 'text-muted-foreground',
                    resultChipClass(prize)
                  )}
                >
                  {prize === 0 ? t('No prize') : formatCurrencyUSD(prize)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
