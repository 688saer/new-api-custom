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
import { ExternalLink, Gift, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
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

import {
  SettingsControlGroup,
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'
import {
  EMPTY_WELFARE_API_ENTRY,
  WelfareApiEntryDialog,
  type WelfareApiEntryValues,
} from './welfare-api-entry-dialog'

const schema = z.object({
  enabled: z.boolean(),
  title: z.string(),
  subtitle: z.string(),
  notice: z.string(),
  requireLogin: z.boolean(),
})

type Values = z.infer<typeof schema>

export type WelfareApiSectionDefaults = {
  enabled: boolean
  title: string
  subtitle: string
  notice: string
  requireLogin: boolean
  entries: WelfareApiEntryValues[]
}

const toStorageEntries = (entries: WelfareApiEntryValues[]) =>
  entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    provider: entry.provider,
    description: entry.description,
    base_url: entry.baseUrl,
    model: entry.model,
    api_key: entry.apiKey,
    docs_url: entry.docsUrl,
    badge: entry.badge,
    enabled: entry.enabled,
    sort: entry.sort,
  }))

const serializeEntries = (entries: WelfareApiEntryValues[]) =>
  JSON.stringify(toStorageEntries(entries))

function newEntryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `wapi-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function WelfareApiSettingsSection(props: {
  defaultValues: WelfareApiSectionDefaults
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const [entries, setEntries] = useState<WelfareApiEntryValues[]>(
    props.defaultValues.entries
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const initialSerialized = useMemo(
    () => serializeEntries(props.defaultValues.entries),
    [props.defaultValues.entries]
  )

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: props.defaultValues.enabled,
      title: props.defaultValues.title,
      subtitle: props.defaultValues.subtitle,
      notice: props.defaultValues.notice,
      requireLogin: props.defaultValues.requireLogin,
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const entriesDirty = serializeEntries(entries) !== initialSerialized
  const dirty = isDirty || entriesDirty

  const openAdd = () => {
    setEditingIndex(null)
    setDialogOpen(true)
  }

  const openEdit = (index: number) => {
    setEditingIndex(index)
    setDialogOpen(true)
  }

  const removeEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index))
  }

  const submitEntry = (values: WelfareApiEntryValues) => {
    setEntries((prev) => {
      if (editingIndex === null) {
        return [...prev, { ...values, id: values.id || newEntryId() }]
      }
      const next = [...prev]
      next[editingIndex] = { ...values, id: values.id || newEntryId() }
      return next
    })
    setEditingIndex(null)
  }

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []
    const push = (key: string, value: string) => updates.push({ key, value })
    const defaults = props.defaultValues

    if (values.enabled !== defaults.enabled) {
      push('welfare_api_setting.enabled', String(values.enabled))
    }
    if (values.title !== defaults.title) {
      push('welfare_api_setting.title', values.title)
    }
    if (values.subtitle !== defaults.subtitle) {
      push('welfare_api_setting.subtitle', values.subtitle)
    }
    if (values.notice !== defaults.notice) {
      push('welfare_api_setting.notice', values.notice)
    }
    if (values.requireLogin !== defaults.requireLogin) {
      push('welfare_api_setting.require_login', String(values.requireLogin))
    }
    if (entriesDirty) {
      push('welfare_api_setting.apis', serializeEntries(entries))
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

  const editingEntry =
    editingIndex === null ? null : (entries[editingIndex] ?? null)

  return (
    <SettingsSection title={t('Welfare API')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!dirty}
            saveLabel='Save welfare API settings'
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable welfare API page')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Publish a public page listing the free APIs configured below'
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
                  name='title'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Page title')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('Welfare API')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='subtitle'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Page subtitle')}</FormLabel>
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
                name='notice'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Notice banner')}</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('Leave blank to hide the banner')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='requireLogin'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Require sign-in to view')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Only signed-in accounts can see the endpoint list'
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

              <SettingsControlGroup>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='text-sm font-medium'>{t('Free APIs')}</p>
                    <p className='text-muted-foreground text-xs'>
                      {t(
                        'Each entry becomes one card on the public page, showing its endpoint and models.'
                      )}
                    </p>
                  </div>
                  <div className='flex items-center gap-2'>
                    <Button
                      type='button'
                      size='sm'
                      variant='ghost'
                      render={
                        <a
                          href='/welfare-apis'
                          target='_blank'
                          rel='noopener noreferrer'
                        />
                      }
                    >
                      <ExternalLink aria-hidden='true' />
                      <span>{t('Preview page')}</span>
                    </Button>
                    <Button type='button' size='sm' onClick={openAdd}>
                      <Plus aria-hidden='true' />
                      <span>{t('Add API')}</span>
                    </Button>
                  </div>
                </div>

                {entries.length === 0 ? (
                  <EmptyState
                    icon={Gift}
                    title={t('No free API yet')}
                    description={t(
                      'Add an entry to publish it on the welfare API page.'
                    )}
                    className='min-h-40'
                  />
                ) : (
                  <ul className='grid gap-2'>
                    {entries.map((entry, index) => (
                      <li
                        key={entry.id || index}
                        className='bg-background/70 flex items-start gap-3 rounded-lg border px-3 py-2.5'
                      >
                        <div className='min-w-0 flex-1 space-y-1'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <span className='truncate text-sm font-medium'>
                              {entry.name || t('Untitled API')}
                            </span>
                            {entry.badge ? (
                              <Badge variant='secondary'>{entry.badge}</Badge>
                            ) : null}
                            {!entry.enabled ? (
                              <Badge variant='outline'>
                                {t('Unpublished')}
                              </Badge>
                            ) : null}
                          </div>
                          <p className='text-muted-foreground truncate font-mono text-xs'>
                            {entry.baseUrl || '—'}
                          </p>
                          {entry.model ? (
                            <p className='text-muted-foreground truncate font-mono text-xs'>
                              {entry.model}
                            </p>
                          ) : null}
                        </div>
                        <div className='flex shrink-0 items-center gap-1'>
                          <Button
                            type='button'
                            size='icon-sm'
                            variant='ghost'
                            aria-label={t('Edit entry')}
                            onClick={() => openEdit(index)}
                          >
                            <Pencil aria-hidden='true' />
                          </Button>
                          <Button
                            type='button'
                            size='icon-sm'
                            variant='ghost'
                            aria-label={t('Delete entry')}
                            onClick={() => removeEntry(index)}
                          >
                            <Trash2 aria-hidden='true' />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SettingsControlGroup>
            </>
          )}
        </SettingsForm>
      </Form>

      <WelfareApiEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editingEntry ?? EMPTY_WELFARE_API_ENTRY}
        onSubmit={submitEntry}
      />
    </SettingsSection>
  )
}
