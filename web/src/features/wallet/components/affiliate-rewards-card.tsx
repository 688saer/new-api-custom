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
import { Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'

import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onTransfer: () => void
  onWithdrawAlipay?: () => void
  complianceConfirmed?: boolean
  loading?: boolean
}

export function AffiliateRewardsCard({
  user,
  affiliateLink,
  onTransfer,
  onWithdrawAlipay,
  complianceConfirmed = true,
  loading,
}: AffiliateRewardsCardProps) {
  const { t } = useTranslation()
  if (loading) {
    return (
      <Card data-card-hover='false' className='bg-muted/20 py-0'>
        <CardContent className='grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,0.72fr)_minmax(320px,1.15fr)] lg:items-center'>
          <div>
            <Skeleton className='h-5 w-32' />
            <Skeleton className='mt-2 h-4 w-48' />
          </div>
          <Skeleton className='h-14 rounded-lg' />
          <Skeleton className='h-10 rounded-lg' />
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (user?.aff_quota ?? 0) > 0
  const rebateEnabled =
    (user?.invite_rebate_enabled ?? false) &&
    (user?.invite_rebate_percent ?? 0) > 0
  const registerRewardEnabled = user?.invite_register_reward_enabled ?? false
  const alipayEnabled = user?.aff_withdraw_alipay_enabled ?? false

  return (
    <Card data-card-hover='false' className='bg-muted/20 py-0'>
      <CardContent className='grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(200px,1fr)_minmax(180px,0.65fr)_minmax(280px,1fr)] lg:items-center'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <IconBadge tone='chart-3'>
            <Share2 />
          </IconBadge>
          <div className='min-w-0'>
            <h3 className='flex items-center gap-2 text-sm font-semibold'>
              <span className='truncate'>{t('Referral Program')}</span>
              {rebateEnabled ? (
                <Badge
                  variant='outline'
                  className='border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                >
                  +{user?.invite_rebate_percent ?? 0}%
                </Badge>
              ) : null}
            </h3>
            <p className='text-muted-foreground line-clamp-1 text-xs'>
              {t(
                'Earn rewards when users join through your referral link. Transfer accumulated rewards to your balance anytime.'
              )}
            </p>
          </div>
        </div>

        <div className='grid grid-cols-3 gap-1.5 text-center'>
          {[
            [t('Pending'), formatQuota(user?.aff_quota ?? 0)],
            [t('Total Earned'), formatQuota(user?.aff_history_quota ?? 0)],
            [t('Invites'), String(user?.aff_count ?? 0)],
          ].map(([label, value]) => (
            <div key={label}>
              <div className='text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase'>
                {label}
              </div>
              <div className='mt-0.5 truncate text-sm font-semibold tabular-nums'>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className='flex items-center gap-2'>
          <Input
            value={affiliateLink}
            readOnly
            className='border-muted bg-background/70 h-9 min-w-0 flex-1 font-mono text-xs'
          />
          <CopyButton
            value={affiliateLink}
            variant='outline'
            className='bg-background size-9 shrink-0'
            iconClassName='size-4'
            tooltip={t('Copy referral link')}
            aria-label={t('Copy referral link')}
          />
          {hasRewards && (
            <div className='flex shrink-0 items-center gap-2'>
              <Button
                onClick={onTransfer}
                disabled={!complianceConfirmed}
                className='h-9 px-3'
                size='sm'
              >
                {t('Transfer to Balance')}
              </Button>
              {alipayEnabled && onWithdrawAlipay ? (
                <Button
                  onClick={onWithdrawAlipay}
                  disabled={!complianceConfirmed}
                  variant='outline'
                  className='bg-background h-9 px-3'
                  size='sm'
                >
                  {t('Withdraw to Alipay')}
                </Button>
              ) : null}
            </div>
          )}
        </div>
        {!complianceConfirmed ? (
          <p className='text-muted-foreground text-xs lg:col-span-3'>
            {t(
              'Referral reward transfer is disabled until the administrator confirms compliance terms.'
            )}
          </p>
        ) : null}
        {registerRewardEnabled || rebateEnabled ? (
          <p className='text-muted-foreground text-xs lg:col-span-3'>
            {registerRewardEnabled
              ? t('You receive a one-off bonus when an invited user registers.')
              : ''}
            {registerRewardEnabled && rebateEnabled ? ' ' : ''}
            {rebateEnabled
              ? t(
                  'You also receive {{percent}}% of what the users you invited spend.',
                  { percent: user?.invite_rebate_percent ?? 0 }
                )
              : ''}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
