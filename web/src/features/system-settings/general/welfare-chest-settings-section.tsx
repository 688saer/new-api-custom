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
  SettingsControlGroup,
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

const boxSchema = z.object({
  enabled: z.boolean(),
  thresholdUsd: z.coerce.number().min(0),
  rewardMinUsd: z.coerce.number().min(0),
  rewardMaxUsd: z.coerce.number().min(0),
  medianUsd: z.coerce.number().min(0),
})

const schema = z.object({
  enabled: z.boolean(),
  canOpenAny: z.boolean(),
  unlimitedOpen: z.boolean(),
  chooseOnePerWeek: z.boolean(),
  maxQuotaLimit: z.coerce.number().int().min(0),
  xiaoshuaiGe: boxSchema,
  heiDashuai: boxSchema,
})

type Values = z.infer<typeof schema>

export type WelfareChestBoxDefaults = {
  enabled: boolean
  thresholdUsd: number
  rewardMinUsd: number
  rewardMaxUsd: number
  medianUsd: number
}

export type WelfareChestSectionDefaults = {
  enabled: boolean
  canOpenAny: boolean
  unlimitedOpen: boolean
  chooseOnePerWeek: boolean
  maxQuotaLimit: number
  xiaoshuaiGe: WelfareChestBoxDefaults
  heiDashuai: WelfareChestBoxDefaults
}

/**
 * Rebuild a stored box option, keeping the identity and image fields the
 * backend owns so the admin form only rewrites the numbers it exposes.
 */
function serializeBox(
  raw: string,
  key: string,
  values: WelfareChestBoxDefaults
): string {
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
    key,
    enabled: values.enabled,
    threshold_usd: values.thresholdUsd,
    reward_min_usd: values.rewardMinUsd,
    reward_max_usd: values.rewardMaxUsd,
    median_usd: values.medianUsd,
  })
}

const BOX_META = [
  { field: 'xiaoshuaiGe', key: 'xiaoshuai_ge', optionKey: 'welfare_chest_setting.xiaoshuai_ge', label: 'Xiaoshuai Ge Chest' },
  { field: 'heiDashuai', key: 'hei_dashuai', optionKey: 'welfare_chest_setting.hei_dashuai', label: 'Hei Dashuai Chest' },
] as const

export function WelfareChestSettingsSection({
  defaultValues,
  rawXiaoshuaiGe,
  rawHeiDashuai,
}: {
  defaultValues: WelfareChestSectionDefaults
  rawXiaoshuaiGe: string
  rawHeiDashuai: string
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaultValues.enabled,
      canOpenAny: defaultValues.canOpenAny,
      unlimitedOpen: defaultValues.unlimitedOpen,
      chooseOnePerWeek: defaultValues.chooseOnePerWeek,
      maxQuotaLimit: defaultValues.maxQuotaLimit,
      xiaoshuaiGe: { ...defaultValues.xiaoshuaiGe },
      heiDashuai: { ...defaultValues.heiDashuai },
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const unlimitedOpen = form.watch('unlimitedOpen')

  const rawByKey: Record<string, string> = {
    xiaoshuai_ge: rawXiaoshuaiGe,
    hei_dashuai: rawHeiDashuai,
  }

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []
    const push = (key: string, value: string) => updates.push({ key, value })

    if (values.enabled !== defaultValues.enabled) {
      push('welfare_chest_setting.enabled', String(values.enabled))
    }
    if (values.canOpenAny !== defaultValues.canOpenAny) {
      push('welfare_chest_setting.can_open_any', String(values.canOpenAny))
    }
    if (values.unlimitedOpen !== defaultValues.unlimitedOpen) {
      push('welfare_chest_setting.unlimited_open', String(values.unlimitedOpen))
    }
    if (values.chooseOnePerWeek !== defaultValues.chooseOnePerWeek) {
      push(
        'welfare_chest_setting.choose_one_per_week',
        String(values.chooseOnePerWeek)
      )
    }
    if (values.maxQuotaLimit !== defaultValues.maxQuotaLimit) {
      push('welfare_chest_setting.max_quota_limit', String(values.maxQuotaLimit))
    }

    for (const meta of BOX_META) {
      const next = values[meta.field]
      const prev = defaultValues[meta.field]
      const changed =
        next.enabled !== prev.enabled ||
        next.thresholdUsd !== prev.thresholdUsd ||
        next.rewardMinUsd !== prev.rewardMinUsd ||
        next.rewardMaxUsd !== prev.rewardMaxUsd ||
        next.medianUsd !== prev.medianUsd
      if (!changed) continue
      push(meta.optionKey, serializeBox(rawByKey[meta.key] ?? '', meta.key, next))
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }

    form.reset(values)
  }

  return (
    <SettingsSection title={t('Welfare Chests Settings')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save welfare chest settings'
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable welfare chest feature')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Grant a weekly chest reward once consumption passes the threshold'
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
              <FormField
                control={form.control}
                name='canOpenAny'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Allow opening any chest')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Users may open whichever chest they qualify for. Turning this off disables the open button.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />

              <FormField
                control={form.control}
                name='chooseOnePerWeek'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('One chest per week')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Users pick either chest and can only claim one per week'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={unlimitedOpen}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />

              <FormField
                control={form.control}
                name='unlimitedOpen'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Allow repeated claims')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Ignore the weekly limit. Use with care: rewards repeat every claim.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />

              <FormField
                control={form.control}
                name='maxQuotaLimit'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Quota cap after reward')}</FormLabel>
                    <FormControl>
                      <Input type='number' min={0} {...safeNumberFieldProps(field)} />
                    </FormControl>
                    <FormDescription>
                      {t('0 means no cap')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {BOX_META.map((meta) => (
                <SettingsControlGroup key={meta.key}>
                  <FormField
                    control={form.control}
                    name={`${meta.field}.enabled`}
                    render={({ field }) => (
                      <SettingsSwitchItem>
                        <SettingsSwitchContent>
                          <FormLabel>{t(meta.label)}</FormLabel>
                          <FormDescription>
                            {t('Uncheck to hide this chest from users')}
                          </FormDescription>
                        </SettingsSwitchContent>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </SettingsSwitchItem>
                    )}
                  />

                  <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                    <FormField
                      control={form.control}
                      name={`${meta.field}.thresholdUsd`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-xs'>
                            {t('Unlock Threshold (USD)')}
                          </FormLabel>
                          <FormControl>
                            <Input type='number' min={0} step='0.01' {...safeNumberFieldProps(field)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`${meta.field}.rewardMinUsd`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-xs'>
                            {t('Reward Min (USD)')}
                          </FormLabel>
                          <FormControl>
                            <Input type='number' min={0} step='0.01' {...safeNumberFieldProps(field)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`${meta.field}.rewardMaxUsd`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-xs'>
                            {t('Reward Max (USD)')}
                          </FormLabel>
                          <FormControl>
                            <Input type='number' min={0} step='0.01' {...safeNumberFieldProps(field)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`${meta.field}.medianUsd`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className='text-xs'>
                            {t('Median Reward (USD)')}
                          </FormLabel>
                          <FormControl>
                            <Input type='number' min={0} step='0.01' {...safeNumberFieldProps(field)} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </SettingsControlGroup>
              ))}
            </>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
