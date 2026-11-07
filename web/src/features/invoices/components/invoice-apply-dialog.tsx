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
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { formatNumber, formatTimestamp } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

import { createInvoice, getInvoiceableOrders } from '../api'
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

  const ordersQuery = useQuery({
    queryKey: ['invoices', 'invoiceable-orders'],
    queryFn: getInvoiceableOrders,
    enabled: props.open,
  })
  const orders = ordersQuery.data ?? []
  const titleType = form.watch('title_type')
  const selectedIds = form.watch('topup_ids')
  const selectedTotalCents = orders
    .filter((order) => selectedIds.includes(order.topup_id))
    .reduce((sum, order) => sum + order.amount_cents, 0)

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await createInvoice({
        title_type: values.title_type,
        title_name: values.title_name,
        tax_id: values.tax_id,
        email: values.email,
        phone: values.phone,
        topup_ids: values.topup_ids,
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

          <FormField
            control={form.control}
            name='topup_ids'
            render={({ field }) => {
              let picker = (
                <p className='text-muted-foreground p-2 text-xs'>
                  {t('No paid orders available for invoicing')}
                </p>
              )
              if (ordersQuery.isLoading) {
                picker = (
                  <div className='text-muted-foreground flex items-center gap-2 p-2 text-xs'>
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                    {t('Loading')}
                  </div>
                )
              } else if (orders.length > 0) {
                picker = (
                  <>
                    {orders.map((order) => {
                      const claimed = order.invoice_id > 0
                      return (
                        <label
                          key={order.topup_id}
                          className={cn(
                            'flex items-start gap-2 rounded-md p-1.5 text-xs',
                            claimed
                              ? 'opacity-60'
                              : 'hover:bg-muted/60 cursor-pointer'
                          )}
                        >
                          <Checkbox
                            className='mt-0.5'
                            checked={field.value.includes(order.topup_id)}
                            disabled={claimed}
                            onCheckedChange={(checked) => {
                              const next =
                                checked === true
                                  ? [...field.value, order.topup_id]
                                  : field.value.filter(
                                      (id) => id !== order.topup_id
                                    )
                              field.onChange(next)
                            }}
                          />
                          <span className='min-w-0 flex-1 space-y-0.5'>
                            <span className='block font-medium'>
                              ¥{formatNumber(order.amount_cents / 100)}
                              <span className='text-muted-foreground ml-2 font-normal'>
                                {order.trade_no}
                              </span>
                            </span>
                            <span className='text-muted-foreground block'>
                              {formatTimestamp(order.paid_at)}
                              {order.payment_method
                                ? ` · ${order.payment_method}`
                                : ''}
                            </span>
                          </span>
                          {claimed ? (
                            <Badge variant='outline' className='text-[10px]'>
                              {t('Already invoiced')}
                            </Badge>
                          ) : null}
                        </label>
                      )
                    })}
                  </>
                )
              }
              return (
                <FormItem>
                  <FormLabel>{t('Select paid orders')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Only paid orders from this account can be invoiced. The amount is the sum of the orders you pick.'
                    )}
                  </FormDescription>
                  <div className='max-h-56 space-y-1 overflow-y-auto rounded-lg border p-1.5'>
                    {picker}
                  </div>
                  {selectedIds.length > 0 ? (
                    <p className='text-xs font-medium'>
                      {t('{{count}} order(s) selected, total ¥{{total}}', {
                        count: selectedIds.length,
                        total: formatNumber(selectedTotalCents / 100),
                      })}
                    </p>
                  ) : null}
                  {props.setting && props.setting.min_amount > 0 ? (
                    <p className='text-muted-foreground text-xs'>
                      {t('The smallest invoice amount is {{amount}}', {
                        amount: formatNumber(props.setting.min_amount),
                      })}
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )
            }}
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
