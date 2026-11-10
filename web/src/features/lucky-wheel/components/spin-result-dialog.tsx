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
import { PackageCheck, PartyPopper } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatQuota } from '@/lib/format'

import { submitWheelAddress } from '../api'
import { WHEEL_PRIZE_TYPE_LABEL_KEYS } from '../lib/wheel'
import type { WheelSpinResult, WheelWin } from '../types'
import { WheelAddressForm } from './wheel-address-form'

interface SpinResultDialogProps {
  open: boolean
  result: WheelSpinResult | null
  /** 兑换码奖品的有效期天数，0 表示长期有效。 */
  redemptionExpireDays: number
  onOpenChange: (open: boolean) => void
  /** 实物奖品收货信息提交成功后回调。 */
  onAddressSubmitted: (win: WheelWin) => void
}

/** 抽奖结果弹窗：按奖品领取方式展示不同的到账形态。 */
export function SpinResultDialog(props: SpinResultDialogProps) {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [addressSaved, setAddressSaved] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSubmitting(false)
      setAddressError(null)
      setAddressSaved(false)
    }
    props.onOpenChange(next)
  }

  const handleSubmitAddress = async (values: {
    receiver_name: string
    receiver_phone: string
    receiver_address: string
  }) => {
    if (!props.result) return
    setSubmitting(true)
    setAddressError(null)
    try {
      const res = await submitWheelAddress(props.result.win_id, values)
      if (!res.success || !res.data) {
        setAddressError(
          res.reason ||
            res.message ||
            t('Request failed, please try again later.')
        )
        return
      }
      setAddressSaved(true)
      props.onAddressSubmitted(res.data)
    } catch {
      setAddressError(t('Request failed, please try again later.'))
    } finally {
      setSubmitting(false)
    }
  }

  const renderBody = () => {
    const result = props.result
    if (!result) return null

    if (result.prize_type === 'none') {
      return (
        <div className='grid justify-items-center gap-3 py-6 text-center'>
          <span aria-hidden='true' className='text-5xl'>
            🍀
          </span>
          <h3 className='text-lg font-semibold'>{t('Thanks for playing')}</h3>
          <p className='text-muted-foreground text-sm'>
            {t('Better luck next time')}
          </p>
          <Button
            className='mt-2 w-full'
            onClick={() => handleOpenChange(false)}
          >
            {t('Done')}
          </Button>
        </div>
      )
    }

    const typeLabel = t(WHEEL_PRIZE_TYPE_LABEL_KEYS[result.prize_type])
    let codeHint = t('Keep this card key safe; it is shown only once')
    if (result.prize_type === 'redemption_code') {
      codeHint =
        props.redemptionExpireDays > 0
          ? t('Redeem it in the redemption code page within {{days}} days', {
              days: props.redemptionExpireDays,
            })
          : t('Redeem it in the redemption code page')
    }

    let body = null
    if (result.prize_type === 'quota') {
      body = (
        <div className='grid justify-items-center gap-2 rounded-xl bg-emerald-500/10 p-4 text-center'>
          <p className='text-3xl font-black text-emerald-600 tabular-nums dark:text-emerald-400'>
            {formatQuota(result.quota_value)}
          </p>
          <p className='text-muted-foreground text-sm'>
            {t('Credited to your balance right away')}
          </p>
        </div>
      )
    } else if (
      result.prize_type === 'redemption_code' ||
      result.prize_type === 'card_key'
    ) {
      body = (
        <div className='space-y-2'>
          <div className='bg-muted flex items-center justify-between gap-2 rounded-lg px-3 py-2'>
            <code className='truncate font-mono text-sm'>{result.code}</code>
            <CopyButton
              value={result.code}
              tooltip={t('Copy code')}
              successTooltip={t('Copied')}
            />
          </div>
          <p className='text-muted-foreground text-xs'>{codeHint}</p>
        </div>
      )
    } else if (result.prize_type === 'subscription') {
      body = (
        <div className='grid justify-items-center gap-2 rounded-xl bg-sky-500/10 p-4 text-center'>
          <p className='text-xl font-bold'>{result.plan_title}</p>
          <p className='text-muted-foreground text-sm'>
            {t('The plan is activated immediately')}
          </p>
        </div>
      )
    } else if (result.prize_type === 'physical') {
      body = addressSaved ? (
        <div className='grid justify-items-center gap-2 rounded-xl bg-amber-500/10 p-4 text-center'>
          <PackageCheck
            aria-hidden='true'
            className='size-8 text-amber-600 dark:text-amber-400'
          />
          <p className='font-semibold'>{t('Shipping address saved')}</p>
          <p className='text-muted-foreground text-sm'>
            {t('We will ship the prize soon. Track it in your prize records.')}
          </p>
        </div>
      ) : (
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'You won a physical prize. Fill in the shipping address to claim it.'
            )}
          </p>
          <WheelAddressForm
            submitting={submitting}
            error={addressError}
            submitLabel={t('Save shipping address')}
            onSubmit={handleSubmitAddress}
          />
        </div>
      )
    }

    return (
      <div className='space-y-4'>
        <div className='text-center'>
          <p className='text-muted-foreground text-xs tracking-widest uppercase'>
            {t('You won')}
          </p>
          <p className='mt-1 flex items-center justify-center gap-2 text-2xl font-black'>
            <span aria-hidden='true'>{result.prize_icon || '🎁'}</span>
            <span>{result.prize_name}</span>
          </p>
          <div className='mt-2 flex flex-wrap items-center justify-center gap-2'>
            <Badge variant='secondary'>{typeLabel}</Badge>
            {result.prize_label ? (
              <Badge variant='warning'>{result.prize_label}</Badge>
            ) : null}
          </div>
        </div>
        {body}
        <p className='text-muted-foreground flex flex-wrap items-center justify-center gap-x-2 text-xs'>
          <span>
            {result.is_free
              ? t('This draw used a free chance')
              : t('This draw cost {{amount}}', {
                  amount: formatQuota(result.cost_quota),
                })}
          </span>
          <span aria-hidden='true'>·</span>
          <span>
            {t('Account balance')} {formatQuota(result.quota)}
          </span>
        </p>
        {result.prize_type !== 'physical' || addressSaved ? (
          <Button className='w-full' onClick={() => handleOpenChange(false)}>
            {t('Great, thanks')}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title={
        <span className='flex items-center gap-2'>
          <PartyPopper aria-hidden='true' className='size-4 text-amber-500' />
          {t('Draw result')}
        </span>
      }
      contentClassName='sm:max-w-md'
      contentHeight='auto'
    >
      {renderBody()}
    </Dialog>
  )
}
