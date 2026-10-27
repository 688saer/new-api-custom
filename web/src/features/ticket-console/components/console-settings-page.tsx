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
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import {
  useConsoleSaveSettings,
  useConsoleSettings,
} from '../hooks/use-console'
import type { TicketConsoleSettings } from '../types'

const DEFAULT_SETTINGS: TicketConsoleSettings = {
  enabled: true,
  agent_name: '',
  welcome: '',
  online: true,
  offline_reply: '',
  max_open_tickets: 5,
  allow_attachments: true,
}

/** 工单系统设置：开关、客服署名、欢迎语、离线自动回复。 */
export function ConsoleSettingsPage() {
  const { t } = useTranslation()
  const settingsQuery = useConsoleSettings(true)
  const saveMutation = useConsoleSaveSettings()
  const [draft, setDraft] = useState<TicketConsoleSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    if (!settingsQuery.data) return
    setDraft(settingsQuery.data.setting)
  }, [settingsQuery.data])

  if (settingsQuery.isLoading) {
    return <p className='text-muted-foreground p-6 text-sm'>{t('Loading…')}</p>
  }

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto'>
      <div>
        <h2 className='text-base font-semibold'>{t('Ticket settings')}</h2>
        <p className='text-muted-foreground text-xs'>
          {t('These settings apply to every user on the site.')}
        </p>
      </div>

      <div className='space-y-4 rounded-lg border p-4'>
        <label className='flex items-center justify-between gap-4 text-sm'>
          <span>
            <span className='font-medium'>{t('Enable the ticket system')}</span>
            <span className='text-muted-foreground block text-xs'>
              {t(
                'Turned off, users see no entry and the API rejects new tickets.'
              )}
            </span>
          </span>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(checked) =>
              setDraft((previous) => ({ ...previous, enabled: checked }))
            }
          />
        </label>

        <label className='flex items-center justify-between gap-4 text-sm'>
          <span>
            <span className='font-medium'>{t('Allow image attachments')}</span>
            <span className='text-muted-foreground block text-xs'>
              {t('PNG, JPG, GIF and WebP up to 2 MB each.')}
            </span>
          </span>
          <Switch
            checked={draft.allow_attachments}
            onCheckedChange={(checked) =>
              setDraft((previous) => ({
                ...previous,
                allow_attachments: checked,
              }))
            }
          />
        </label>

        <label className='flex items-center justify-between gap-4 text-sm'>
          <span>
            <span className='font-medium'>{t('Support is online')}</span>
            <span className='text-muted-foreground block text-xs'>
              {t(
                'Offline, new tickets get the automatic reply below instead of silence.'
              )}
            </span>
          </span>
          <Switch
            checked={draft.online}
            onCheckedChange={(checked) =>
              setDraft((previous) => ({ ...previous, online: checked }))
            }
          />
        </label>
      </div>

      <div className='space-y-4 rounded-lg border p-4'>
        <div className='space-y-2'>
          <Label htmlFor='settings-agent-name'>{t('Support name')}</Label>
          <Input
            id='settings-agent-name'
            value={draft.agent_name}
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                agent_name: event.target.value,
              }))
            }
            placeholder={t('Shown as the sender of replies')}
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='settings-welcome'>{t('Welcome message')}</Label>
          <Textarea
            id='settings-welcome'
            rows={3}
            value={draft.welcome}
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                welcome: event.target.value,
              }))
            }
            placeholder={t('Shown above the new ticket form')}
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='settings-offline'>{t('Offline auto-reply')}</Label>
          <Textarea
            id='settings-offline'
            rows={3}
            value={draft.offline_reply}
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                offline_reply: event.target.value,
              }))
            }
            placeholder={t(
              'Tell users when support is back and what to include meanwhile.'
            )}
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='settings-max-open'>
            {t('Maximum open tickets per user')}
          </Label>
          <Input
            id='settings-max-open'
            type='number'
            min={1}
            max={100}
            value={draft.max_open_tickets}
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                max_open_tickets: Number(event.target.value) || 1,
              }))
            }
            className='w-32'
          />
        </div>
      </div>

      <div className='flex justify-end'>
        <Button
          type='button'
          disabled={saveMutation.isPending}
          onClick={() =>
            saveMutation.mutate(draft, {
              onSuccess: () => toast.success(t('Settings saved')),
              onError: (error) =>
                toast.error(
                  error instanceof Error ? error.message : t('Action failed')
                ),
            })
          }
        >
          {saveMutation.isPending && (
            <Loader2 className='size-4 animate-spin' aria-hidden='true' />
          )}
          {t('Save settings')}
        </Button>
      </div>
    </div>
  )
}
