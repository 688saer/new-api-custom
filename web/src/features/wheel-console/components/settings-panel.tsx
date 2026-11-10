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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatQuota } from '@/lib/format'

import type { WheelSettings } from '../types'

interface SettingsPanelProps {
  settings: WheelSettings | null
  loading: boolean
  submitting: boolean
  error: string | null
  onSave: (settings: WheelSettings) => void
}

/** 活动规则配置：开关、文案、抽奖消耗与展示策略。 */
export function SettingsPanel(props: SettingsPanelProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<WheelSettings | null>(props.settings)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(props.settings)
  }, [props.settings])

  if (props.loading && draft == null) {
    return <Skeleton className='h-96 rounded-xl' />
  }
  if (draft == null) {
    return (
      <p role='alert' className='text-destructive text-sm'>
        {t('Failed to load settings')}
      </p>
    )
  }

  const patch = (values: Partial<WheelSettings>) => {
    setDraft((prev) => (prev ? { ...prev, ...values } : prev))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (draft.daily_free_draws < 0) {
      setLocalError(t('Free daily draws cannot be negative'))
      return
    }
    if (draft.single_cost_quota < 0) {
      setLocalError(t('Draw cost cannot be negative'))
      return
    }
    if (draft.daily_draw_limit < 0) {
      setLocalError(t('Daily draw limit cannot be negative'))
      return
    }
    setLocalError(null)
    props.onSave(draft)
  }

  const message = localError ?? props.error

  return (
    <form className='space-y-4' onSubmit={handleSubmit}>
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>{t('Activity switch')}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-3'>
          <div className='flex items-center justify-between gap-4 rounded-lg border px-3 py-2'>
            <div>
              <p className='text-sm font-medium'>{t('Enable lucky wheel')}</p>
              <p className='text-muted-foreground text-xs'>
                {t('When disabled, users only see a closed notice.')}
              </p>
            </div>
            <Switch
              checked={draft.enabled}
              aria-label={t('Enable lucky wheel')}
              onCheckedChange={(checked) => patch({ enabled: !!checked })}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-setting-title'>{t('Activity title')}</Label>
            <Input
              id='wheel-setting-title'
              value={draft.title}
              maxLength={64}
              onChange={(event) => patch({ title: event.target.value })}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-setting-subtitle'>
              {t('Activity subtitle')}
            </Label>
            <Input
              id='wheel-setting-subtitle'
              value={draft.subtitle}
              maxLength={128}
              onChange={(event) => patch({ subtitle: event.target.value })}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-setting-rules'>{t('Activity rules')}</Label>
            <Textarea
              id='wheel-setting-rules'
              value={draft.rules_text}
              rows={5}
              maxLength={2000}
              placeholder={t('One rule per line')}
              onChange={(event) => patch({ rules_text: event.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>{t('Draw rules')}</CardTitle>
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-setting-free'>
              {t('Free draws per day')}
            </Label>
            <Input
              id='wheel-setting-free'
              type='number'
              min={0}
              step={1}
              value={draft.daily_free_draws}
              onChange={(event) =>
                patch({ daily_free_draws: Number(event.target.value) || 0 })
              }
            />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-setting-limit'>{t('Daily draw limit')}</Label>
            <Input
              id='wheel-setting-limit'
              type='number'
              min={0}
              step={1}
              value={draft.daily_draw_limit}
              onChange={(event) =>
                patch({ daily_draw_limit: Number(event.target.value) || 0 })
              }
            />
            <p className='text-muted-foreground text-xs'>
              {t('0 means no limit')}
            </p>
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-setting-cost'>
              {t('Cost per extra draw')}
            </Label>
            <Input
              id='wheel-setting-cost'
              type='number'
              min={0}
              step={1}
              value={draft.single_cost_quota}
              onChange={(event) =>
                patch({ single_cost_quota: Number(event.target.value) || 0 })
              }
            />
            <p className='text-muted-foreground text-xs'>
              ≈ {formatQuota(draft.single_cost_quota)}
            </p>
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-setting-expire'>
              {t('Redemption code validity (days)')}
            </Label>
            <Input
              id='wheel-setting-expire'
              type='number'
              min={0}
              step={1}
              value={draft.redemption_expire_days}
              onChange={(event) =>
                patch({
                  redemption_expire_days: Number(event.target.value) || 0,
                })
              }
            />
            <p className='text-muted-foreground text-xs'>
              {t('0 means the code never expires')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-sm'>{t('Public winner feed')}</CardTitle>
        </CardHeader>
        <CardContent className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <div className='flex items-center justify-between gap-4 rounded-lg border px-3 py-2'>
            <div>
              <p className='text-sm font-medium'>{t('Show recent winners')}</p>
              <p className='text-muted-foreground text-xs'>
                {t('Usernames are masked before display.')}
              </p>
            </div>
            <Switch
              checked={draft.show_public_wins}
              aria-label={t('Show recent winners')}
              onCheckedChange={(checked) =>
                patch({ show_public_wins: !!checked })
              }
            />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-setting-public-limit'>
              {t('Winner feed size')}
            </Label>
            <Input
              id='wheel-setting-public-limit'
              type='number'
              min={0}
              step={1}
              value={draft.public_wins_limit}
              onChange={(event) =>
                patch({ public_wins_limit: Number(event.target.value) || 0 })
              }
            />
          </div>
        </CardContent>
      </Card>

      {message != null && (
        <p role='alert' className='text-destructive text-sm'>
          {message}
        </p>
      )}

      <div className='flex justify-end'>
        <Button type='submit' disabled={props.submitting}>
          {props.submitting ? t('Saving…') : t('Save settings')}
        </Button>
      </div>
    </form>
  )
}
