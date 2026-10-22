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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Lock, Gift, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrencyUSD } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  getWelfareChestsRanking,
  getWelfareChestsStatus,
  openWelfareChest,
} from '../api'
import type {
  WelfareChestKey,
  WelfareChestRankings,
  WelfareChestStatus,
} from '../types'
import { WelfareChestRankingCard } from './welfare-chest-ranking-card'

const CHEST_KEYS: WelfareChestKey[] = ['xiaoshuai_ge', 'hei_dashuai']

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00:00'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(secs)}`
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
}

export function WelfareChests() {
  const { t } = useTranslation()

  const [status, setStatus] = useState<WelfareChestStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState<WelfareChestKey | null>(null)
  const [imageFailed, setImageFailed] = useState<Record<string, boolean>>({})

  const [rankings, setRankings] = useState<WelfareChestRankings>({})
  const [rankingLoading, setRankingLoading] = useState(true)
  const [rankingError, setRankingError] = useState<string | null>(null)

  const [countdown, setCountdown] = useState<number | null>(null)
  const requestId = useRef(0)

  const resolveErrorText = useCallback(
    (code: string | undefined, reason: string | undefined): string => {
      switch (code) {
        case 'ALREADY_OPENED':
          return t('You have already claimed a welfare chest this week')
        case 'NOT_ELIGIBLE':
          return t('Threshold Not Met')
        case 'LOG_UNAVAILABLE':
          return t('Consumption records are temporarily unavailable')
        case 'QUOTA_UNAVAILABLE':
          return t('Quota configuration is temporarily unavailable')
        case 'QUOTA_LIMIT_EXCEEDED':
          return t('Your quota has reached the maximum limit')
        case 'INVALID_CHEST':
          return t('Invalid welfare chest')
        case 'NOT_ENABLED':
          return t('Welfare chest feature is not enabled')
        default:
          return reason || t('Request failed')
      }
    },
    [t]
  )

  const loadStatus = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    try {
      const res = await getWelfareChestsStatus()
      if (current !== requestId.current) return
      if (res.success && res.data) {
        setStatus(res.data)
        setError(res.code ? resolveErrorText(res.code, res.reason) : null)
      } else {
        setError(
          resolveErrorText(
            res.code,
            res.message || t('Failed to load welfare chests status')
          )
        )
      }
    } catch (err) {
      if (current !== requestId.current) return
      setError(
        err instanceof Error
          ? err.message
          : t('Failed to load welfare chests status')
      )
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [resolveErrorText, t])

  const loadRankings = useCallback(async () => {
    setRankingLoading(true)
    setRankingError(null)
    try {
      const res = await getWelfareChestsRanking()
      if (res.success && res.data) {
        setRankings(res.data)
      } else {
        setRankingError(t('Failed to load weekly ranking'))
      }
    } catch {
      setRankingError(t('Failed to load weekly ranking'))
    } finally {
      setRankingLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadStatus()
    void loadRankings()
  }, [loadStatus, loadRankings])

  // 每周重置倒计时
  useEffect(() => {
    if (!status?.week_end) return
    const tick = () => {
      const now = Math.floor(Date.now() / 1000)
      setCountdown(Math.max(0, status.week_end - now))
    }
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [status?.week_end])

  const handleOpen = useCallback(
    async (chest: WelfareChestKey) => {
      if (opening) return
      setOpening(chest)
      try {
        const res = await openWelfareChest(chest)
        if (res.success && res.data) {
          toast.success(
            t('Congratulations! You opened the chest and received {{amount}}', {
              amount: formatCurrencyUSD(res.data.reward_quota),
            })
          )
          await loadStatus()
          await loadRankings()
          return
        }
        toast.error(resolveErrorText(res.code, res.message || res.reason))
        await loadStatus()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : t('Failed to open chest')
        )
      } finally {
        setOpening(null)
      }
    },
    [opening, t, resolveErrorText, loadStatus, loadRankings]
  )

  const chestTitle = useCallback(
    (key: WelfareChestKey) =>
      key === 'xiaoshuai_ge' ? t('Xiaoshuai Ge Chest') : t('Hei Dashuai Chest'),
    [t]
  )

  const chestRoleName = useCallback(
    (key: WelfareChestKey) =>
      key === 'xiaoshuai_ge' ? t('Xiaoshuai Ge') : t('Hei Dashuai'),
    [t]
  )

  const chestDesc = useCallback(
    (key: WelfareChestKey) =>
      key === 'xiaoshuai_ge'
        ? t('Gentle, balanced, steady weekly gift')
        : t('Bold, thrilling, high reward variance gift'),
    [t]
  )

  if (loading && !status) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Welfare Chests')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Skeleton className='h-72 w-full rounded-xl' />
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  if (!status?.enabled) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Welfare Chests')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Card>
            <CardContent className='py-12 text-center text-sm'>
              {error ?? t('Welfare chest feature is not enabled')}
            </CardContent>
          </Card>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  const hasOpened = !!status.opened_chest
  const unlimited = !!status.unlimited_open

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Welfare Chests')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex max-w-6xl flex-col gap-6'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Weekly consumption reward chests: choose either Xiaoshuai Ge or Hei Dashuai to claim once per week'
            )}
          </p>

          {/* ---------------- 本周消费 + 倒计时 ---------------- */}
          <Card>
            <CardContent className='flex flex-wrap items-center justify-between gap-4 p-5'>
              <div className='flex items-center gap-3'>
                <div className='bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl'>
                  <Gift className='size-5' aria-hidden='true' />
                </div>
                <div>
                  <p className='text-muted-foreground text-xs font-medium'>
                    {t('This Week Consumption')}
                  </p>
                  <p className='text-2xl font-bold tracking-tight tabular-nums'>
                    {formatCurrencyUSD(status.weekly_consumption_usd)}
                  </p>
                </div>
              </div>
              <div className='bg-muted/40 flex items-center gap-2.5 rounded-lg border px-3.5 py-2 text-sm'>
                <Clock
                  className='text-muted-foreground size-4 shrink-0'
                  aria-hidden='true'
                />
                <span className='text-muted-foreground text-xs'>
                  {t('Reset Countdown')}:
                </span>
                <span className='font-mono font-medium tabular-nums'>
                  {countdown === null ? '--:--:--' : formatCountdown(countdown)}
                </span>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div
              role='alert'
              className='border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-4 text-sm'
            >
              <span>{error}</span>
              <Button
                variant='outline'
                size='sm'
                className='ml-auto'
                onClick={() => void loadStatus()}
              >
                {t('Retry')}
              </Button>
            </div>
          )}

          {/* ---------------- 宝箱卡片 ---------------- */}
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            {CHEST_KEYS.map((key) => {
              const box = status.boxes[key]
              const isOpened = status.opened_chest === key
              const isEligible = !!box?.eligible
              const blockedByOther = hasOpened && !isOpened && !unlimited
              const canOpen =
                !!status.can_open_any &&
                isEligible &&
                (!hasOpened || unlimited) &&
                opening === null
              const imageSrc = isOpened
                ? box?.opened_image
                : box?.closed_image

              return (
                <Card
                  key={key}
                  className={cn(
                    'flex flex-col justify-between overflow-hidden border-border/70 transition-all duration-200',
                    isOpened &&
                      'border-primary/50 shadow-md ring-1 ring-primary/20',
                    blockedByOther && 'opacity-70 grayscale-[30%]'
                  )}
                >
                  <CardHeader className='pb-3'>
                    <div className='flex items-center justify-between'>
                      <CardTitle className='text-lg font-bold'>
                        {chestTitle(key)}
                      </CardTitle>
                      {isOpened ? (
                        <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400'>
                          <CheckCircle2
                            className='size-3.5'
                            aria-hidden='true'
                          />
                          {t('Claimed')}
                        </span>
                      ) : isEligible ? (
                        <span className='bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold'>
                          <Gift className='size-3.5' aria-hidden='true' />
                          {t('Eligible')}
                        </span>
                      ) : (
                        <span className='bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium'>
                          <Lock className='size-3.5' aria-hidden='true' />
                          {t('Locked')}
                        </span>
                      )}
                    </div>
                    <p className='text-muted-foreground text-xs'>
                      {chestDesc(key)}
                    </p>
                  </CardHeader>

                  <CardContent className='flex flex-1 flex-col items-center justify-between gap-5'>
                    <div className='bg-muted/20 relative flex h-52 w-full items-center justify-center rounded-xl p-2'>
                      {imageSrc && !imageFailed[key] ? (
                        <img
                          src={imageSrc}
                          alt={chestTitle(key)}
                          className={cn(
                            'max-h-48 max-w-full object-contain transition-transform duration-300',
                            isOpened ? 'scale-105' : 'hover:scale-105'
                          )}
                          loading='lazy'
                          onError={() =>
                            setImageFailed((prev) => ({ ...prev, [key]: true }))
                          }
                        />
                      ) : (
                        <div className='text-muted-foreground flex flex-col items-center gap-2'>
                          <Gift className='size-16' aria-hidden='true' />
                          <span className='text-xs'>
                            {chestRoleName(key)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className='w-full space-y-2.5 text-xs'>
                      <div className='bg-muted/40 flex items-center justify-between rounded-md px-3 py-2'>
                        <span className='text-muted-foreground'>
                          {t('Unlock Threshold')}
                        </span>
                        <span className='font-semibold tabular-nums'>
                          {formatCurrencyUSD(box?.threshold_usd ?? 0)}
                        </span>
                      </div>
                      <div className='bg-muted/40 flex items-center justify-between rounded-md px-3 py-2'>
                        <span className='text-muted-foreground'>
                          {t('Reward Range')}
                        </span>
                        <span className='font-semibold tabular-nums'>
                          {formatCurrencyUSD(box?.reward_min_usd ?? 0)} ~{' '}
                          {formatCurrencyUSD(box?.reward_max_usd ?? 0)}
                        </span>
                      </div>
                      <div className='bg-muted/40 flex items-center justify-between rounded-md px-3 py-2'>
                        <span className='text-muted-foreground'>
                          {t('Median Reward')}
                        </span>
                        <span className='font-semibold tabular-nums'>
                          {formatCurrencyUSD(box?.median_usd ?? 0)}
                        </span>
                      </div>
                      {isOpened && status.opened_reward_usd > 0 && (
                        <div className='flex items-center justify-between rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-400'>
                          <span className='font-medium'>
                            {t('Claimed Reward')}
                          </span>
                          <span className='text-sm font-bold tabular-nums'>
                            +{formatCurrencyUSD(status.opened_reward_usd)}
                          </span>
                        </div>
                      )}
                      {!isEligible && box?.reason && !isOpened && (
                        <p className='text-muted-foreground text-center text-xs'>
                          {box.code === 'NOT_ELIGIBLE'
                            ? t(
                                'Weekly consumption must reach {{amount}}',
                                {
                                  amount: formatCurrencyUSD(
                                    box.threshold_usd ?? 0
                                  ),
                                }
                              )
                            : resolveErrorText(box.code, box.reason)}
                        </p>
                      )}
                    </div>

                    <Button
                      className='h-10 w-full font-medium'
                      disabled={
                        loading ||
                        !canOpen ||
                        opening !== null ||
                        (blockedByOther && !unlimited)
                      }
                      aria-busy={opening === key}
                      aria-label={
                        isOpened && !unlimited
                          ? t('Claimed This Week')
                          : canOpen
                            ? t('Open {{name}} chest', {
                                name: chestRoleName(key),
                              })
                            : t('Cannot open chest')
                      }
                      onClick={() => void handleOpen(key)}
                    >
                      {opening === key
                        ? t('Opening...')
                        : isOpened && !unlimited
                          ? t('Claimed This Week')
                          : blockedByOther && !unlimited
                            ? t('Another Chest Claimed')
                            : isEligible
                              ? t('Open Chest')
                              : t('Threshold Not Met')}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* ---------------- 榜单 ---------------- */}
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <WelfareChestRankingCard
              title={t('Xiaoshuai Ge ranking')}
              board={rankings.xiaoshuai_ge}
              loading={rankingLoading}
              error={rankingError}
            />
            <WelfareChestRankingCard
              title={t('Hei Dashuai ranking')}
              board={rankings.hei_dashuai}
              loading={rankingLoading}
              error={rankingError}
            />
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
