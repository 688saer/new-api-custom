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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileSignature, Loader2, Receipt, Save } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { TitledCard } from '@/components/ui/titled-card'
import { formatTimestamp } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

import {
  getInvoiceSettingsAdmin,
  listAgreementSignaturesAdmin,
  updateInvoiceSettingsAdmin,
} from '../../invoices/api'
import {
  agreementSettingSchema,
  type AgreementSettingValues,
  invoiceSettingSchema,
  type InvoiceSettingValues,
} from '../lib/settings-form'

const emptyInvoiceValues: InvoiceSettingValues = {
  enabled: true,
  seller_name: '',
  contact: '',
  notice: '',
  min_amount: '',
  max_amount: '',
  max_pending_per_user: '3',
}

const emptyAgreementValues: AgreementSettingValues = {
  enabled: true,
  title: '购买协议',
  version: '1.0',
  content: '',
  require_for_redemption: true,
  require_for_topup: true,
  require_for_subscription: true,
}

/** 发票模块设置 + 购买协议正文编辑 + 签署记录 */
export function InvoiceSettingsPanel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: ['invoice', 'settings'],
    queryFn: getInvoiceSettingsAdmin,
  })

  const signaturesQuery = useQuery({
    queryKey: ['invoice', 'signatures'],
    queryFn: () => listAgreementSignaturesAdmin('', 1, 10),
  })

  const invoiceForm = useForm<InvoiceSettingValues>({
    resolver: zodResolver(invoiceSettingSchema),
    defaultValues: emptyInvoiceValues,
  })

  const agreementForm = useForm<AgreementSettingValues>({
    resolver: zodResolver(agreementSettingSchema),
    defaultValues: emptyAgreementValues,
  })

  const settings = settingsQuery.data?.data

  useEffect(() => {
    if (!settings) {
      return
    }
    invoiceForm.reset({
      enabled: settings.invoice.enabled,
      seller_name: settings.invoice.seller_name ?? '',
      contact: settings.invoice.contact ?? '',
      notice: settings.invoice.notice ?? '',
      min_amount: settings.invoice.min_amount
        ? String(settings.invoice.min_amount)
        : '',
      max_amount: settings.invoice.max_amount
        ? String(settings.invoice.max_amount)
        : '',
      max_pending_per_user: String(settings.invoice.max_pending_per_user ?? 3),
    })
    agreementForm.reset({
      enabled: settings.agreement.enabled,
      title: settings.agreement.title ?? '',
      version: settings.agreement.version ?? '1.0',
      content: settings.agreement.content ?? '',
      require_for_redemption: settings.agreement.require_for_redemption,
      require_for_topup: settings.agreement.require_for_topup,
      require_for_subscription: settings.agreement.require_for_subscription,
    })
  }, [settings, invoiceForm, agreementForm])

  const saveMutation = useMutation({
    mutationFn: updateInvoiceSettingsAdmin,
    onSuccess: (response) => {
      if (!response.success) {
        handleServerError(response, t('Failed to save the settings'))
        return
      }
      toast.success(t('Settings saved'))
      void queryClient.invalidateQueries({ queryKey: ['invoice'] })
    },
    onError: (error) =>
      handleServerError(error, t('Failed to save the settings')),
  })

  const handleSave = () => {
    const invoiceValues = invoiceForm.getValues()
    const agreementValues = agreementForm.getValues()
    saveMutation.mutate({
      invoice: {
        enabled: invoiceValues.enabled,
        seller_name: invoiceValues.seller_name,
        contact: invoiceValues.contact,
        notice: invoiceValues.notice,
        min_amount: Number(invoiceValues.min_amount) || 0,
        max_amount: Number(invoiceValues.max_amount) || 0,
        max_pending_per_user:
          Math.trunc(Number(invoiceValues.max_pending_per_user)) || 0,
      },
      agreement: {
        enabled: agreementValues.enabled,
        title: agreementValues.title,
        version: agreementValues.version,
        content: agreementValues.content,
        require_for_redemption: agreementValues.require_for_redemption,
        require_for_topup: agreementValues.require_for_topup,
        require_for_subscription: agreementValues.require_for_subscription,
      },
    })
  }

  const signatures = signaturesQuery.data?.data?.items ?? []

  return (
    <div className='space-y-4 sm:space-y-6'>
      <TitledCard
        title={t('Invoice module')}
        description={t(
          'Control whether users can request invoices and what they see.'
        )}
        icon={<Receipt className='h-4 w-4' />}
        iconTone='info'
        disableHoverEffect
      >
        <Form {...invoiceForm}>
          <form
            className='space-y-4'
            onSubmit={(event) => event.preventDefault()}
          >
            <FormField
              control={invoiceForm.control}
              name='enabled'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between gap-4'>
                  <div className='space-y-1'>
                    <FormLabel>{t('Enable invoice requests')}</FormLabel>
                    <FormDescription>
                      {t(
                        'When disabled, the request button is hidden for users.'
                      )}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={invoiceForm.control}
                name='seller_name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Seller name')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('Shown on the invoice page')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={invoiceForm.control}
                name='contact'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Billing contact')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('Email or support channel')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={invoiceForm.control}
              name='notice'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Application notice')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder={t('Shown above the invoice form')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid gap-4 sm:grid-cols-3'>
              <FormField
                control={invoiceForm.control}
                name='min_amount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Minimum amount')}</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode='decimal' placeholder='0' />
                    </FormControl>
                    <FormDescription>{t('0 means no limit')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={invoiceForm.control}
                name='max_amount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Maximum amount')}</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode='decimal' placeholder='0' />
                    </FormControl>
                    <FormDescription>{t('0 means no limit')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={invoiceForm.control}
                name='max_pending_per_user'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Pending requests per user')}</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode='numeric' placeholder='3' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </TitledCard>

      <TitledCard
        title={t('Purchase agreement')}
        description={t(
          'Users must accept this text before redeeming a code, topping up or buying a plan. Change the version to require acceptance again.'
        )}
        icon={<FileSignature className='h-4 w-4' />}
        iconTone='warning'
        disableHoverEffect
      >
        <Form {...agreementForm}>
          <form
            className='space-y-4'
            onSubmit={(event) => event.preventDefault()}
          >
            <FormField
              control={agreementForm.control}
              name='enabled'
              render={({ field }) => (
                <FormItem className='flex items-center justify-between gap-4'>
                  <div className='space-y-1'>
                    <FormLabel>{t('Require the purchase agreement')}</FormLabel>
                    <FormDescription>
                      {t('Turn off to skip the agreement for every purchase.')}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={agreementForm.control}
                name='title'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Agreement title')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={agreementForm.control}
                name='version'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Agreement version')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid gap-3 sm:grid-cols-3'>
              <FormField
                control={agreementForm.control}
                name='require_for_redemption'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between gap-2 rounded-lg border p-3'>
                    <FormLabel className='text-xs'>
                      {t('Require for redemption codes')}
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={agreementForm.control}
                name='require_for_topup'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between gap-2 rounded-lg border p-3'>
                    <FormLabel className='text-xs'>
                      {t('Require for top-ups')}
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={agreementForm.control}
                name='require_for_subscription'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between gap-2 rounded-lg border p-3'>
                    <FormLabel className='text-xs'>
                      {t('Require for plans')}
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={agreementForm.control}
              name='content'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Agreement text')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={12}
                      className='font-mono text-xs'
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Plain text. Line breaks are preserved.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <div className='mt-4 flex justify-end'>
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || settingsQuery.isLoading}
            className='gap-2'
          >
            {saveMutation.isPending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Save className='h-4 w-4' />
            )}
            {t('Save settings')}
          </Button>
        </div>
      </TitledCard>

      <TitledCard
        title={t('Recent signatures')}
        description={t('The ten latest users who accepted the agreement.')}
        icon={<FileSignature className='h-4 w-4' />}
        iconTone='success'
        disableHoverEffect
      >
        {signatures.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t('No signatures yet')}
          </p>
        ) : (
          <ul className='divide-y text-sm'>
            {signatures.map((signature) => (
              <li
                key={signature.id}
                className='flex flex-wrap items-center justify-between gap-2 py-2'
              >
                <span className='font-medium'>
                  {signature.username || `#${signature.user_id}`}
                </span>
                <span className='text-muted-foreground text-xs'>
                  v{signature.version} · {signature.scene} ·{' '}
                  {formatTimestamp(signature.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </TitledCard>
    </div>
  )
}
