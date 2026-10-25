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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

import type { RewardAudienceDraft, RewardAudienceScope } from '../types'

const AUDIENCE_SCOPES: RewardAudienceScope[] = [
  'all',
  'active',
  'spend',
  'specific',
]

const SCOPE_LABEL_KEYS: Record<RewardAudienceScope, string> = {
  all: 'All users',
  active: 'Recently active users',
  spend: 'Users above a spend threshold',
  specific: 'Specific users',
}

interface RewardAudienceFieldsProps {
  audience: RewardAudienceDraft
  onAudienceChange: (audience: RewardAudienceDraft) => void
}

/** 发放范围：全体、近期活跃、消费区间、指定用户。 */
export function RewardAudienceFields(props: RewardAudienceFieldsProps) {
  const { t } = useTranslation()
  const [userIdText, setUserIdText] = useState('')
  const audience = props.audience

  const patch = (next: Partial<RewardAudienceDraft>) =>
    props.onAudienceChange({ ...audience, ...next })

  return (
    <fieldset className='space-y-4'>
      <legend className='text-sm font-semibold'>{t('Audience')}</legend>

      <div className='space-y-2'>
        <Label htmlFor='reward-scope'>{t('Audience scope')}</Label>
        <NativeSelect
          id='reward-scope'
          value={audience.scope}
          onChange={(event) =>
            patch({ scope: event.target.value as RewardAudienceScope })
          }
        >
          {AUDIENCE_SCOPES.map((scope) => (
            <NativeSelectOption key={scope} value={scope}>
              {t(SCOPE_LABEL_KEYS[scope])}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {audience.scope === 'active' && (
        <div className='space-y-2'>
          <Label htmlFor='reward-active-days'>{t('Active within days')}</Label>
          <Input
            id='reward-active-days'
            type='number'
            min={1}
            value={audience.active_days}
            onChange={(event) =>
              patch({ active_days: Number(event.target.value) || 0 })
            }
          />
        </div>
      )}

      {audience.scope === 'spend' && (
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='reward-spend-min'>{t('Minimum spend (USD)')}</Label>
            <Input
              id='reward-spend-min'
              type='number'
              min={0}
              step='0.01'
              value={audience.spend_min_usd}
              onChange={(event) =>
                patch({ spend_min_usd: Number(event.target.value) || 0 })
              }
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='reward-spend-max'>{t('Maximum spend (USD)')}</Label>
            <Input
              id='reward-spend-max'
              type='number'
              min={0}
              step='0.01'
              value={audience.spend_max_usd}
              onChange={(event) =>
                patch({ spend_max_usd: Number(event.target.value) || 0 })
              }
            />
          </div>
        </div>
      )}

      {audience.scope === 'specific' && (
        <div className='space-y-2'>
          <Label htmlFor='reward-user-ids'>{t('User IDs')}</Label>
          <Input
            id='reward-user-ids'
            value={userIdText}
            placeholder={t('Comma separated user IDs')}
            onChange={(event) => {
              setUserIdText(event.target.value)
              const ids = event.target.value
                .split(',')
                .map((part) => Number(part.trim()))
                .filter((id) => Number.isInteger(id) && id > 0)
              patch({ user_ids: ids })
            }}
          />
          <p className='text-muted-foreground text-xs'>
            {t('{{count}} users selected', { count: audience.user_ids.length })}
          </p>
        </div>
      )}
    </fieldset>
  )
}
