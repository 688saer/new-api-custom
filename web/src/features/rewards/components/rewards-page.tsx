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
import { Clock, Gift } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'
import { formatDateTimeObject } from '@/lib/time'

import { getPendingRewards, getRewardHistory } from '../api'
import { isRewardClaimable } from '../lib/rewards'
import type {
  RewardClaimResult,
  RewardHistoryResult,
  RewardItem,
  RewardPendingResult,
} from '../types'
import { RewardClaimDialog } from './reward-claim-dialog'
import { RewardHistoryTable } from './reward-history-table'
import { RewardTicket } from './reward-ticket'

const HISTORY_PAGE_SIZE = 20

/** 把后端错误码翻成用户能读懂的文案。 */
function useRewardErrorText() {
  const { t } = useTranslation()
  return useCallback(
    (code: string | undefined, reason: string | undefined): string => {
      switch (code) {
        case 'REWARD_NOT_ENABLED':
          return t('Reward feature is not enabled')
        case 'REWARD_NOT_FOUND':
          return t('This reward no longer exists')
        case 'REWARD_ALREADY_CLAIMED':
          return t('This reward has already been claimed')
        case 'REWARD_CANCELLED':
          return t('This reward has been withdrawn')
        case 'REWARD_EXPIRED':
          return t('This reward has expired')
        case 'REWARD_QUOTA_LIMIT_EXCEEDED':
          return t('Your quota has reached the maximum limit')
        case 'REWARD_QUOTA_UNAVAILABLE':
          return t('Quota configuration is temporarily unavailable')
        default:
          return reason || t('Request failed, please try again later.')
      }
    },
    [t]
  )
}

/**
 * 我的奖励：待领取券面列表 + 领取记录。
 *
 * 对应参考站 `/rewards` 的「奖励金」页签；红包页签依赖对方的额外模块，本站
 * 没有等价功能，因此不做空壳占位。
 */
