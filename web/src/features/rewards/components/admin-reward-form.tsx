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

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatQuota } from '@/lib/format'

import { rewardPreviewQuota } from '../lib/reward-draft'
import type { RewardCampaignDraft, RewardTicketCopy } from '../types'
import { RewardAmountFields } from './reward-amount-fields'
import { RewardAudienceFields } from './reward-audience-fields'
import { RewardCopyFields } from './reward-copy-fields'
import { RewardTicket } from './reward-ticket'
import { RewardWindowFields } from './reward-window-fields'

interface AdminRewardFormProps {
  draft: RewardCampaignDraft
  onDraftChange: (draft: RewardCampaignDraft) => void
  onPreview: () => void
  onIssue: () => void
  previewing: boolean
  issuing: boolean
  canIssue: boolean
}

/** 发放表单：左表单、右券面实时预览。 */
export function AdminRewardForm(props: AdminRewardFormProps) {
  const { t } = useTranslation()
  const draft = props.draft

  const patch = (next: Partial<RewardCampaignDraft>) =>
    props.onDraftChange({ ...draft, ...next })

  const patchCopy = (next: Partial<RewardTicketCopy>) =>
    patch({ copy: { ...draft.copy, ...next } })

  const previewAmount = rewardPreviewQuota(draft)

  let amountSummary = t('{{amount}} per user', {
    amount: formatQuota(draft.fixed_quota),
  })
  if (draft.reward_mode === 'percentage') {
    amountSummary = t('{{percent}}% of spend, capped at {{amount}}', {
      percent: draft.percent,
      amount: formatQuota(draft.cap_quota),
    })
  }
  if (draft.reward_mode === 'random') {
    amountSummary = t('{{min}} to {{max}} per user, drawn at issue time', {
      min: formatQuota(draft.random_min_quota),
      max: formatQuota(draft.random_max_quota),
    })
  }

  return (
    <div className='grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]'>
      <form className='space-y-6' onSubmit={(event) => event.preventDefault()}>
        <fieldset className='space-y-4'>
          <legend className='text-sm font-semibold'>{t('Campaign')}</legend>
          <div className='space-y-2'>
            <Label htmlFor='reward-name'>{t('Campaign name')}</Label>
            <Input
              id='reward-name'
              value={draft.name}
              maxLength={80}
              placeholder={t('User appreciation reward')}
              onChange={(event) => patch({ name: event.target.value })}
            />
          </div>
        </fieldset>

        <RewardAudienceFields
          audience={draft.audience}
          onAudienceChange={(audience) => patch({ audience })}
        />

        <RewardAmountFields draft={draft} onDraftChange={props.onDraftChange} />

        <RewardWindowFields draft={draft} onDraftChange={props.onDraftChange} />

        <RewardCopyFields
          style={draft.style}
          copy={draft.copy}
          onStyleChange={(style) => patch({ style })}
          onCopyChange={patchCopy}
          t={t}
        />

        <div className='flex flex-wrap justify-end gap-3 border-t pt-6'>
          <Button
            type='button'
            variant='outline'
            disabled={props.previewing}
            onClick={props.onPreview}
          >
            {props.previewing ? t('Calculating…') : t('Preview recipients')}
          </Button>
          <Button
            type='button'
            disabled={!props.canIssue || props.issuing}
            onClick={props.onIssue}
          >
            {props.issuing ? t('Issuing…') : t('Issue rewards')}
          </Button>
        </div>
      </form>

      <aside className='space-y-4'>
        <h3 className='text-sm font-semibold'>{t('Ticket preview')}</h3>
        <RewardTicket
          style={draft.style}
          copy={draft.copy}
          amount={formatQuota(previewAmount)}
        />
        <p className='text-muted-foreground text-xs'>{amountSummary}</p>
      </aside>
    </div>
  )
}
