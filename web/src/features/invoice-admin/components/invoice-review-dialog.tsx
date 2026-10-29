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
import { handleServerError } from '@/lib/handle-server-error'

import { reviewInvoiceAdmin } from '../../invoices/api'
import type { Invoice } from '../../invoices/types'

interface InvoiceReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice | null
  approve: boolean
  onDone: () => void
}

/** 审核弹窗：通过后进入待开具，驳回必须填写原因 */
export function InvoiceReviewDialog(props: InvoiceReviewDialogProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (props.open) {
      setReason('')
      setSubmitting(false)
    }
  }, [props.open])

  const invoice = props.invoice

  if (!invoice) {
    return null
  }

  const handleSubmit = async () => {
    const trimmed = reason.trim()
    if (!props.approve && trimmed === '') {
      toast.error(t('Tell the user why the request was rejected'))
      return
    }
    setSubmitting(true)
    try {
      const response = await reviewInvoiceAdmin(
        invoice.id,
        props.approve,
        trimmed
      )
      if (response.success) {
        toast.success(
          props.approve ? t('Request approved') : t('Request rejected')
        )
        props.onOpenChange(false)
        props.onDone()
        return
      }
      handleServerError(response, t('Failed to review the request'))
    } catch (error) {
      handleServerError(error, t('Failed to review the request'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.approve ? t('Approve request') : t('Reject request')}
      description={`${invoice.title_name} · ¥${(invoice.amount_cents / 100).toFixed(2)}`}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'
      footerClassName='grid grid-cols-2 gap-2 sm:flex'
      contentHeight='auto'
      bodyClassName='space-y-3'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            variant={props.approve ? 'default' : 'destructive'}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {props.approve ? t('Approve') : t('Reject')}
          </Button>
        </>
      }
    >
      {props.approve ? (
        <p className='text-muted-foreground text-sm'>
          {t(
            'The request moves to the issuing queue. Upload the invoice PDF once it is ready.'
          )}
        </p>
      ) : (
        <div className='space-y-2'>
          <p className='text-muted-foreground text-sm'>
            {t('The user sees this reason on the invoice page.')}
          </p>
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('Reason for rejection')}
            maxLength={200}
          />
        </div>
      )}
    </Dialog>
  )
}