export function RewardsPage() {
  const { t } = useTranslation()
  const resolveError = useRewardErrorText()

  const [pending, setPending] = useState<RewardPendingResult | null>(null)
  const [pendingLoading, setPendingLoading] = useState(true)
  const [pendingError, setPendingError] = useState<string | null>(null)

  const [history, setHistory] = useState<RewardHistoryResult | null>(null)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState<RewardItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const pendingSeq = useRef(0)
  const historySeq = useRef(0)

  const loadPending = useCallback(async () => {
    const seq = ++pendingSeq.current
    setPendingLoading(true)
    try {
      const res = await getPendingRewards()
      if (seq !== pendingSeq.current) return
      if (res.success && res.data) {
        setPending(res.data)
        setPendingError(null)
      } else {
        setPendingError(resolveError(res.code, res.reason))
      }
    } catch {
      if (seq === pendingSeq.current) {
        setPendingError(t('Request failed, please try again later.'))
      }
    } finally {
      if (seq === pendingSeq.current) setPendingLoading(false)
    }
  }, [resolveError, t])

  const loadHistory = useCallback(
    async (targetPage: number) => {
      const seq = ++historySeq.current
      setHistoryLoading(true)
      try {
        const res = await getRewardHistory(targetPage, HISTORY_PAGE_SIZE)
        if (seq !== historySeq.current) return
        if (res.success && res.data) {
          setHistory(res.data)
          setHistoryError(null)
        } else {
          setHistoryError(resolveError(res.code, res.reason))
        }
      } catch {
        if (seq === historySeq.current) {
          setHistoryError(t('Request failed, please try again later.'))
        }
      } finally {
        if (seq === historySeq.current) setHistoryLoading(false)
      }
    },
    [resolveError, t]
  )

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  useEffect(() => {
    void loadHistory(page)
  }, [loadHistory, page])

  const handleClaimed = useCallback(
    (result: RewardClaimResult) => {
      setPending((current) => {
        if (!current) return current
        const items = current.items.filter((item) => item.id !== selected?.id)
        return {
          ...current,
          items,
          count: items.length,
          total_quota: items.reduce((sum, item) => sum + item.amount_quota, 0),
        }
      })
      setPage(1)
      void loadHistory(1)
      // 到账后余额已变，页面下次进入时会重新取；这里只同步本轮结果。
      if (!result.already_claimed) {
        setSelected(null)
      }
    },
    [loadHistory, selected?.id]
  )

  const handleOpenClaim = (reward: RewardItem) => {
    setSelected(reward)
    setDialogOpen(true)
  }

  const items = useMemo(() => pending?.items ?? [], [pending])

  const renderPending = () => {
    if (pendingLoading && !pending) {
      return (
        <div className='grid gap-6 sm:grid-cols-2 xl:grid-cols-3'>
          <Skeleton className='aspect-[741/425] w-full rounded-xl' />
          <Skeleton className='aspect-[741/425] w-full rounded-xl' />
        </div>
      )
    }
    if (pendingError != null) {
      return (
        <EmptyState
          icon={Gift}
          title={pendingError}
          description={t('Reload the page to try again.')}
        />
      )
    }
    if (pending && !pending.enabled) {
      return (
        <EmptyState
          icon={Gift}
          title={t('Reward feature is not enabled')}
          description={t(
            'The site operator has turned the reward feature off.'
          )}
        />
      )
    }
    if (items.length === 0) {
      return (
        <EmptyState
          icon={Gift}
          title={t('No rewards to claim')}
          description={t('Rewards from the site operator will show up here.')}
        />
      )
    }

    return (
      <div className='grid gap-6 sm:grid-cols-2 xl:grid-cols-3'>
        {items.map((item) => {
          const claimable = isRewardClaimable(item.status, item.expires_at)
          return (
            <article
              key={item.id}
              className='group/ticket max-w-[600px] min-w-0 space-y-3'
            >
              <RewardTicket
                style={item.style}
                copy={item.copy}
                amount={formatQuota(item.amount_quota)}
              />
              <div className='flex items-center justify-between gap-3'>
                <span className='text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs'>
                  <Clock aria-hidden='true' className='size-3.5 shrink-0' />
                  <span className='truncate'>
                    {item.expires_at > 0
                      ? t('Valid until {{date}}', {
                          date: formatDateTimeObject(
                            new Date(item.expires_at * 1000)
                          ),
                        })
                      : t('Long-term valid')}
                  </span>
                </span>
              </div>
              <Button
                className='w-full'
                variant={claimable ? 'default' : 'outline'}
                disabled={!claimable}
                onClick={() => handleOpenClaim(item)}
              >
                <Gift aria-hidden='true' className='size-4' />
                {claimable
                  ? item.copy.button_text || t('Claim reward')
                  : t('Expired')}
              </Button>
            </article>
          )
        })}
      </div>
    )
  }

  const renderHistory = () => {
    if (historyLoading && !history) {
      return <Skeleton className='h-40 w-full rounded-lg' />
    }
    if (historyError != null) {
      return (
        <EmptyState
          icon={Gift}
          title={historyError}
          action={
            <Button variant='outline' onClick={() => void loadHistory(page)}>
              {t('Reload')}
            </Button>
          }
        />
      )
    }
    if (!history || history.items.length === 0) {
      return <EmptyState icon={Gift} title={t('No claim history yet')} />
    }
    return (
      <RewardHistoryTable
        items={history.items}
        page={history.page}
        pageSize={history.page_size}
        total={history.total}
        onPageChange={setPage}
      />
    )
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('My rewards')}</SectionPageLayout.Title>

        <SectionPageLayout.Content>
          <div className='space-y-8'>
            <div className='from-primary/12 via-primary/6 relative overflow-hidden rounded-xl border bg-gradient-to-br to-transparent p-5 sm:p-6'>
              <span
                aria-hidden='true'
                className='pointer-events-none absolute -end-6 -top-8 size-32 rounded-full bg-current opacity-[0.04]'
              />
              <div className='relative flex flex-wrap items-end justify-between gap-6'>
                <div className='space-y-1.5'>
                  <p className='text-muted-foreground text-xs tracking-wide uppercase'>
                    {t('Available to claim')}
                  </p>
                  <strong
                    data-testid='reward-pending-total'
                    className='block text-3xl leading-none font-bold tabular-nums sm:text-4xl'
                  >
                    {formatQuota(pending?.total_quota ?? 0)}
                  </strong>
                </div>
                <span className='bg-background/70 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium'>
                  <Gift aria-hidden='true' className='size-3.5' />
                  {t('{{count}} rewards to claim', {
                    count: pending?.count ?? 0,
                  })}
                </span>
              </div>
            </div>

            <section className='space-y-4'>{renderPending()}</section>

            <section className='space-y-4 border-t pt-6'>
              <div className='flex items-center justify-between gap-3'>
                <h3 className='font-semibold'>{t('Claim history')}</h3>
                {history != null && history.total > 0 && (
                  <span className='text-muted-foreground text-xs tabular-nums'>
                    {t('{{count}} records', { count: history.total })}
                  </span>
                )}
              </div>
              {renderHistory()}
            </section>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <RewardClaimDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        reward={selected}
        onClaimed={handleClaimed}
        resolveError={resolveError}
      />
    </>
  )
}
