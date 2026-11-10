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
import { Coins, Gift, Sparkles, Ticket, Trophy } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useMediaQuery } from '@/hooks'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  getMyWheelWins,
  getWheelPublicWins,
  getWheelStatus,
  spinWheel,
  submitWheelAddress,
} from '../api'
import {
  WHEEL_PRIZE_TYPE_HINT_KEYS,
  WHEEL_PRIZE_TYPE_LABEL_KEYS,
  getWheelToneStyle,
  resolvePrizeIndex,
  targetRotation,
} from '../lib/wheel'
import type { WheelStatus, WheelSpinResult, WheelWin } from '../types'
import { SpinResultDialog } from './spin-result-dialog'
import { WheelAddressForm } from './wheel-address-form'
import { WheelConfetti } from './wheel-confetti'
import { WheelDisc } from './wheel-disc'
import { WheelPublicWins } from './wheel-public-wins'
import { WheelRecords } from './wheel-records'

/** 转盘旋转时长，需与 WheelDisc 的过渡时长保持一致。 */
const SPIN_DURATION_MS = 4600
const RECORDS_PAGE_SIZE = 8

export function LuckyWheel() {
  const { t } = useTranslation()
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  const [status, setStatus] = useState<WheelStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [highlight, setHighlight] = useState<number | null>(null)
  const [celebrate, setCelebrate] = useState(false)

  const [result, setResult] = useState<WheelSpinResult | null>(null)
  const [resultOpen, setResultOpen] = useState(false)

  const [wins, setWins] = useState<WheelWin[]>([])
  const [winsTotal, setWinsTotal] = useState(0)
  const [winsPage, setWinsPage] = useState(1)
  const [winsLoading, setWinsLoading] = useState(true)
  const [winsError, setWinsError] = useState<string | null>(null)

  const [publicWins, setPublicWins] = useState<WheelWin[]>([])
  const [publicWinsLoading, setPublicWinsLoading] = useState(true)

  const [claimTarget, setClaimTarget] = useState<WheelWin | null>(null)
  const [claimSubmitting, setClaimSubmitting] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)

  const rotationRef = useRef(0)

  const loadStatus = useCallback(async () => {
    try {
      const res = await getWheelStatus()
      if (!res.success || !res.data) {
        setError(res.reason || res.message || t('Failed to load lucky wheel'))
        setLoading(false)
        return
      }
      setStatus(res.data)
      setError(null)
    } catch {
      setError(t('Failed to load lucky wheel'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const loadWins = useCallback(
    async (page: number) => {
      setWinsLoading(true)
      setWinsError(null)
      try {
        const res = await getMyWheelWins(page, RECORDS_PAGE_SIZE)
        if (!res.success || !res.data) {
          setWinsError(
            res.reason || res.message || t('Failed to load prize records')
          )
          return
        }
        setWins(res.data.items)
        setWinsTotal(res.data.total)
        setWinsPage(page)
      } catch {
        setWinsError(t('Failed to load prize records'))
      } finally {
        setWinsLoading(false)
      }
    },
    [t]
  )

  const loadPublicWins = useCallback(async () => {
    setPublicWinsLoading(true)
    try {
      const res = await getWheelPublicWins()
      if (res.success && res.data) {
        setPublicWins(res.data.items)
      }
    } catch {
      setPublicWins([])
    } finally {
      setPublicWinsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
    void loadWins(1)
    void loadPublicWins()
  }, [loadStatus, loadWins, loadPublicWins])

  const handleSpin = async () => {
    if (!status || !status.can_spin || spinning || status.prizes.length === 0) {
      return
    }
    setSpinning(true)
    setCelebrate(false)
    setHighlight(null)
    try {
      const res = await spinWheel()
      if (!res.success || !res.data) {
        toast.error(
          res.reason || res.message || t('Draw failed, please try again later.')
        )
        setSpinning(false)
        return
      }
      const data = res.data
      const landedIndex = resolvePrizeIndex(
        status.prizes,
        data.prize_id,
        data.prize_index
      )
      const nextRotation = targetRotation(
        rotationRef.current,
        landedIndex,
        status.prizes.length
      )
      rotationRef.current = nextRotation
      setRotation(nextRotation)

      if (!reducedMotion) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, SPIN_DURATION_MS)
        )
      }
      setSpinning(false)
      setHighlight(landedIndex)
      setResult(data)
      setResultOpen(true)
      if (data.prize_type !== 'none') {
        setCelebrate(true)
      }
      void loadStatus()
      void loadWins(1)
      void loadPublicWins()
    } catch {
      toast.error(t('Draw failed, please try again later.'))
      setSpinning(false)
    }
  }

  const handleClaimSubmit = async (values: {
    receiver_name: string
    receiver_phone: string
    receiver_address: string
  }) => {
    if (!claimTarget) return
    setClaimSubmitting(true)
    setClaimError(null)
    try {
      const res = await submitWheelAddress(claimTarget.id, values)
      if (!res.success || !res.data) {
        setClaimError(
          res.reason ||
            res.message ||
            t('Request failed, please try again later.')
        )
        return
      }
      toast.success(t('Shipping address saved'))
      setClaimTarget(null)
      void loadWins(winsPage)
    } catch {
      setClaimError(t('Request failed, please try again later.'))
    } finally {
      setClaimSubmitting(false)
    }
  }

  const handleResultOpenChange = (open: boolean) => {
    setResultOpen(open)
    if (!open) {
      setCelebrate(false)
    }
  }

  const renderActionLabel = () => {
    if (spinning) return t('Spinning…')
    if ((status?.remaining_draws ?? 0) > 0) return t('Spin free')
    return t('Spin now')
  }

  const renderHintLabel = () => {
    if (spinning) return t('Good luck')
    if ((status?.remaining_draws ?? 0) > 0) {
      return t('{{count}} free left', { count: status?.remaining_draws ?? 0 })
    }
    return status ? formatQuota(status.single_cost) : '—'
  }

  if (loading) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Lucky Wheel')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='flex flex-col gap-6'>
            <Skeleton className='h-28 w-full rounded-2xl' />
            <Skeleton className='mx-auto h-80 w-80 rounded-full' />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  if (error != null || !status) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Lucky Wheel')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Card>
            <CardContent className='py-10 text-center'>
              <p role='alert' className='text-destructive text-sm'>
                {error ?? t('Failed to load lucky wheel')}
              </p>
            </CardContent>
          </Card>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  if (!status.enabled) {
    return (
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Lucky Wheel')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Card>
            <CardContent className='grid justify-items-center gap-3 py-16 text-center'>
              <Gift
                aria-hidden='true'
                className='text-muted-foreground size-10'
              />
              <p className='font-semibold'>{t('Lucky wheel is closed')}</p>
              <p className='text-muted-foreground max-w-sm text-sm'>
                {t(
                  'The activity is not running right now. Please come back later.'
                )}
              </p>
            </CardContent>
          </Card>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Lucky Wheel')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='flex flex-col gap-6'>
            {/* 活动头图 */}
            <div className='relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-5 text-white shadow-lg sm:p-6'>
              <div
                aria-hidden='true'
                className='pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/20 blur-2xl'
              />
              <div className='relative flex flex-wrap items-end justify-between gap-4'>
                <div className='min-w-0'>
                  <p className='flex items-center gap-2 text-xs font-medium tracking-widest text-white/80 uppercase'>
                    <Sparkles aria-hidden='true' className='size-3.5' />
                    {t('Activity draw')}
                  </p>
                  <h1 className='mt-1 truncate text-2xl font-black sm:text-3xl'>
                    {status.title || t('Lucky Wheel')}
                  </h1>
                  <p className='mt-1 max-w-xl text-sm text-white/85'>
                    {status.subtitle ||
                      t(
                        'Everyone gets free daily draws. Physical, card keys, credits, codes and plans are all on the wheel.'
                      )}
                  </p>
                </div>
                <dl className='flex flex-wrap gap-2 text-xs'>
                  <StatPill
                    icon={<Ticket aria-hidden='true' className='size-3.5' />}
                    label={t('Free draws left')}
                    value={String(status.remaining_draws)}
                  />
                  <StatPill
                    icon={<Trophy aria-hidden='true' className='size-3.5' />}
                    label={t('Won today')}
                    value={String(status.today_win_count)}
                  />
                  <StatPill
                    icon={<Coins aria-hidden='true' className='size-3.5' />}
                    label={t('Balance')}
                    value={formatQuota(status.quota)}
                  />
                </dl>
              </div>
            </div>

            <div className='grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]'>
              {/* 转盘 */}
              <Card className='overflow-hidden'>
                <CardContent className='relative bg-[radial-gradient(circle_at_top,#3b1d05_0%,#1b0f06_55%,#120a04_100%)] py-8'>
                  <WheelConfetti active={celebrate} />
                  <WheelDisc
                    prizes={status.prizes}
                    rotation={rotation}
                    spinning={spinning}
                    highlightIndex={highlight}
                    spinDurationMs={SPIN_DURATION_MS}
                    reducedMotion={reducedMotion}
                    actionLabel={renderActionLabel()}
                    hintLabel={renderHintLabel()}
                    disabled={spinning || !status.can_spin}
                    onSpin={() => void handleSpin()}
                  />
                  <div className='mt-6 flex flex-col items-center gap-1 text-center'>
                    <p className='text-xs text-amber-100/80'>
                      {status.remaining_draws > 0
                        ? t('You still have {{count}} free draws today', {
                            count: status.remaining_draws,
                          })
                        : t('Each additional draw costs {{amount}}', {
                            amount: formatQuota(status.single_cost),
                          })}
                    </p>
                    {status.daily_draw_limit > 0 ? (
                      <p className='text-[11px] text-amber-100/60'>
                        {t('Daily draw limit: {{count}}', {
                          count: status.daily_draw_limit,
                        })}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {/* 奖品与规则 */}
              <div className='flex flex-col gap-6'>
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='flex items-center gap-2 text-sm'>
                      <Gift
                        aria-hidden='true'
                        className='size-4 text-amber-500'
                      />
                      {t('Prizes and how to claim')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='max-h-[420px] space-y-2.5 overflow-y-auto pr-1'>
                    {status.prizes.map((prize, index) => {
                      const style = getWheelToneStyle(prize.color, index)
                      return (
                        <div
                          key={prize.id}
                          className={cn(
                            'flex items-start gap-2.5 rounded-lg px-2 py-1.5',
                            prize.available ? '' : 'opacity-50'
                          )}
                        >
                          <span
                            aria-hidden='true'
                            className='mt-1.5 size-2.5 shrink-0 rounded-full'
                            style={{ backgroundColor: style.dot }}
                          />
                          <div className='min-w-0 flex-1'>
                            <p className='flex items-center gap-1.5 text-sm font-medium'>
                              <span className='truncate'>
                                {prize.icon ? `${prize.icon} ` : ''}
                                {prize.name}
                              </span>
                              {prize.label ? (
                                <Badge variant='warning' className='shrink-0'>
                                  {prize.label}
                                </Badge>
                              ) : null}
                              {prize.available ? null : (
                                <Badge variant='outline' className='shrink-0'>
                                  {t('All claimed')}
                                </Badge>
                              )}
                            </p>
                            <p className='text-muted-foreground text-xs'>
                              {t(WHEEL_PRIZE_TYPE_LABEL_KEYS[prize.type])} ·{' '}
                              {t(WHEEL_PRIZE_TYPE_HINT_KEYS[prize.type])}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                {status.rules_text.trim() !== '' ? (
                  <Card>
                    <CardHeader className='pb-3'>
                      <CardTitle className='text-sm'>
                        {t('Activity rules')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className='text-muted-foreground space-y-1 text-xs leading-relaxed'>
                      {status.rules_text
                        .split('\n')
                        .filter((line) => line.trim() !== '')
                        .map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </div>

            <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-sm'>{t('My prizes')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <WheelRecords
                    items={wins}
                    total={winsTotal}
                    page={winsPage}
                    pageSize={RECORDS_PAGE_SIZE}
                    loading={winsLoading}
                    error={winsError}
                    onPageChange={(page) => void loadWins(page)}
                    onClaim={(win) => {
                      setClaimError(null)
                      setClaimTarget(win)
                    }}
                  />
                </CardContent>
              </Card>

              {status.show_public_wins ? (
                <Card>
                  <CardHeader className='pb-3'>
                    <CardTitle className='text-sm'>
                      {t('Recent winners')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <WheelPublicWins
                      items={publicWins}
                      loading={publicWinsLoading}
                    />
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <SpinResultDialog
        open={resultOpen}
        result={result}
        redemptionExpireDays={status.redemption_expire_days}
        onOpenChange={handleResultOpenChange}
        onAddressSubmitted={() => {
          void loadWins(1)
        }}
      />

      <Dialog
        open={claimTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setClaimTarget(null)
            setClaimError(null)
          }
        }}
        title={t('Fill shipping address')}
        description={t(
          'We will ship the prize after the address is confirmed.'
        )}
        contentClassName='sm:max-w-md'
        contentHeight='auto'
      >
        <WheelAddressForm
          submitting={claimSubmitting}
          error={claimError}
          submitLabel={t('Save shipping address')}
          onSubmit={handleClaimSubmit}
        />
      </Dialog>
    </>
  )
}

interface StatPillProps {
  icon: React.ReactNode
  label: string
  value: string
}

function StatPill(props: StatPillProps) {
  return (
    <div className='rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur-sm'>
      <dt className='flex items-center gap-1 text-[11px] text-white/80'>
        {props.icon}
        {props.label}
      </dt>
      <dd className='mt-0.5 text-sm font-bold tabular-nums'>{props.value}</dd>
    </div>
  )
}
