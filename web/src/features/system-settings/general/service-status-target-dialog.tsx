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
import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Dialog } from '@/components/dialog'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const entrySchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  description: z.string(),
  category: z.string(),
  icon: z.string(),
  group: z.string(),
  model: z.string().min(1, 'Model is required'),
  baseUrl: z.string().min(1, 'Endpoint is required'),
  apiKey: z.string(),
  probeEndpoint: z.string(),
  billingMode: z.string(),
  enabled: z.boolean(),
  sort: z.number(),
})

export type ServiceStatusTargetValues = z.infer<typeof entrySchema>

export const EMPTY_SERVICE_STATUS_TARGET: ServiceStatusTargetValues = {
  id: '',
  name: '',
  description: '',
  category: '',
  icon: '',
  group: '',
  model: '',
  baseUrl: '',
  apiKey: '',
  probeEndpoint: 'openai',
  billingMode: 'token',
  enabled: true,
  sort: 0,
}

const PROBE_ENDPOINTS = [
  { value: 'openai', label: 'Chat Completions (/v1/chat/completions)' },
  { value: 'openai-response', label: 'Responses (/v1/responses)' },
  { value: 'anthropic', label: 'Messages (/v1/messages)' },
]

const BILLING_MODES = [
  { value: 'token', label: 'Token based' },
  { value: 'per_call', label: 'Per call' },
  { value: 'per_image', label: 'Per image' },
  { value: 'per_second', label: 'Per second' },
]

interface ServiceStatusTargetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: ServiceStatusTargetValues
  onSubmit: (values: ServiceStatusTargetValues) => void
}

/** Add or edit one probe target published on the availability page. */
export function ServiceStatusTargetDialog(props: ServiceStatusTargetDialogProps) {
  const { t } = useTranslation()

  const form = useForm<ServiceStatusTargetValues>({
    resolver: zodResolver(entrySchema) as unknown as Resolver<ServiceStatusTargetValues>,
    defaultValues: props.initial,
  })

  useEffect(() => {
    if (props.open) {
      form.reset(props.initial)
    }
  }, [props.open, props.initial, form])

  const handleSubmit = form.handleSubmit((values) => {
    props.onSubmit(values)
    props.onOpenChange(false)
  })

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.initial.id ? t('Edit probe target') : t('Add probe target')}
      description={t(
        'The probe worker calls this endpoint on a schedule and records the result.'
      )}
      contentHeight='auto'
      contentClassName='sm:max-w-2xl'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='button' onClick={handleSubmit}>
            {t('Save')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={handleSubmit} className='space-y-4' autoComplete='off'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Display name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='group'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Group')}</FormLabel>
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
            name='description'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Description')}</FormLabel>
                <FormControl>
                  <Textarea rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='category'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Category')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='icon'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Icon')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Optional icon identifier shown on the card')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name='baseUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Probe Endpoint')}</FormLabel>
                <FormControl>
                  <Input placeholder='https://api.example.com' {...field} />
                </FormControl>
                <FormDescription>
                  {t('Base URL only; the probe appends the API path.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='model'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Probe models')}</FormLabel>
                  <FormControl>
                    <Input placeholder='gpt-4o-mini' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='apiKey'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Probe API Key')}</FormLabel>
                  <FormControl>
                    <Input type='password' {...field} />
                  </FormControl>
                  <FormDescription>
                    {t('Sent as a bearer token (or x-api-key for Anthropic).')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='probeEndpoint'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Select a probe endpoint')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROBE_ENDPOINTS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='billingMode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Billing mode')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BILLING_MODES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='sort'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Sort order')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(Number(event.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                  <div className='space-y-0.5'>
                    <FormLabel>{t('Enable model monitoring')}</FormLabel>
                    <FormDescription>
                      {t('Only enabled targets are probed and published.')}
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
          </div>
        </form>
      </Form>
    </Dialog>
  )
}
