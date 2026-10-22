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
import { Activity, ExternalLink, Plus, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { EmptyState } from '@/components/empty-state'
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
import { useTargetStatuses } from '@/features/service-status/hooks/use-target-statuses'
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
import { ServiceStatusTargetRow } from './service-status-target-row'
import {
  EMPTY_SERVICE_STATUS_TARGET,
  ServiceStatusTargetDialog,
  type ServiceStatusTargetValues,
} from './service-status-target-dialog'

const schema = z.object({
  enabled: z.boolean(),
  title: z.string(),
  description: z.string(),
  displayHours: z.number(),
  probeIntervalMinutes: z.number(),
  sampleRetentionDays: z.number(),
  requireLogin: z.boolean(),
  showLatency: z.boolean(),
})

type Values = z.infer<typeof schema>

export type ServiceStatusSectionDefaults = {
  enabled: boolean
  title: string
  description: string
  displayHours: number
  probeIntervalMinutes: number
  sampleRetentionDays: number
  requireLogin: boolean
  showLatency: boolean
  targets: ServiceStatusTargetValues[]
}

const toStorageTargets = (targets: ServiceStatusTargetValues[]) =>
  targets.map((target) => ({
    id: target.id,
    name: target.name,
    description: target.description,
    category: target.category,
    icon: target.icon,
    group: target.group,
    model: target.model,
    base_url: target.baseUrl,
    api_key: target.apiKey,
    probe_endpoint: target.probeEndpoint,
    billing_mode: target.billingMode,
    enabled: target.enabled,
    sort: target.sort,
  }))

const serializeTargets = (targets: ServiceStatusTargetValues[]) =>
  JSON.stringify(toStorageTargets(targets))

function newTargetId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `sst-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function ServiceStatusSettingsSection(props: {
  defaultValues: ServiceStatusSectionDefaults
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const targetStatus = useTargetStatuses()

  const [targets, setTargets] = useState<ServiceStatusTargetValues[]>(
    props.defaultValues.targets
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const initialSerialized = useMemo(
    () => serializeTargets(props.defaultValues.targets),
    [props.defaultValues.targets]
  )

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      enabled: props.defaultValues.enabled,
      title: props.defaultValues.title,
      description: props.defaultValues.description,
      displayHours: props.defaultValues.displayHours,
      probeIntervalMinutes: props.defaultValues.probeIntervalMinutes,
      sampleRetentionDays: props.defaultValues.sampleRetentionDays,
      requireLogin: props.defaultValues.requireLogin,
      showLatency: props.defaultValues.showLatency,
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const targetsDirty = serializeTargets(targets) !== initialSerialized
  const dirty = isDirty || targetsDirty

  const openAdd = () => {
    setEditingIndex(null)
    setDialogOpen(true)
  }

  const openEdit = (index: number) => {
    setEditingIndex(index)
    setDialogOpen(true)
  }

  const removeTarget = (index: number) => {
    setTargets((prev) => prev.filter((_, i) => i !== index))
  }

  const submitTarget = (values: ServiceStatusTargetValues) => {
    setTargets((prev) => {
      const next = [...prev]
      const entry = { ...values, id: values.id || newTargetId() }
      if (editingIndex === null) {
        next.push(entry)
      } else {
        next[editingIndex] = entry
      }
      return next
    })
    setEditingIndex(null)
  }

  async function onSubmit(values: Values) {
    const updates: Array<{ key: string; value: string }> = []
    const push = (key: string, value: string) => updates.push({ key, value })
    const defaults = props.defaultValues

    if (values.enabled !== defaults.enabled) {
      push('service_status_setting.enabled', String(values.enabled))
    }
    if (values.title !== defaults.title) {
      push('service_status_setting.title', values.title)
    }
    if (values.description !== defaults.description) {
      push('service_status_setting.description', values.description)
    }
    if (values.displayHours !== defaults.displayHours) {
      push('service_status_setting.display_hours', String(values.displayHours))
    }
    if (values.probeIntervalMinutes !== defaults.probeIntervalMinutes) {
      push(
        'service_status_setting.probe_interval_minutes',
        String(values.probeIntervalMinutes)
      )
    }
    if (values.sampleRetentionDays !== defaults.sampleRetentionDays) {
      push(
        'service_status_setting.sample_retention_days',
        String(values.sampleRetentionDays)
      )
    }
    if (values.requireLogin !== defaults.requireLogin) {
      push('service_status_setting.require_login', String(values.requireLogin))
    }
    if (values.showLatency !== defaults.showLatency) {
      push('service_status_setting.show_latency', String(values.showLatency))
    }
    if (targetsDirty) {
      push('service_status_setting.targets', serializeTargets(targets))
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

  const editingTarget =
    editingIndex === null ? null : (targets[editingIndex] ?? null)

  return (
    <SettingsSection title={t('Channel availability')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!dirty}
            saveLabel='Save service status settings'
          />

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable public service status')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Publish a page showing live probe results for the targets below'
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
                        <Input
                          placeholder={t('Channel availability')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='description'
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

              <div className='grid gap-6 sm:grid-cols-3'>
                <FormField
                  control={form.control}
                  name='displayHours'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Monitoring time range')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          max={720}
                          value={field.value}
                          onChange={(event) =>
                            field.onChange(Number(event.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>{t('Hours')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='probeIntervalMinutes'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Probe interval (minutes)')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          max={1440}
                          value={field.value}
                          onChange={(event) =>
                            field.onChange(Number(event.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Each probe consumes upstream quota.')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='sampleRetentionDays'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Sample retention (days)')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          max={365}
                          value={field.value}
                          onChange={(event) =>
                            field.onChange(Number(event.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Older probe samples are deleted automatically.')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='requireLogin'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Require sign-in to view')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Only signed-in accounts can see the availability page'
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
                name='showLatency'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Show latency')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Display first response and probe duration on each card'
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
                    <p className='text-sm font-medium'>{t('Probe targets')}</p>
                    <p className='text-muted-foreground text-xs'>
                      {t(
                        'Each target becomes one card on the public page. Only enabled targets are probed.'
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
                          href='/service-status'
                          target='_blank'
                          rel='noopener noreferrer'
                        />
                      }
                    >
                      <ExternalLink aria-hidden='true' />
                      <span>{t('Preview page')}</span>
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={
                        targetStatus.isProbingAll || targets.length === 0
                      }
                      onClick={() => void targetStatus.probeAll()}
                    >
                      <RefreshCw
                        aria-hidden='true'
                        className={
                          targetStatus.isProbingAll ? 'animate-spin' : undefined
                        }
                      />
                      <span>{t('Probe now')}</span>
                    </Button>
                    <Button type='button' size='sm' onClick={openAdd}>
                      <Plus aria-hidden='true' />
                      <span>{t('Add probe target')}</span>
                    </Button>
                  </div>
                </div>

                {targets.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title={t('No probe target yet')}
                    description={t(
                      'Add a target to publish it on the availability page.'
                    )}
                    className='min-h-40'
                  />
                ) : (
                  <ul className='grid gap-2'>
                    {targets.map((target, index) => (
                      <ServiceStatusTargetRow
                        key={target.id || index}
                        target={target}
                        status={targetStatus.statusMap.get(target.id)}
                        probing={targetStatus.probingTargetId === target.id}
                        onEdit={() => openEdit(index)}
                        onProbe={() => void targetStatus.probeOne(target.id)}
                        onRemove={() => removeTarget(index)}
                      />
                    ))}
                  </ul>
                )}
              </SettingsControlGroup>
            </>
          )}
        </SettingsForm>
      </Form>

      <ServiceStatusTargetDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editingTarget ?? EMPTY_SERVICE_STATUS_TARGET}
        onSubmit={submitTarget}
      />
    </SettingsSection>
  )
}
