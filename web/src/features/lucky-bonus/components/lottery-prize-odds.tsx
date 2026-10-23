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
import { ListOrdered } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrencyUSD } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { LotteryPrizeTier } from '../types'

interface LotteryPrizeOddsProps {
  prizes: LotteryPrizeTier[]
}

/**
 * Every tier with its real chance, computed from the weights the server sent.
 * Weights are normalised here rather than assumed to sum to one, because the
 * admin form lets an operator enter any positive weights.
 */
export function LotteryPrizeOdds(props: LotteryPrizeOddsProps) {
  const { t } = useTranslation()

  const tiers = useMemo(() => {
    const totalWeight = props.prizes.reduce(
      (sum, tier) => sum + Math.max(0, tier.weight),
      0
    )
    return props.prizes
      .map((tier) => ({
        ...tier,
        chance: totalWeight > 0 ? (Math.max(0, tier.weight) / totalWeight) * 100 : 0,
      }))
      .sort((a, b) => b.quota - a.quota)
  }, [props.prizes])

  if (tiers.length === 0) return null

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <ListOrdered className='text-primary size-4' />
          {t('Prize odds')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className='space-y-2'>
          {tiers.map((tier) => (
            <li key={tier.index} className='flex items-center gap-3 text-sm'>
              <span
                className={cn(
                  'w-20 shrink-0 font-semibold tabular-nums',
                  tier.quota === 0 && 'text-muted-foreground font-medium'
                )}
              >
                {tier.quota === 0 ? t('No prize') : formatCurrencyUSD(tier.quota)}
              </span>
              <span className='bg-muted h-1.5 flex-1 overflow-hidden rounded-full'>
                <span
                  className={cn(
                    'block h-full rounded-full',
                    tier.quota === 0 ? 'bg-muted-foreground/40' : 'bg-primary'
                  )}
                  style={{ width: `${Math.max(tier.chance, 0.6)}%` }}
                />
              </span>
              <span className='text-muted-foreground w-14 shrink-0 text-right text-xs tabular-nums'>
                {tier.chance.toFixed(2)}%
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
