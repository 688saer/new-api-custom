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
import { useForm, type Control, type Resolver } from 'react-hook-form'
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

const schema = z.object({
  enabled: z.boolean(),
  captchaId: z.string(),
  captchaKey: z.string(),
  onRegister: z.boolean(),
  onLogin: z.boolean(),
  onCheckin: z.boolean(),
  onPasswordReset: z.boolean(),
  onEmailVerify: z.boolean(),
})

type Values = z.infer<typeof schema>

/** The five entry points that can be challenged, each switched separately. */
const ACTION_SWITCHES = [
  {
    name: 'onRegister',
    optionKey: 'geetest_setting.on_register',
    labelKey: 'Require verification on registration',
    descriptionKey: 'Only the sign-up form asks for a challenge.',
  },
  {
    name: 'onLogin',
    optionKey: 'geetest_setting.on_login',
    labelKey: 'Require verification on sign-in',
    descriptionKey: 'Only the sign-in form asks for a challenge.',
  },
  {
    name: 'onCheckin',
    optionKey: 'geetest_setting.on_checkin',
    labelKey: 'Require verification on check-in',
    descriptionKey: 'Only the daily check-in asks for a challenge.',
  },
  {
    name: 'onPasswordReset',
    optionKey: 'geetest_setting.on_password_reset',
    labelKey: 'Require verification on password reset',
    descriptionKey: 'Only the password recovery form asks for a challenge.',
  },
  {
    name: 'onEmailVerify',
    optionKey: 'geetest_setting.on_email_verify',
    labelKey: 'Require verification when sending codes',
    descriptionKey: 'Only the email verification code request is challenged.',
  },
] as const

export type GeeTestSectionDefaults = {
  enabled: boolean
  captchaId: string
  captchaKey: string
  onRegister: boolean
  onLogin: boolean
  onCheckin: boolean
  onPasswordReset: boolean
  onEmailVerify: boolean
}

interface ActionSwitchProps {
  control: Control<Values>
  name: (typeof ACTION_SWITCHES)[number]['name']
  label: string
  description: string
  disabled: boolean
}

function GeeTestActionSwitch(props: ActionSwitchProps) {
  return (
    <FormField
      control={props.control}
      name={props.name}
      render={({ field }) => (
        <SettingsSwitchItem>
          <SettingsSwitchContent>
            <FormLabel>{props.label}</FormLabel>
            <FormDescription>{props.description}</FormDescription>
          </SettingsSwitchContent>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={props.disabled}
            />
          </FormControl>
        </SettingsSwitchItem>
      )}
    />
  )
}

export function GeeTestSettingsSection({
  defaultValues,
}: {
  defaultValues: GeeTestSectionDefaults
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: defaultValues.enabled,
      captchaId: defaultValues.captchaId,
      captchaKey: defaultValues.captchaKey,
      onRegister: defaultValues.onRegister,
      onLogin: defaultValues.onLogin,
      onCheckin: defaultValues.onCheckin,
      onPasswordReset: defaultValues.onPasswordReset,
      onEmailVerify: defaultValues.onEmailVerify,
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const captchaId = form.watch('captchaId')
  const captchaKey = form.watch('captchaKey')
  const configured = captchaId.trim() !== '' && captchaKey.trim() !== ''
  const busy = updateOption.isPending || isSubmitting

  async function onSubmit(values: Values) {
    // Credentials are written first: the server refuses to switch the master on
    // until both are present, and each option update is its own request.
    const updates: Array<{ key: string; value: string }> = []

    if (values.captchaId !== defaultValues.captchaId) {
      updates.push({
        key: 'geetest_setting.captcha_id',
        value: values.captchaId.trim(),
      })
    }
    if (values.captchaKey !== defaultValues.captchaKey) {
      updates.push({
        key: 'geetest_setting.captcha_key',
        value: values.captchaKey.trim(),
      })
    }
    for (const action of ACTION_SWITCHES) {
      if (values[action.name] !== defaultValues[action.name]) {
        updates.push({
          key: action.optionKey,
          value: String(values[action.name]),
        })
      }
    }
    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'geetest_setting.enabled',
        value: String(values.enabled),
      })
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }

    form.reset({ ...values, captchaId: values.captchaId.trim() })
  }

  return (
    <SettingsSection title={t('GeeTest Verification')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={busy}
            isSaveDisabled={!isDirty}
            saveLabel='Save GeeTest settings'
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable GeeTest verification')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Ask visitors to solve a GeeTest V4 challenge on the actions enabled below. Turnstile can stay enabled at the same time.'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={busy || !configured}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          <div className='grid gap-6 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='captchaId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('GeeTest captcha id')}</FormLabel>
                  <FormControl>
                    <Input placeholder='xxxxxxxxxxxxxxxx' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Public identifier shown to the browser.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='captchaKey'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('GeeTest captcha key')}</FormLabel>
                  <FormControl>
                    <Input type='password' autoComplete='off' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Server-side secret used to sign the validation request. It is never sent to the browser.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {!configured && (
            <p className='text-muted-foreground text-sm'>
              {t(
                'Enter the captcha id and captcha key first. The switch unlocks once both are filled in.'
              )}
            </p>
          )}

          {enabled && (
            <div className='space-y-4'>
              <p className='text-muted-foreground text-sm'>
                {t('Protected actions')}
              </p>
              {ACTION_SWITCHES.map((action) => (
                <GeeTestActionSwitch
                  key={action.name}
                  control={form.control}
                  name={action.name}
                  label={t(action.labelKey)}
                  description={t(action.descriptionKey)}
                  disabled={busy}
                />
              ))}
            </div>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
