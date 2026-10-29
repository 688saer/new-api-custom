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
import { Label } from '@/components/ui/label'
import { handleServerError } from '@/lib/handle-server-error'

import { issueInvoiceAdmin } from '../../invoices/api'
import type { Invoice } from '../../invoices/types'

interface InvoiceIssueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice | null
  onDone: () => void
}

/** 开具弹窗：填写发票号并上传 PDF，用户随后可在发票页下载 */
export function InvoiceIssueDialog(props: InvoiceIssueDialogProps) {
  const { t } = useTranslation()
  const [invoiceNo, setInvoiceNo] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (props.open) {
      setInvoiceNo('')
      setFile(null)
      setSubmitting(false)
    }
  }, [props.open])

  const invoice = props.invoice

  if (!invoice) {
    return null
  }

  const handleSubmit = async () => {
    if (!file) {
      toast.error(t('Attach the invoice PDF'))
      return
    }
    setSubmitting(true)
    try {
      const response = await issueInvoiceAdmin(invoice.id, invoiceNo, file)
      if (response.success) {
        toast.success(t('Invoice issued'))
        props.onOpenChange(false)
        props.onDone()
        return
      }
      handleServerError(response, t('Failed to issue the invoice'))
    } catch (error) {
      handleServerError(error, t('Failed to issue the invoice'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Issue invoice')}
      description={`${invoice.title_name} · ¥${(invoice.amount_cents / 100).toFixed(2)}`}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-md'
      footerClassName='grid grid-cols-2 gap-2 sm:flex'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Issue')}
          </Button>
        </>
      }
    >
      <div className='space-y-2'>
        <Label htmlFor='invoice-number'>{t('Invoice number')}</Label>
        <Input
          id='invoice-number'
          value={invoiceNo}
          onChange={(event) => setInvoiceNo(event.target.value)}
          placeholder={t('Number printed on the invoice')}
          maxLength={64}
        />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='invoice-file'>{t('Invoice PDF')}</Label>
        <Input
          id='invoice-file'
          type='file'
          accept='application/pdf'
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        <p className='text-muted-foreground text-xs'>
          {t('PDF only, up to 8 MB.')}
        </p>
      </div>
    </Dialog>
  )
}
