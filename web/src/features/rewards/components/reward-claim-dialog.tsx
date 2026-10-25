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
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { formatQuota } from '@/lib/format'

import { claimReward } from '../api'
import type { RewardClaimResult, RewardItem } from '../types'
import { RewardTicket } from './reward-ticket'

interface RewardClaimDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reward: RewardItem | null
  /** 领取成功后回调，页面据此刷新待领取与领取记录。 */
  onClaimed: (result: RewardClaimResult) => void
  /** 领取失败时的文案（已本地化）。 */
  resolveError: (code: string | undefined, reason: string | undefined) => string
}

/**
 * 领取弹窗：展示券面，点击领取后当场换成到账结果。
 *
 * 领取成功后不再关闭重开，而是在同一弹窗内切换到成功态，避免用户错过
 * 到账金额。
 */
export function RewardClaimDialog(props: RewardClaimDialogProps) {
  const { t } = useTranslation()
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState<RewardClaimResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setClaiming(false)
      setClaimed(null)
      setError(null)
    }
    props.onOpenChange(next)
  }

  const handleClaim = async () => {
    if (!props.reward) return
    setClaiming(true)
    setError(null)
    try {
      const res = await claimReward(props.reward.id)
      if (!res.success || !res.data) {
        setError(props.resolveError(res.code, res.reason))
        return
      }
      setClaimed(res.data)
      props.onClaimed(res.data)
    } catch {
      setError(t('Request failed, please try again later.'))
    } finally {
      setClaiming(false)
    }
  }

  const renderBody = () => {
    if (claimed) {
      return (
        <div className='grid justify-items-center gap-3 py-4 text-center'>
          <CheckCircle2
            aria-hidden='true'
            className='size-10 text-emerald-600 dark:text-emerald-400'
          />
          <h3 className='text-lg font-semibold'>
            {claimed.already_claimed ? t('Already claimed') : t('Reward credited')}
          </h3>
          <p className='text-3xl font-bold tabular-nums'>
            {formatQuota(claimed.amount_quota)}
          </p>
          <p className='text-muted-foreground text-sm'>
            {t('Account balance')} {formatQuota(claimed.balance)}
          </p>
          <Button className='mt-2 w-full' onClick={() => handleOpenChange(false)}>
            {t('Done')}
          </Button>
        </div>
      )
    }

    if (!props.reward) return null

    return (
      <div className='space-y-4'>
        <RewardTicket
          style={props.reward.style}
          copy={props.reward.copy}
          amount={formatQuota(props.reward.amount_quota)}
          className='mx-auto'
        />
        <p className='text-muted-foreground text-center text-sm'>
          {t('Reward balance')} {formatQuota(props.reward.amount_quota)}
          {' · '}
          {props.reward.expires_at > 0
            ? t('Valid until {{date}}', {
                date: new Date(props.reward.expires_at * 1000).toLocaleString(),
              })
            : t('Long-term valid')}
        </p>
        {error != null && (
          <p role='alert' className='text-destructive text-sm'>
            {error}
          </p>
        )}
        <div className='flex flex-wrap justify-end gap-3'>
          <Button variant='outline' onClick={() => handleOpenChange(false)}>
            {t('Claim later')}
          </Button>
          <Button onClick={handleClaim} disabled={claiming}>
            {claiming
              ? t('Claiming…')
              : props.reward.copy.button_text || t('Claim reward')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title={t('You have a reward')}
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
    >
      {renderBody()}
    </Dialog>
  )
}
