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

import { EmptyState } from '@/components/empty-state'
import { formatTimestampRelative } from '@/lib/format'

import { displayWinnerName } from '../lib/wheel'
import type { WheelWin } from '../types'

interface WheelPublicWinsProps {
  items: WheelWin[]
  loading: boolean
}

/** 公开中奖动态，用户名由后端脱敏后下发。 */
export function WheelPublicWins(props: WheelPublicWinsProps) {
  const { t } = useTranslation()

  if (props.loading && props.items.length === 0) {
    return (
      <div className='space-y-2' aria-hidden='true'>
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className='bg-muted/60 h-9 animate-pulse rounded-lg'
          />
        ))}
      </div>
    )
  }

  if (props.items.length === 0) {
    return (
      <EmptyState
        title={t('No winner yet')}
        description={t('Be the first one to win a prize today.')}
      />
    )
  }

  return (
    <ul className='divide-border max-h-72 divide-y overflow-y-auto pr-1'>
      {props.items.map((win) => (
        <li
          key={win.id}
          className='flex items-center justify-between gap-3 py-2 text-sm'
        >
          <span className='flex min-w-0 items-center gap-2'>
            <span aria-hidden='true' className='text-base'>
              {win.prize_icon || '🎁'}
            </span>
            <span className='truncate'>
              <span className='text-muted-foreground'>
                {displayWinnerName(win.username)}
              </span>
              <span className='text-muted-foreground mx-1.5'>·</span>
              <span className='font-medium'>{win.prize_name}</span>
            </span>
          </span>
          <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
            {win.created_at > 0 ? formatTimestampRelative(win.created_at) : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}
