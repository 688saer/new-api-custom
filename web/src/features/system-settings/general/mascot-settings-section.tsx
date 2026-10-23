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

import { WhaleFigure } from '@/components/mascot'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const MIN_SIZE = 96
const MAX_SIZE = 220

const schema = z.object({
  enabled: z.boolean(),
  name: z.string().max(32),
  greeting: z.string().max(200),
  placement: z.enum(['bottom-right', 'bottom-left']),
  showOnAuthPages: z.boolean(),
  size: z.coerce.number().int().min(MIN_SIZE).max(MAX_SIZE),
})

type Values = z.infer<typeof schema>

export type MascotSectionDefaults = {
  enabled: boolean
  name: string
  greeting: string
  placement: string
  showOnAuthPages: boolean
  size: number
}

export function MascotSettingsSection({
  defaultValues,
}: {
  defaultValues: MascotSectionDefaults
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaultValues.enabled,
      name: defaultValues.name,
      greeting: defaultValues.greeting,
      placement:
        defaultValues.placement === 'bottom-left' ? 'bottom-left' : 'bottom-right',
      showOnAuthPages: defaultValues.showOnAuthPages,
      size: defaultValues.size,
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const previewName = form.watch('name')
  const previewSize = form.watch('size')
  const busy = updateOption.isPending || isSubmitting

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []

    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'mascot_setting.enabled',
        value: String(values.enabled),
      })
    }
    if (values.name !== defaultValues.name) {
      updates.push({ key: 'mascot_setting.name', value: values.name.trim() })
    }
    if (values.greeting !== defaultValues.greeting) {
      updates.push({
        key: 'mascot_setting.greeting',
        value: values.greeting.trim(),
      })
    }
    if (values.placement !== defaultValues.placement) {
      updates.push({
        key: 'mascot_setting.placement',
        value: values.placement,
      })
    }
    if (values.showOnAuthPages !== defaultValues.showOnAuthPages) {
      updates.push({
        key: 'mascot_setting.show_on_auth_pages',
        value: String(values.showOnAuthPages),
      })
    }
    if (values.size !== defaultValues.size) {
      updates.push({ key: 'mascot_setting.size', value: String(values.size) })
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
    <SettingsSection title={t('Site Mascot')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={busy}
            isSaveDisabled={!isDirty}
            saveLabel='Save mascot settings'
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Show the mascot')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Displays a small character in the corner of the console. Visitors can hide it themselves, and it never blocks page content.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={busy}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <div className='grid gap-6 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Mascot name')}</FormLabel>
                  <FormControl>
                    <Input maxLength={32} {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Shown in the greeting bubble.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='size'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Mascot size')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={MIN_SIZE}
                      max={MAX_SIZE}
                      step={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Width in pixels, between {{min}} and {{max}}.', {
                      min: MIN_SIZE,
                      max: MAX_SIZE,
                    })}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='greeting'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Greeting text')}</FormLabel>
                <FormControl>
                  <Input
                    maxLength={200}
                    placeholder={t('Hi! Need a hand with your API keys?')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Leave empty to use the built-in translated greeting.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='placement'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Placement')}</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={busy}
                >
                  <FormControl>
                    <SelectTrigger className='w-full sm:w-64'>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='bottom-right'>
                      {t('Bottom right')}
                    </SelectItem>
                    <SelectItem value='bottom-left'>
                      {t('Bottom left')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t('Corner of the console the mascot occupies.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='showOnAuthPages'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Show on sign-in and sign-up')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Off by default so the mascot does not compete with the sign-in form.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={busy}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {/* Live preview: the same figure the console renders, so the operator
              can judge size and placement without leaving the page. */}
          <div className='bg-muted/40 rounded-xl border p-4'>
            <p className='text-muted-foreground mb-3 text-sm'>
              {t('Preview')}
            </p>
            {enabled ? (
              <div className='flex items-center gap-4'>
                <WhaleFigure
                  talking
                  className='shrink-0'
                  style={{ width: previewSize, height: previewSize }}
                />
                <div className='bg-card rounded-2xl border p-3 text-sm shadow-sm'>
                  {form.watch('greeting').trim() ||
                    t("Hi! I'm {{name}}. Need a hand with your API keys?", {
                      name: previewName.trim() || t('Mascot'),
                    })}
                </div>
              </div>
            ) : (
              <p className='text-muted-foreground text-sm'>
                {t('The mascot is turned off and will not appear.')}
              </p>
            )}
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
