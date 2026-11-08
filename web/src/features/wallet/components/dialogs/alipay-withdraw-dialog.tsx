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
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  formatQuotaFixed,
  parseQuotaFromDollars,
  quotaUnitsToDollars,
} from '@/lib/format'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { estimateAffWithdrawal, formatCNY } from '../../lib/aff-withdrawal'

interface AlipayWithdrawDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (quota: number, account: string, name: string) => Promise<boolean>
  availableQuota: number
  feePercent: number
  minQuota: number
  submitting: boolean
}

export function AlipayWithdrawDialog({
  open,
  onOpenChange,
  onConfirm,
  availableQuota,
  feePercent,
  minQuota,
  submitting,
}: AlipayWithdrawDialogProps) {
  const { t } = useTranslation()
  const currencyConfig = useSystemConfigStore((state) => state.config.currency)
  const quotaPerUnit =
    currencyConfig.quotaPerUnit > 0
      ? currencyConfig.quotaPerUnit
      : DEFAULT_CURRENCY_CONFIG.quotaPerUnit
  const usdExchangeRate = currencyConfig.usdExchangeRate ?? 1
  const minimumQuota = minQuota > 0 ? minQuota : Math.ceil(quotaPerUnit)
  const minimumAmount = Math.max(
    Number(quotaUnitsToDollars(minimumQuota).toFixed(2)),
    0.01
  )
  const maximumAmount = Number(quotaUnitsToDollars(availableQuota).toFixed(2))
  const [amount, setAmount] = useState(minimumAmount)
  const [account, setAccount] = useState('')
  const [name, setName] = useState('')
  const withdrawalQuota = parseQuotaFromDollars(amount)
  const estimate = estimateAffWithdrawal(
    withdrawalQuota,
    feePercent,
    quotaPerUnit,
    usdExchangeRate
  )
  const canSubmit =
    Number.isFinite(amount) &&
    withdrawalQuota >= minimumQuota &&
    withdrawalQuota <= availableQuota &&
    account.trim() !== '' &&
    name.trim() !== ''

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount(minimumAmount)
      setAccount('')
      setName('')
    }
  }, [minimumAmount, open])

  const handleConfirm = async () => {
    if (!canSubmit) return

    const success = await onConfirm(
      withdrawalQuota,
      account.trim(),
      name.trim()
    )
    if (success) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Withdraw to Alipay')}
      description={t(
        'Submit a withdrawal request and the administrator pays out after review.'
      )}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'
      titleClassName='text-xl font-semibold'
      footerClassName='grid grid-cols-2 gap-2 sm:flex'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || !canSubmit}>
            {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Submit')}
          </Button>
        </>
      }
    >
      <div className='space-y-4 py-3 sm:space-y-6 sm:py-4'>
        <div className='space-y-2'>
          <Label className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
            {t('Available Rewards')}
          </Label>
          <div className='text-2xl font-semibold'>
            {formatQuotaFixed(availableQuota)}
          </div>
        </div>

        <div className='space-y-3'>
          <Label
            htmlFor='alipay-withdraw-amount'
            className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
          >
            {t('Withdrawal Amount')}
          </Label>
          <Input
            id='alipay-withdraw-amount'
            type='number'
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min={minimumAmount}
            max={maximumAmount}
            step={0.01}
            className='font-mono text-lg'
          />
          <p className='text-muted-foreground text-xs'>
            {t('Minimum:')} {formatQuotaFixed(minimumQuota)}
          </p>
        </div>

        <div className='space-y-2'>
          <Label
            htmlFor='alipay-withdraw-account'
            className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
          >
            {t('Alipay Account')}
          </Label>
          <Input
            id='alipay-withdraw-account'
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder={t('Phone number or email bound to Alipay')}
            maxLength={100}
          />
        </div>

        <div className='space-y-2'>
          <Label
            htmlFor='alipay-withdraw-name'
            className='text-muted-foreground text-xs font-medium tracking-wider uppercase'
          >
            {t("Account Holder's Name")}
          </Label>
          <Input
            id='alipay-withdraw-name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Real name on the Alipay account')}
            maxLength={50}
          />
        </div>

        <div className='space-y-1 rounded-lg border p-3 text-sm'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>{t('Fee rate')}</span>
            <span className='tabular-nums'>{feePercent}%</span>
          </div>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>
              {t('Estimated payout')}
            </span>
            <span className='font-semibold tabular-nums'>
              {formatCNY(estimate.payoutCNY)}
            </span>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
