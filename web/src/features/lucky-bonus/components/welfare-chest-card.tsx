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
import { CheckCircle2, Clock, Gift, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Progress } from '@/components/ui/progress'
import { formatCurrencyUSD } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { WelfareChestBoxStatus, WelfareChestKey } from '../types'

interface WelfareChestCardProps {
  chestKey: WelfareChestKey
  box: WelfareChestBoxStatus | undefined
  isOpened: boolean
  canOpen: boolean
  blockedByOther: boolean
  unlimited: boolean
  opening: boolean
  imageFailed: boolean
  weeklyConsumptionUsd: number
  claimedRewardUsd: number
  onOpen: () => void
  onImageError: () => void
}

/** The two chests differ in temperament, so each gets its own accent. */
function chestAccent(chestKey: WelfareChestKey) {
  return chestKey === 'xiaoshuai_ge'
    ? {
        ring: 'ring-sky-500/20',
        border: 'border-sky-500/40',
        glow: 'from-sky-500/15',
        tone: 'info' as const,
        icon: <Gift className='size-5' />,
      }
    : {
        ring: 'ring-violet-500/20',
        border: 'border-violet-500/40',
        glow: 'from-violet-500/15',
        tone: 'chart-4' as const,
        icon: <Gift className='size-5' />,
      }
}

export function WelfareChestCard(props: WelfareChestCardProps) {
  const { t } = useTranslation()
  const accent = chestAccent(props.chestKey)
  const box = props.box
  const threshold = box?.threshold_usd ?? 0
  const progress =
    threshold > 0
      ? Math.min(100, (props.weeklyConsumptionUsd / threshold) * 100)
      : 0
  const imageSrc = props.isOpened ? box?.opened_image : box?.closed_image
  const title =
    props.chestKey === 'xiaoshuai_ge' ? t('Xiaoshuai Ge Chest') : t('Hei Dashuai Chest')
  const roleName =
    props.chestKey === 'xiaoshuai_ge' ? t('Xiaoshuai Ge') : t('Hei Dashuai')

  let statusBadge = (
    <span className='bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium'>
      <Lock className='size-3.5' aria-hidden='true' />
      {t('Locked')}
    </span>
  )
  if (props.isOpened) {
    statusBadge = (
      <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400'>
        <CheckCircle2 className='size-3.5' aria-hidden='true' />
        {t('Claimed')}
      </span>
    )
  } else if (box?.eligible) {
    statusBadge = (
      <span className='bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold'>
        <Gift className='size-3.5' aria-hidden='true' />
        {t('Eligible')}
      </span>
    )
  }

  let buttonLabel = t('Threshold Not Met')
  if (props.opening) {
    buttonLabel = t('Opening...')
  } else if (props.isOpened && !props.unlimited) {
    buttonLabel = t('Claimed This Week')
  } else if (props.blockedByOther && !props.unlimited) {
    buttonLabel = t('Another Chest Claimed')
  } else if (box?.eligible) {
    buttonLabel = t('Open Chest')
  }

  return (
    <Card
      className={cn(
        'relative flex flex-col overflow-hidden transition-all duration-200',
        props.isOpened && cn(accent.border, accent.ring, 'shadow-md ring-1'),
        props.blockedByOther && 'opacity-70 grayscale-[30%]'
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent',
          accent.glow
        )}
        aria-hidden='true'
      />

      <CardContent className='relative flex flex-1 flex-col gap-4 pt-5'>
        <div className='flex items-start justify-between gap-3'>
          <div className='flex min-w-0 items-center gap-3'>
            <IconBadge tone={accent.tone} size='lg'>
              {accent.icon}
            </IconBadge>
            <div className='min-w-0'>
              <h3 className='truncate text-base font-bold tracking-tight'>
                {title}
              </h3>
              <p className='text-muted-foreground truncate text-xs'>
                {props.chestKey === 'xiaoshuai_ge'
                  ? t('Gentle, balanced, steady weekly gift')
                  : t('Bold, thrilling, high reward variance gift')}
              </p>
            </div>
          </div>
          {statusBadge}
        </div>

        <div className='bg-muted/20 flex h-44 items-center justify-center rounded-xl border border-dashed p-3'>
          {imageSrc && !props.imageFailed ? (
            <img
              src={imageSrc}
              alt={title}
              className={cn(
                'max-h-40 max-w-full object-contain transition-transform duration-300',
                props.isOpened ? 'scale-105' : 'hover:scale-105'
              )}
              loading='lazy'
              onError={props.onImageError}
            />
          ) : (
            <div className='text-muted-foreground flex flex-col items-center gap-2'>
              <Gift className='size-14' aria-hidden='true' />
              <span className='text-xs'>{roleName}</span>
            </div>
          )}
        </div>

        <div className='space-y-2'>
          <div className='flex items-center justify-between gap-2 text-xs'>
            <span className='text-muted-foreground'>
              {t('Unlock Threshold')}
            </span>
            <span className='font-semibold tabular-nums'>
              {formatCurrencyUSD(threshold)}
            </span>
          </div>
          <Progress value={progress} className='h-1.5' />
          <p className='text-muted-foreground text-right text-[11px] tabular-nums'>
            {formatCurrencyUSD(props.weeklyConsumptionUsd)} /{' '}
            {formatCurrencyUSD(threshold)}
          </p>
        </div>

        <div className='grid grid-cols-2 gap-2 text-xs'>
          <div className='bg-muted/40 rounded-lg px-3 py-2'>
            <p className='text-muted-foreground text-[11px]'>
              {t('Reward Range')}
            </p>
            <p className='font-semibold tabular-nums'>
              {formatCurrencyUSD(box?.reward_min_usd ?? 0)} ~{' '}
              {formatCurrencyUSD(box?.reward_max_usd ?? 0)}
            </p>
          </div>
          <div className='bg-muted/40 rounded-lg px-3 py-2'>
            <p className='text-muted-foreground text-[11px]'>
              {t('Median Reward')}
            </p>
            <p className='font-semibold tabular-nums'>
              {formatCurrencyUSD(box?.median_usd ?? 0)}
            </p>
          </div>
        </div>

        {props.isOpened && props.claimedRewardUsd > 0 && (
          <div className='flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400'>
            <span className='font-medium'>{t('Claimed Reward')}</span>
            <span className='text-sm font-bold tabular-nums'>
              +{formatCurrencyUSD(props.claimedRewardUsd)}
            </span>
          </div>
        )}

        {!box?.eligible && !props.isOpened && (
          <p className='text-muted-foreground flex items-start gap-1.5 text-xs'>
            <Clock className='mt-0.5 size-3.5 shrink-0' aria-hidden='true' />
            <span>
              {box?.code === 'NOT_ELIGIBLE'
                ? t('Weekly consumption must reach {{amount}}', {
                    amount: formatCurrencyUSD(threshold),
                  })
                : box?.reason || t('Locked')}
            </span>
          </p>
        )}

        <Button
          className='mt-auto h-10 w-full font-medium'
          disabled={
            !props.canOpen ||
            props.opening ||
            (props.blockedByOther && !props.unlimited)
          }
          aria-busy={props.opening}
          aria-label={
            props.isOpened && !props.unlimited
              ? t('Claimed This Week')
              : props.canOpen
                ? t('Open {{name}} chest', { name: roleName })
                : t('Cannot open chest')
          }
          onClick={props.onOpen}
        >
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
