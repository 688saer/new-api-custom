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
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatQuota } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

import { formatCNY } from '../../wallet/lib/aff-withdrawal'
import type { AffWithdrawal } from '../../wallet/types'
import { reviewAffWithdrawalAdmin } from '../api'

interface AffWithdrawalReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  withdrawal: AffWithdrawal | null
  approve: boolean
  onDone: () => void
}

export function AffWithdrawalReviewDialog({
  open,
  onOpenChange,
  withdrawal,
  approve,
  onDone,
}: AffWithdrawalReviewDialogProps) {
  const { t } = useTranslation()
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setNote('')
      setSubmitting(false)
    }
  }, [open])

  if (!withdrawal) {
    return null
  }

  const handleSubmit = async () => {
    const trimmed = note.trim()
    if (!approve && trimmed === '') {
      toast.error(t('Tell the user why the withdrawal was rejected'))
      return
    }
    setSubmitting(true)
    try {
      const response = await reviewAffWithdrawalAdmin(
        withdrawal.id,
        approve,
        trimmed
      )
      if (response.success) {
        toast.success(approve ? t('Request approved') : t('Request rejected'))
        onOpenChange(false)
        onDone()
        return
      }
      handleServerError(response, t('Failed to review the withdrawal'))
    } catch (error) {
      handleServerError(error, t('Failed to review the withdrawal'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={approve ? t('Mark as Paid') : t('Reject request')}
      description={`${withdrawal.username} · ${formatQuota(withdrawal.quota)}`}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'
      footerClassName='grid grid-cols-2 gap-2 sm:flex'
      contentHeight='auto'
      bodyClassName='space-y-3'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            variant={approve ? 'default' : 'destructive'}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {approve ? t('Approve') : t('Reject')}
          </Button>
        </>
      }
    >
      <div className='space-y-1 rounded-lg border p-2 text-xs'>
        <div className='flex justify-between gap-2'>
          <span className='text-muted-foreground'>{t('Alipay Account')}</span>
          <span className='min-w-0 truncate font-mono'>
            {withdrawal.account}
          </span>
        </div>
        <div className='flex justify-between gap-2'>
          <span className='text-muted-foreground'>
            {t("Account Holder's Name")}
          </span>
          <span className='min-w-0 truncate'>{withdrawal.name}</span>
        </div>
        <div className='flex justify-between gap-2'>
          <span className='text-muted-foreground'>{t('Fee rate')}</span>
          <span className='tabular-nums'>{withdrawal.fee_percent}%</span>
        </div>
        <div className='flex justify-between gap-2'>
          <span className='text-muted-foreground'>{t('Estimated payout')}</span>
          <span className='font-semibold tabular-nums'>
            {formatCNY(withdrawal.money)}
          </span>
        </div>
      </div>

      {approve ? (
        <p className='text-muted-foreground text-sm'>
          {t(
            'Marking as paid confirms the referral rewards have been transferred to the Alipay account above.'
          )}
        </p>
      ) : (
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'The frozen referral rewards return to the user when the request is rejected.'
            )}
          </p>
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('Reason for rejection')}
            maxLength={200}
          />
        </div>
      )}
    </Dialog>
  )
}
