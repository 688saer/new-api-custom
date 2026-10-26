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
import dayjs from '@/lib/dayjs'

import type { RewardCampaignDraft } from '../types'

interface RewardWindowFieldsProps {
  draft: RewardCampaignDraft
  onDraftChange: (draft: RewardCampaignDraft) => void
}

/** Unix 秒转 `datetime-local` 输入框的值；0 表示不限，显示为空。 */
function toInputValue(timestamp: number): string {
  if (!timestamp) return ''
  return dayjs(timestamp * 1000).format('YYYY-MM-DDTHH:mm:ss')
}

/** `datetime-local` 的值转回 Unix 秒；空值表示不限。 */
function fromInputValue(value: string): number {
  if (!value) return 0
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.unix() : 0
}

/**
 * 领取窗口：开始时间与截止时间。
 *
 * 开始时间为空表示发放后立即可领，截止时间为空表示长期有效。两个值都按
 * 浏览器本地时区解释，提交给后端的是 Unix 秒，跨时区展示时由后端值回显。
 */
export function RewardWindowFields(props: RewardWindowFieldsProps) {
  const { t } = useTranslation()
  const draft = props.draft

  const patch = (next: Partial<RewardCampaignDraft>) =>
    props.onDraftChange({ ...draft, ...next })

  const windowInvalid =
    draft.claim_start_at > 0 &&
    draft.expires_at > 0 &&
    draft.claim_start_at >= draft.expires_at

  return (
    <fieldset className='space-y-4 border-t pt-6'>
      <legend className='text-sm font-semibold'>{t('Claim window')}</legend>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='reward-claim-start'>{t('Claim start time')}</Label>
          <Input
            id='reward-claim-start'
            type='datetime-local'
            step={1}
            value={toInputValue(draft.claim_start_at)}
            onChange={(event) =>
              patch({ claim_start_at: fromInputValue(event.target.value) })
            }
          />
          <p className='text-muted-foreground text-xs'>
            {draft.claim_start_at > 0
              ? t('Claimable from {{date}}', {
                  date: dayjs(draft.claim_start_at * 1000).format(
                    'YYYY-MM-DD HH:mm:ss'
                  ),
                })
              : t('Claimable immediately after issuing')}
          </p>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='reward-expires-at'>{t('Claim deadline')}</Label>
          <Input
            id='reward-expires-at'
            type='datetime-local'
            step={1}
            value={toInputValue(draft.expires_at)}
            onChange={(event) =>
              patch({ expires_at: fromInputValue(event.target.value) })
            }
          />
          <p className='text-muted-foreground text-xs'>
            {draft.expires_at > 0
              ? t('Valid until {{date}}', {
                  date: dayjs(draft.expires_at * 1000).format(
                    'YYYY-MM-DD HH:mm:ss'
                  ),
                })
              : t('Long-term valid')}
          </p>
        </div>
      </div>

      {windowInvalid && (
        <p role='alert' className='text-destructive text-xs'>
          {t('Claim start time must be earlier than the deadline')}
        </p>
      )}
    </fieldset>
  )
}
