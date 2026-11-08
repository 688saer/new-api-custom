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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCurrencyDisplay, getCurrencyLabel } from '@/lib/currency'
import { formatQuotaFixed, parseQuotaFromDollars } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { adjustUserAffQuota } from '../api'
import type { QuotaAdjustMode } from '../types'

interface UserAffQuotaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  username: string
  currentAffQuota: number
  onSuccess: () => void
}

/**
 * Admin dialog for the independent referral wallet (`aff_quota`). It never
 * touches the main quota balance.
 */
export function UserAffQuotaDialog(props: UserAffQuotaDialogProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<QuotaAdjustMode>('add')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'

  const amountValue = Number.parseFloat(amount) || 0
  const quotaValue =
    mode === 'override'
      ? parseQuotaFromDollars(amountValue)
      : parseQuotaFromDollars(Math.abs(amountValue))

  const nextQuota = (() => {
    if (mode === 'add') return props.currentAffQuota + quotaValue
    if (mode === 'subtract') return props.currentAffQuota - quotaValue
    return quotaValue
  })()

  const isValid =
    mode === 'override' ? quotaValue >= 0 : quotaValue > 0 && nextQuota >= 0

  const preview = (() => {
    switch (mode) {
      case 'add':
        return `${formatQuotaFixed(props.currentAffQuota)} + ${formatQuotaFixed(quotaValue)} = ${formatQuotaFixed(nextQuota)}`
      case 'subtract':
        return `${formatQuotaFixed(props.currentAffQuota)} - ${formatQuotaFixed(quotaValue)} = ${formatQuotaFixed(nextQuota)}`
      case 'override':
        return `${formatQuotaFixed(props.currentAffQuota)} → ${formatQuotaFixed(nextQuota)}`
    }
  })()

  const handleConfirm = async () => {
    if (!isValid || loading) return

    setLoading(true)
    try {
      const result = await adjustUserAffQuota({
        id: props.userId,
        action: 'add_aff_quota',
        mode,
        value: mode === 'override' ? quotaValue : Math.abs(quotaValue),
      })
      if (result.success) {
        toast.success(t('Referral balance adjusted successfully'))
        setAmount('')
        setMode('add')
        props.onOpenChange(false)
        props.onSuccess()
      } else {
        handleServerError(result, t('Failed to adjust referral balance'))
      }
    } catch (error) {
      handleServerError(error, t('Failed to adjust referral balance'))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setAmount('')
    setMode('add')
    props.onOpenChange(false)
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Adjust Referral Balance')}
      description={t(
        'Referral rewards live in a separate wallet that is not the main balance. Add, subtract or override it here.'
      )}
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button variant='outline' onClick={handleCancel}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={loading || !isValid}>
            {loading ? t('Processing...') : t('Confirm')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='rounded-lg border p-3 text-sm'>
          <div className='flex items-center justify-between gap-2'>
            <span className='text-muted-foreground'>
              {t('Current referral balance')}
            </span>
            <span className='font-semibold tabular-nums'>
              {formatQuotaFixed(props.currentAffQuota)}
            </span>
          </div>
          <div className='text-muted-foreground mt-1 text-xs'>
            {props.username}
          </div>
        </div>

        <div className='space-y-2'>
          <Label>{t('Mode')}</Label>
          <div className='flex gap-1'>
            {(['add', 'subtract', 'override'] as const).map((m) => (
              <Button
                key={m}
                type='button'
                variant='outline'
                size='sm'
                className={cn(
                  mode === m &&
                    'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                )}
                onClick={() => {
                  setMode(m)
                  setAmount('')
                }}
              >
                {m === 'add' && t('Add')}
                {!(m === 'add') && m === 'subtract' && t('Subtract')}
                {!(m === 'add') && !(m === 'subtract') && t('Override')}
              </Button>
            ))}
          </div>
        </div>

        <div className='space-y-2'>
          <Label>
            {t('Amount')} ({currencyLabel})
          </Label>
          <Input
            type='number'
            step={tokensOnly ? 1 : 0.01}
            min={0}
            placeholder={
              tokensOnly
                ? t('Enter amount in tokens')
                : t('Enter amount in {{currency}}', { currency: currencyLabel })
            }
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleConfirm()
            }}
          />
          <p className='text-muted-foreground text-xs tabular-nums'>
            {preview}
          </p>
          {mode === 'subtract' && nextQuota < 0 ? (
            <p className='text-destructive text-xs'>
              {t('Referral balance cannot be negative')}
            </p>
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}
