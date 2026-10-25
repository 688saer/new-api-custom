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
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatQuota } from '@/lib/format'

import type { RewardCampaignDraft, RewardMode } from '../types'

const MODE_LABEL_KEYS: Record<RewardMode, string> = {
  fixed: 'Fixed amount per user',
  percentage: 'Percentage of spend',
  random: 'Random amount per user',
}

const MODE_OPTIONS: RewardMode[] = ['fixed', 'percentage', 'random']

interface RewardAmountFieldsProps {
  draft: RewardCampaignDraft
  onDraftChange: (draft: RewardCampaignDraft) => void
}

/** 奖励额度：固定、按消费比例、每人随机三种计算方式。 */
export function RewardAmountFields(props: RewardAmountFieldsProps) {
  const { t } = useTranslation()
  const draft = props.draft

  const patch = (next: Partial<RewardCampaignDraft>) =>
    props.onDraftChange({ ...draft, ...next })

  return (
    <fieldset className='space-y-4 border-t pt-6'>
      <legend className='text-sm font-semibold'>{t('Reward amount')}</legend>

      <div className='space-y-2'>
        <Label htmlFor='reward-mode'>{t('Calculation')}</Label>
        <NativeSelect
          id='reward-mode'
          value={draft.reward_mode}
          onChange={(event) =>
            patch({ reward_mode: event.target.value as RewardMode })
          }
        >
          {MODE_OPTIONS.map((mode) => (
            <NativeSelectOption key={mode} value={mode}>
              {t(MODE_LABEL_KEYS[mode])}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {draft.reward_mode === 'fixed' && (
        <div className='space-y-2'>
          <Label htmlFor='reward-fixed'>{t('Amount per user')}</Label>
          <Input
            id='reward-fixed'
            type='number'
            min={1}
            value={draft.fixed_quota}
            onChange={(event) =>
              patch({ fixed_quota: Number(event.target.value) || 0 })
            }
          />
          <p className='text-muted-foreground text-xs'>
            {formatQuota(draft.fixed_quota)}
          </p>
        </div>
      )}

      {draft.reward_mode === 'random' && (
        <div className='space-y-3'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='reward-random-min'>{t('Minimum amount')}</Label>
              <Input
                id='reward-random-min'
                type='number'
                min={1}
                value={draft.random_min_quota}
                onChange={(event) =>
                  patch({ random_min_quota: Number(event.target.value) || 0 })
                }
              />
              <p className='text-muted-foreground text-xs'>
                {formatQuota(draft.random_min_quota)}
              </p>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='reward-random-max'>{t('Maximum amount')}</Label>
              <Input
                id='reward-random-max'
                type='number'
                min={1}
                value={draft.random_max_quota}
                onChange={(event) =>
                  patch({ random_max_quota: Number(event.target.value) || 0 })
                }
              />
              <p className='text-muted-foreground text-xs'>
                {formatQuota(draft.random_max_quota)}
              </p>
            </div>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Each user draws an amount in this range when the rewards are issued, and the drawn amount is fixed from then on'
            )}
          </p>
        </div>
      )}

      {draft.reward_mode === 'percentage' && (
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='reward-percent'>{t('Percent of spend')}</Label>
            <Input
              id='reward-percent'
              type='number'
              min={1}
              max={100}
              value={draft.percent}
              onChange={(event) =>
                patch({ percent: Number(event.target.value) || 0 })
              }
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='reward-cap'>{t('Cap per user')}</Label>
            <Input
              id='reward-cap'
              type='number'
              min={1}
              value={draft.cap_quota}
              onChange={(event) =>
                patch({ cap_quota: Number(event.target.value) || 0 })
              }
            />
            <p className='text-muted-foreground text-xs'>
              {formatQuota(draft.cap_quota)}
            </p>
          </div>
        </div>
      )}
    </fieldset>
  )
}
