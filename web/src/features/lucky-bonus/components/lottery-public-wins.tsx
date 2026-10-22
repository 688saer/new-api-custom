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

import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrencyUSD } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { LotteryPublicWin } from '../types'

type LotteryPublicWinsProps = {
  items: LotteryPublicWin[]
  loading: boolean
}

export function LotteryPublicWins(props: LotteryPublicWinsProps) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base'>{t('Recent big wins')}</CardTitle>
      </CardHeader>
      <div className='px-6 pb-6'>
        {props.loading ? (
          <p className='text-muted-foreground py-4 text-center text-sm'>
            {t('Loading...')}
          </p>
        ) : props.items.length === 0 ? (
          <p className='text-muted-foreground py-4 text-center text-sm'>
            {t('No lottery draws yet today')}
          </p>
        ) : (
          <ul className='max-h-64 space-y-1 overflow-y-auto'>
            {props.items.map((item, idx) => (
              <li
                key={`${item.date}-${item.username}-${idx}`}
                className={cn(
                  'flex items-center justify-between rounded-md px-2 py-1.5 text-sm',
                  item.is_me
                    ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20'
                    : 'hover:bg-muted/50'
                )}
              >
                <span className='min-w-0 flex-1 truncate'>
                  {item.username}
                  <span className='text-muted-foreground ml-2 text-xs'>
                    {item.date}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 font-semibold tabular-nums',
                    item.prize >= 5000000 && 'text-amber-500'
                  )}
                >
                  {formatCurrencyUSD(item.prize)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
