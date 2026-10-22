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
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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
import { formatQuota } from '@/lib/format'

import {
  SettingsForm,
  SettingsControlChildren,
  SettingsControlGroup,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

const prizeSchema = z.object({
  quota: z.coerce.number().int().min(0),
  weight: z.coerce.number().min(0),
})

const schema = z.object({
  enabled: z.boolean(),
  dailyFreeDraws: z.coerce.number().int().min(0),
  singleCostQuota: z.coerce.number().int().min(0),
  multiCostQuota: z.coerce.number().int().min(0),
  enableMulti: z.boolean(),
  requireNoDrawTodayForMulti: z.boolean(),
  publicWinsLimit: z.coerce.number().int().min(0),
  minWinQuotaForPublic: z.coerce.number().int().min(0),
  prizes: z.array(prizeSchema).min(1),
})

type Values = z.infer<typeof schema>

export type LotterySectionDefaults = {
  enabled: boolean
  dailyFreeDraws: number
  singleCostQuota: number
  multiCostQuota: number
  enableMulti: boolean
  requireNoDrawTodayForMulti: boolean
  publicWinsLimit: number
  minWinQuotaForPublic: number
  prizes: Array<{ quota: number; weight: number }>
}

export function LotterySettingsSection({
  defaultValues,
}: {
  defaultValues: LotterySectionDefaults
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaultValues.enabled,
      dailyFreeDraws: defaultValues.dailyFreeDraws,
      singleCostQuota: defaultValues.singleCostQuota,
      multiCostQuota: defaultValues.multiCostQuota,
      enableMulti: defaultValues.enableMulti,
      requireNoDrawTodayForMulti: defaultValues.requireNoDrawTodayForMulti,
      publicWinsLimit: defaultValues.publicWinsLimit,
      minWinQuotaForPublic: defaultValues.minWinQuotaForPublic,
      prizes:
        defaultValues.prizes.length > 0
          ? defaultValues.prizes
          : [{ quota: 0, weight: 100 }],
    },
  })

  const prizesArray = useFieldArray({ control: form.control, name: 'prizes' })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const enableMulti = form.watch('enableMulti')
  const prizes = form.watch('prizes')

  const totalWeight = prizes.reduce(
    (sum, prize) => sum + (Number(prize.weight) || 0),
    0
  )

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []
    const push = (key: string, value: string) =>
      updates.push({ key, value })

    if (values.enabled !== defaultValues.enabled) {
      push('lottery_setting.enabled', String(values.enabled))
    }
    if (values.dailyFreeDraws !== defaultValues.dailyFreeDraws) {
      push('lottery_setting.daily_free_draws', String(values.dailyFreeDraws))
    }
    if (values.singleCostQuota !== defaultValues.singleCostQuota) {
      push('lottery_setting.single_cost_quota', String(values.singleCostQuota))
    }
    if (values.multiCostQuota !== defaultValues.multiCostQuota) {
      push('lottery_setting.multi_cost_quota', String(values.multiCostQuota))
    }
    if (values.enableMulti !== defaultValues.enableMulti) {
      push('lottery_setting.enable_multi', String(values.enableMulti))
    }
    if (
      values.requireNoDrawTodayForMulti !==
      defaultValues.requireNoDrawTodayForMulti
    ) {
      push(
        'lottery_setting.require_no_draw_today_for_multi',
        String(values.requireNoDrawTodayForMulti)
      )
    }
    if (values.publicWinsLimit !== defaultValues.publicWinsLimit) {
      push('lottery_setting.public_wins_limit', String(values.publicWinsLimit))
    }
    if (values.minWinQuotaForPublic !== defaultValues.minWinQuotaForPublic) {
      push(
        'lottery_setting.min_win_quota_for_public',
        String(values.minWinQuotaForPublic)
      )
    }

    const nextPrizes = JSON.stringify(values.prizes)
    if (nextPrizes !== JSON.stringify(defaultValues.prizes)) {
      push('lottery_setting.prizes', nextPrizes)
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
    <SettingsSection title={t('Lucky Draw Settings')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save lucky draw settings'
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable lucky draw feature')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Allow users to spend quota on a weighted prize draw'
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
              <div className='grid gap-6 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='dailyFreeDraws'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Free draws per day')}</FormLabel>
                      <FormControl>
                        <Input type='number' min={0} {...safeNumberFieldProps(field)} />
                      </FormControl>
                      <FormDescription>
                        {t('Free draws granted to every user each day')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='singleCostQuota'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Single draw cost (quota)')}</FormLabel>
                      <FormControl>
                        <Input type='number' min={0} {...safeNumberFieldProps(field)} />
                      </FormControl>
                      <FormDescription>
                        {t('Charged once the free draws are used up')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='grid gap-6 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='enableMulti'
                  render={({ field }) => (
                    <SettingsSwitchItem>
                      <SettingsSwitchContent>
                        <FormLabel>{t('Enable 10-draw')}</FormLabel>
                        <FormDescription>
                          {t('Show the ten-draw button on the draw page')}
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
                  name='multiCostQuota'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('10-draw cost (quota)')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={0}
                          disabled={!enableMulti}
                          {...safeNumberFieldProps(field)}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Total cost of a ten-draw')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='requireNoDrawTodayForMulti'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>
                        {t('Require no draw today for 10-draw')}
                      </FormLabel>
                      <FormDescription>
                        {t(
                          'A ten-draw is only allowed before any draw that day'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!enableMulti}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />

              <div className='grid gap-6 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='publicWinsLimit'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Public win list size')}</FormLabel>
                      <FormControl>
                        <Input type='number' min={0} {...safeNumberFieldProps(field)} />
                      </FormControl>
                      <FormDescription>
                        {t('How many recent wins are listed publicly')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='minWinQuotaForPublic'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Minimum quota for public win')}</FormLabel>
                      <FormControl>
                        <Input type='number' min={0} {...safeNumberFieldProps(field)} />
                      </FormControl>
                      <FormDescription>
                        {t('Prizes below this amount stay out of the list')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <SettingsControlGroup>
                <div className='flex items-center justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='text-sm font-medium'>{t('Prize pool')}</p>
                    <p className='text-muted-foreground text-xs'>
                      {t(
                        'Each tier is drawn by weight. Weight 0 disables the tier.'
                      )}
                    </p>
                  </div>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => prizesArray.append({ quota: 0, weight: 1 })}
                  >
                    <Plus data-icon='inline-start' />
                    <span>{t('Add tier')}</span>
                  </Button>
                </div>

                <SettingsControlChildren className='space-y-2'>
                  {prizesArray.fields.map((row, index) => (
                    <div
                      key={row.id}
                      className='grid grid-cols-[1fr_1fr_auto] items-end gap-2'
                    >
                      <FormField
                        control={form.control}
                        name={`prizes.${index}.quota`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className='text-xs'>
                              {t('Quota')}
                            </FormLabel>
                            <FormControl>
                              <Input type='number' min={0} {...safeNumberFieldProps(field)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`prizes.${index}.weight`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className='text-xs'>
                              {t('Weight')}
                            </FormLabel>
                            <FormControl>
                              <Input type='number' min={0} step='0.1' {...safeNumberFieldProps(field)} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        aria-label={t('Remove tier')}
                        disabled={prizesArray.fields.length <= 1}
                        onClick={() => prizesArray.remove(index)}
                      >
                        <Trash2 aria-hidden='true' />
                      </Button>
                    </div>
                  ))}
                </SettingsControlChildren>

                <p className='text-muted-foreground text-xs'>
                  {t('Total weight')}: {totalWeight}
                  {totalWeight > 0
                    ? ` · ${t('Hit rate per tier is weight ÷ total weight')}`
                    : ` · ${t('Add at least one tier with weight above zero')}`}
                </p>

                <div className='text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                  {prizes.map((prize, index) => {
                    const weight = Number(prize.weight) || 0
                    const chance =
                      totalWeight > 0 ? (weight / totalWeight) * 100 : 0
                    return (
                      <span key={index} className='tabular-nums'>
                        #{index + 1} {formatQuota(Number(prize.quota) || 0)} ·{' '}
                        {chance.toFixed(2)}%
                      </span>
                    )
                  })}
                </div>
              </SettingsControlGroup>
            </>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
