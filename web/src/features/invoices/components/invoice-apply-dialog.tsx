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
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { createInvoice } from '../api'
import {
  defaultInvoiceFormValues,
  invoiceFormSchema,
  type InvoiceFormValues,
} from '../lib/invoice-form'
import type { InvoiceSettingView } from '../types'

interface InvoiceApplyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  setting: InvoiceSettingView | null
  onCreated: () => void
}

export function InvoiceApplyDialog(props: InvoiceApplyDialogProps) {
  const { t } = useTranslation()
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: defaultInvoiceFormValues,
  })

  useEffect(() => {
    if (props.open) {
      form.reset(defaultInvoiceFormValues)
    }
  }, [props.open, form])

  const titleType = form.watch('title_type')

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await createInvoice({
        title_type: values.title_type,
        title_name: values.title_name,
        tax_id: values.tax_id,
        email: values.email,
        phone: values.phone,
        amount: Number(values.amount),
        content: values.content,
        remark: values.remark,
      })
      if (response.success) {
        toast.success(t('Invoice request submitted'))
        props.onOpenChange(false)
        props.onCreated()
        return
      }
      handleServerError(response, t('Failed to submit the invoice request'))
    } catch (error) {
      handleServerError(error, t('Failed to submit the invoice request'))
    }
  })

  const submitting = form.formState.isSubmitting

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Request an invoice')}
      description={t('We review every request before issuing the invoice.')}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-lg'
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
            {t('Submit request')}
          </Button>
        </>
      }
    >
      {props.setting?.notice && (
        <p className='bg-muted/40 text-muted-foreground rounded-lg border p-3 text-xs leading-relaxed whitespace-pre-wrap'>
          {props.setting.notice}
        </p>
      )}

      <Form {...form}>
        <form className='space-y-4' onSubmit={handleSubmit}>
          <FormField
            control={form.control}
            name='title_type'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Invoice title type')}</FormLabel>
                <div className='grid grid-cols-2 gap-2'>
                  {(
                    [
                      { value: 'personal', label: t('Personal') },
                      { value: 'company', label: t('Company') },
                    ] as const
                  ).map((option) => (
                    <Button
                      key={option.value}
                      type='button'
                      variant='outline'
                      className={cn(
                        'justify-center',
                        field.value === option.value &&
                          'border-foreground bg-foreground/5 dark:border-foreground'
                      )}
                      onClick={() => field.onChange(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='title_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Invoice title')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('Name as shown on the invoice')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {titleType === 'company' && (
            <FormField
              control={form.control}
              name='tax_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Tax ID')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('Unified social credit code')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='email'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Receiving email')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='email'
                      placeholder='you@example.com'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='phone'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Phone (optional)')}</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode='tel' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='amount'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Invoice amount')}</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode='decimal' placeholder='0.00' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='content'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Invoice item')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='remark'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Remark (optional)')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('Order numbers or anything we should know')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
