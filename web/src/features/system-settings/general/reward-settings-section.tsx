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
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

const copySchema = z.object({
  label: z.string().max(30),
  title: z.string().max(60),
  subtitle: z.string().max(200),
  footer: z.string().max(160),
  stubText: z.string().max(12),
  stubFontSize: z.coerce.number().int().min(14).max(56),
  buttonText: z.string().max(20),
})

const schema = z.object({
  enabled: z.boolean(),
  maxQuotaLimit: z.coerce.number().int().min(0),
  historyPageSize: z.coerce.number().int().min(1).max(100),
  copy: copySchema,
})

type Values = z.infer<typeof schema>

export type RewardSectionDefaults = {
  enabled: boolean
  maxQuotaLimit: number
  historyPageSize: number
  copy: {
    label: string
    title: string
    subtitle: string
    footer: string
    stubText: string
    stubFontSize: number
    buttonText: string
  }
}

/**
 * Serialize the nested ticket copy back into the `reward_setting.default_copy`
 * option. Keys the form does not expose are preserved so a future field is not
 * wiped by an unrelated save.
 */
function serializeCopy(raw: string, values: Values['copy']): string {
  let base: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      base = parsed as Record<string, unknown>
    }
  } catch {
    base = {}
  }

  return JSON.stringify({
    ...base,
    label: values.label,
    title: values.title,
    subtitle: values.subtitle,
    footer: values.footer,
    stub_text: values.stubText,
    stub_font_size: values.stubFontSize,
    button_text: values.buttonText,
  })
}

export function RewardSettingsSection(props: {
  defaultValues: RewardSectionDefaults
  rawCopy: string
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: props.defaultValues.enabled,
      maxQuotaLimit: props.defaultValues.maxQuotaLimit,
      historyPageSize: props.defaultValues.historyPageSize,
      copy: { ...props.defaultValues.copy },
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []
    const push = (key: string, value: string) => updates.push({ key, value })

    if (values.enabled !== props.defaultValues.enabled) {
      push('reward_setting.enabled', String(values.enabled))
    }
    if (values.maxQuotaLimit !== props.defaultValues.maxQuotaLimit) {
      push('reward_setting.max_quota_limit', String(values.maxQuotaLimit))
    }
    if (values.historyPageSize !== props.defaultValues.historyPageSize) {
      push('reward_setting.history_page_size', String(values.historyPageSize))
    }
    const copyKeys = Object.keys(values.copy) as Array<keyof Values['copy']>
    const copyChanged = copyKeys.some(
      (key) => values.copy[key] !== props.defaultValues.copy[key]
    )
    if (copyChanged) {
      push(
        'reward_setting.default_copy',
        serializeCopy(props.rawCopy, values.copy)
      )
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }

    toast.success(t('Reward settings saved'))
    form.reset(values)
  }

  return (
    <SettingsSection title={t('Rewards Settings')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save reward settings'
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable reward feature')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Show the rewards page so users can claim reward tickets issued by the operator'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled && (
            <>
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='maxQuotaLimit'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Quota cap after claim')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={0}
                          {...safeNumberFieldProps(field)}
                        />
                      </FormControl>
                      <FormDescription>{t('0 means no cap')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='historyPageSize'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Claim history page size')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          max={100}
                          {...safeNumberFieldProps(field)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='copy.title'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Default ticket title')}</FormLabel>
                    <FormControl>
                      <Input maxLength={60} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='copy.subtitle'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Default ticket subtitle')}</FormLabel>
                    <FormControl>
                      <Input maxLength={200} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='copy.label'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Top label')}</FormLabel>
                      <FormControl>
                        <Input maxLength={30} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='copy.stubText'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Stub text')}</FormLabel>
                      <FormControl>
                        <Input maxLength={12} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='copy.footer'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Footer text')}</FormLabel>
                    <FormControl>
                      <Input maxLength={160} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='copy.buttonText'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Claim button text')}</FormLabel>
                      <FormControl>
                        <Input maxLength={20} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='copy.stubFontSize'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Stub font size')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={14}
                          max={56}
                          {...safeNumberFieldProps(field)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
