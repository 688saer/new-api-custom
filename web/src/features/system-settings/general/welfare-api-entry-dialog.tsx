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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import { safeNumberFieldProps } from '../utils/numeric-field'

const entrySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  provider: z.string(),
  description: z.string(),
  baseUrl: z.string().min(1),
  model: z.string(),
  apiKey: z.string(),
  docsUrl: z.string(),
  badge: z.string(),
  sort: z.coerce.number().int(),
  enabled: z.boolean(),
})

export type WelfareApiEntryValues = z.infer<typeof entrySchema>

export const EMPTY_WELFARE_API_ENTRY: WelfareApiEntryValues = {
  id: '',
  name: '',
  provider: '',
  description: '',
  baseUrl: '',
  model: '',
  apiKey: '',
  docsUrl: '',
  badge: '',
  sort: 0,
  enabled: true,
}

export function WelfareApiEntryDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: WelfareApiEntryValues | null
  onSubmit: (values: WelfareApiEntryValues) => void
}) {
  const { t } = useTranslation()

  const form = useForm<WelfareApiEntryValues>({
    resolver: zodResolver(entrySchema) as unknown as Resolver<WelfareApiEntryValues>,
    defaultValues: props.initial ?? EMPTY_WELFARE_API_ENTRY,
  })

  useEffect(() => {
    if (props.open) {
      form.reset(props.initial ?? EMPTY_WELFARE_API_ENTRY)
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
      title={
        props.initial
          ? t('Edit welfare API entry')
          : t('Add welfare API entry')
      }
      description={t(
        'Only enabled entries are published on the public welfare API page.'
      )}
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='button' size='sm' onClick={handleSubmit}>
            {t('Save')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <div className='grid gap-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Display name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('DeepSeek V3 free tier')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='provider'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Provider')}</FormLabel>
                  <FormControl>
                    <Input placeholder='DeepSeek' {...field} />
                  </FormControl>
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
                <FormLabel>{t('Endpoint')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder='https://api.example.com/v1'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t('Base URL users copy into their client')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='model'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Model')}</FormLabel>
                <FormControl>
                  <Input placeholder='deepseek-chat, deepseek-reasoner' {...field} />
                </FormControl>
                <FormDescription>
                  {t('Separate multiple models with commas')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='apiKey'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('API key')}</FormLabel>
                <FormControl>
                  <Input placeholder='sk-...' {...field} />
                </FormControl>
                <FormDescription>
                  {t('Published as-is. Leave blank to hide the key row.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

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
              name='badge'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Badge')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('Limited time')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='docsUrl'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Docs link')}</FormLabel>
                  <FormControl>
                    <Input placeholder='https://...' {...field} />
                  </FormControl>
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
                    <Input type='number' {...safeNumberFieldProps(field)} />
                  </FormControl>
                  <FormDescription>
                    {t('Smaller numbers are listed first')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <FormItem className='flex flex-col justify-center gap-2 rounded-xl border px-3 py-2.5'>
                  <div className='flex items-center justify-between gap-3'>
                    <FormLabel className='mb-0'>{t('Published')}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                  <FormDescription>
                    {t('Unpublished entries stay hidden from users')}
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>
        </div>
      </Form>
    </Dialog>
  )
}
