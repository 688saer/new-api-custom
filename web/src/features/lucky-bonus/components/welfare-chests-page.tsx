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
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrencyUSD } from '@/lib/format'
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
import { WelfareChestCard } from './welfare-chest-card'
import { WelfareChestRankingCard } from './welfare-chest-ranking-card'
import { WelfareChestsHero } from './welfare-chests-hero'

const CHEST_KEYS: WelfareChestKey[] = ['xiaoshuai_ge', 'hei_dashuai']

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

          <WelfareChestsHero
            weeklyConsumptionUsd={status.weekly_consumption_usd}
            countdown={countdown}
            hasOpened={hasOpened}
            unlimited={unlimited}
          />

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

              return (
                <WelfareChestCard
                  key={key}
                  chestKey={key}
                  box={box}
                  isOpened={isOpened}
                  canOpen={canOpen}
                  blockedByOther={blockedByOther}
                  unlimited={unlimited}
                  opening={opening === key}
                  imageFailed={!!imageFailed[key]}
                  weeklyConsumptionUsd={status.weekly_consumption_usd}
                  claimedRewardUsd={status.opened_reward_usd}
                  onOpen={() => void handleOpen(key)}
                  onImageError={() =>
                    setImageFailed((prev) => ({ ...prev, [key]: true }))
                  }
                />
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