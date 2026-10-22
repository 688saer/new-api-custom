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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrencyUSD } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  drawLottery,
  getLotteryPublicWins,
  getLotteryRanking,
  getLotteryStatus,
} from '../api'
import type {
  LotteryMode,
  LotteryPublicWin,
  LotteryRankBoard,
  LotteryStatus,
} from '../types'
import { LotteryPublicWins } from './lottery-public-wins'
import { LotteryRankingCard } from './lottery-ranking-card'

/** 老虎机滚动的视觉槽位数量（奖池档位按循环填充） */
const SLOT_COUNT = 12
/** 每个槽位的跳动间隔 */
const SPIN_INTERVAL_MS = 90
/** 中奖后展示结果的停留时间 */
const RESULT_HOLD_MS = 3200

type SpinState = {
  running: boolean
  activeSlot: number
}

export function LuckyLottery() {
  const { t } = useTranslation()

  const [status, setStatus] = useState<LotteryStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [drawing, setDrawing] = useState<LotteryMode | null>(null)
  const [spin, setSpin] = useState<SpinState>({
    running: false,
    activeSlot: 0,
  })
  const [lastPrizes, setLastPrizes] = useState<number[] | null>(null)
  const [highlightSlot, setHighlightSlot] = useState<number | null>(null)

  const [ranking, setRanking] = useState<LotteryRankBoard | null>(null)
  const [rankingLoading, setRankingLoading] = useState(true)
  const [rankingError, setRankingError] = useState<string | null>(null)

  const [publicWins, setPublicWins] = useState<LotteryPublicWin[]>([])
  const [winsLoading, setWinsLoading] = useState(true)

  const spinTimer = useRef<number | null>(null)
  const holdTimer = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (spinTimer.current !== null) {
      window.clearInterval(spinTimer.current)
      spinTimer.current = null
    }
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getLotteryStatus()
      if (res.success && res.data) {
        setStatus(res.data)
      } else {
        setError(res.message || t('Failed to load lottery status'))
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('Failed to load lottery status')
      )
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadRanking = useCallback(async () => {
    setRankingLoading(true)
    setRankingError(null)
    try {
      const res = await getLotteryRanking()
      if (res.success && res.data) {
        setRanking(res.data)
      } else {
        setRankingError(res.message || t("Failed to load today's ranking"))
      }
    } catch (err) {
      setRankingError(
        err instanceof Error
          ? err.message
          : t("Failed to load today's ranking")
      )
    } finally {
      setRankingLoading(false)
    }
  }, [t])

  const loadPublicWins = useCallback(async () => {
    setWinsLoading(true)
    try {
      const res = await getLotteryPublicWins()
      if (res.success && res.data) {
        setPublicWins(res.data.items ?? [])
      }
    } finally {
      setWinsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
    void loadRanking()
    void loadPublicWins()
    return clearTimers
  }, [loadStatus, loadRanking, loadPublicWins, clearTimers])

  // 奖池槽位：奖池循环填充到固定槽位数，保证滚动看起来连续
  const slots = useMemo(() => {
    const prizes = status?.prizes ?? []
    if (prizes.length === 0) return []
    return Array.from({ length: SLOT_COUNT }, (_, i) => prizes[i % prizes.length])
  }, [status?.prizes])

  const stopSpin = useCallback(
    (result: Awaited<ReturnType<typeof drawLottery>>) => {
      if (spinTimer.current !== null) {
        window.clearInterval(spinTimer.current)
        spinTimer.current = null
      }
      const data = result.data
      if (!data) {
        setSpin({ running: false, activeSlot: 0 })
        setDrawing(null)
        return
      }
      const target = data.slot_indexes?.[data.slot_indexes.length - 1] ?? 0
      const slotCount = SLOT_COUNT
      const prizeLen = status?.prizes.length ?? 1
      // 把奖池下标映射到可视槽位
      const visualSlot =
        prizeLen > 0 ? target % prizeLen : 0
      const finalSlot =
        slotCount > 0 ? ((visualSlot % slotCount) + slotCount) % slotCount : 0
      setSpin({ running: false, activeSlot: finalSlot })
      setHighlightSlot(finalSlot)
      setLastPrizes(data.prizes ?? [])

      if ((data.big_wins ?? []).length > 0) {
        toast.success(
          t('Big win! You received {{amount}}', {
            amount: formatCurrencyUSD(data.total_prize),
          })
        )
      } else if (data.total_prize > 0) {
        toast.success(
          t('You received {{amount}}', {
            amount: formatCurrencyUSD(data.total_prize),
          })
        )
      } else {
        toast.info(t('No prize this time, try again'))
      }

      holdTimer.current = window.setTimeout(() => {
        setHighlightSlot(null)
        setLastPrizes(null)
        holdTimer.current = null
      }, RESULT_HOLD_MS)

      setDrawing(null)
      void loadStatus()
      void loadRanking()
      void loadPublicWins()
    },
    [status?.prizes.length, t, loadStatus, loadRanking, loadPublicWins]
  )

  const handleDraw = useCallback(
    async (mode: LotteryMode) => {
      if (drawing || spin.running) return
      setDrawing(mode)
      setHighlightSlot(null)
      setLastPrizes(null)
      setSpin({ running: true, activeSlot: 0 })

      let cursor = 0
      spinTimer.current = window.setInterval(() => {
        cursor = (cursor + 1) % Math.max(SLOT_COUNT, 1)
        setSpin({ running: true, activeSlot: cursor })
      }, SPIN_INTERVAL_MS)

      try {
        const res = await drawLottery(mode)
        if (!res.success) {
          clearTimers()
          setSpin({ running: false, activeSlot: 0 })
          setDrawing(null)
          toast.error(res.message || t('Draw failed'))
          return
        }
        // 即使响应很快，也让动画至少滚动一小段时间再停
        window.setTimeout(() => stopSpin(res), 700)
      } catch (err) {
        clearTimers()
        setSpin({ running: false, activeSlot: 0 })
        setDrawing(null)
        toast.error(err instanceof Error ? err.message : t('Draw failed'))
      }
    },
    [drawing, spin.running, clearTimers, stopSpin, t]
  )

  const canSingle = !!status?.can_single && !drawing && !spin.running
  const canMulti = !!status?.enable_multi && !!status?.can_multi && !drawing && !spin.running

  if (loading) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Lucky Draw')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Skeleton className='h-72 w-full rounded-xl' />
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  if (!status?.enabled) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Lucky Draw')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Card>
            <CardContent className='py-12 text-center text-sm'>
              {error ?? t('Lottery feature is not enabled')}
            </CardContent>
          </Card>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Lucky Draw')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-6'>
          {/* ---------------- 状态栏 ---------------- */}
          <Card>
            <CardContent className='flex flex-wrap items-center justify-between gap-4 p-5'>
              <div>
                <p className='text-muted-foreground text-xs font-medium'>
                  {t('Balance')}
                </p>
                <p className='text-2xl font-bold tracking-tight tabular-nums'>
                  {formatCurrencyUSD(status.quota)}
                </p>
              </div>
              <div className='text-center'>
                <p className='text-muted-foreground text-xs font-medium'>
                  {t('Free draws left today')}
                </p>
                <p className='text-2xl font-bold tracking-tight tabular-nums'>
                  {status.remaining_draws} / {status.daily_draw_limit}
                </p>
              </div>
              <div className='text-center'>
                <p className='text-muted-foreground text-xs font-medium'>
                  {t('Prize received today')}
                </p>
                <p className='text-2xl font-bold tracking-tight tabular-nums text-amber-500'>
                  {status.total_prize_display}
                </p>
              </div>
              <div className='text-center'>
                <p className='text-muted-foreground text-xs font-medium'>
                  {t('Draws used today')}
                </p>
                <p className='text-2xl font-bold tracking-tight tabular-nums'>
                  {status.draws_used_today}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* ---------------- 老虎机 ---------------- */}
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-base'>{t('Prize slot')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6'>
                {slots.map((prize, idx) => {
                  const active = spin.activeSlot === idx
                  const highlighted = highlightSlot === idx
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'flex h-16 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-all duration-100',
                        prize.quota === 0 && 'text-muted-foreground',
                        active && 'scale-105 border-primary bg-primary/10',
                        highlighted &&
                          'border-amber-400 bg-amber-500/15 text-amber-600 shadow-md shadow-amber-500/30 dark:text-amber-300'
                      )}
                    >
                      {prize.quota === 0
                        ? t('No prize')
                        : formatCurrencyUSD(prize.quota)}
                    </div>
                  )
                })}
              </div>

              {lastPrizes && lastPrizes.length > 0 && (
                <div className='bg-muted/30 mt-4 rounded-xl border p-3'>
                  <div className='mb-2 text-sm font-medium'>
                    {t('This round')} · {t('Total')}{' '}
                    <span className='text-amber-500 tabular-nums'>
                      {formatCurrencyUSD(
                        lastPrizes.reduce((sum, p) => sum + p, 0)
                      )}
                    </span>
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    {lastPrizes.map((prize, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'rounded-lg border px-2 py-1 text-sm font-semibold tabular-nums',
                          prize >= 5000000 && 'border-amber-400/50 bg-amber-500/10',
                          prize >= 1000000 &&
                            prize < 5000000 &&
                            'border-sky-400/40 bg-sky-500/10',
                          prize === 0 && 'text-muted-foreground'
                        )}
                      >
                        {prize === 0 ? t('No prize') : formatCurrencyUSD(prize)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className='mt-5 flex flex-col gap-3 sm:flex-row'>
                <Button
                  className='h-11 flex-1 font-medium'
                  disabled={!canSingle}
                  onClick={() => void handleDraw('single')}
                >
                  {drawing === 'single'
                    ? t('Drawing...')
                    : status.remaining_draws > 0
                      ? t('Draw once (free)')
                      : t('Draw once ({{cost}})', {
                          cost: status.single_cost_display,
                        })}
                </Button>
                {status.enable_multi && (
                  <Button
                    variant='outline'
                    className='h-11 flex-1 font-medium'
                    disabled={!canMulti}
                    onClick={() => void handleDraw('multi')}
                  >
                    {drawing === 'multi'
                      ? t('Drawing...')
                      : t('Draw 10 times ({{cost}})', {
                          cost: status.multi_cost_display,
                        })}
                  </Button>
                )}
              </div>

              <p className='text-muted-foreground mt-3 text-xs'>
                {t(
                  'Free draws are granted daily. A 10-draw requires no draw today (remaining ≥ 10). Prizes are credited immediately; interrupting the animation does not refund.'
                )}
              </p>
            </CardContent>
          </Card>

          {/* ---------------- 榜单 ---------------- */}
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <LotteryRankingCard
              title={t("Today's ranking")}
              board={ranking}
              loading={rankingLoading}
              error={rankingError}
            />
            <LotteryPublicWins items={publicWins} loading={winsLoading} />
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
