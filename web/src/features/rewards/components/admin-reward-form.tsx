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

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { formatQuota } from '@/lib/format'

import type {
  RewardAudienceScope,
  RewardCampaignDraft,
  RewardMode,
  RewardStyle,
  RewardTicketCopy,
} from '../types'
import { REWARD_STYLES } from '../types'
import { RewardTicket } from './reward-ticket'

/** 默认券面文案，与后端 `reward_setting.default_copy` 保持一致。 */
const DEFAULT_COPY: RewardTicketCopy = {
  label: 'New API',
  title: '感谢你的支持',
  subtitle: '每一次创造，都值得被支持。',
  footer: '奖励金可用于本站模型调用',
  stub_text: '专属奖励',
  stub_font_size: 28,
  button_text: '领取奖励金',
}

export function createEmptyDraft(): RewardCampaignDraft {
  return {
    name: '',
    style: 'aurora',
    copy: { ...DEFAULT_COPY },
    audience: {
      scope: 'all',
      active_days: 30,
      spend_min_usd: 0,
      spend_max_usd: 0,
      user_ids: [],
    },
    reward_mode: 'fixed',
    fixed_quota: 250000,
    percent: 5,
    cap_quota: 500000,
    expires_at: 0,
  }
}

interface AdminRewardFormProps {
  draft: RewardCampaignDraft
  onDraftChange: (draft: RewardCampaignDraft) => void
  onPreview: () => void
  onIssue: () => void
  previewing: boolean
  issuing: boolean
  canIssue: boolean
}

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

const STYLE_LABEL_KEYS: Record<RewardStyle, string> = {
  aurora: 'Aurora',
  citrus: 'Citrus',
  sunrise: 'Sunrise',
  nocturne: 'Nocturne',
}

/** 发放表单：左表单、右券面实时预览。 */
export function AdminRewardForm(props: AdminRewardFormProps) {
  const { t } = useTranslation()
  const [userIdText, setUserIdText] = useState('')
  const draft = props.draft

  const patch = (next: Partial<RewardCampaignDraft>) =>
    props.onDraftChange({ ...draft, ...next })

  const patchCopy = (next: Partial<RewardTicketCopy>) =>
    patch({ copy: { ...draft.copy, ...next } })

  const previewAmount =
    draft.reward_mode === 'fixed' ? draft.fixed_quota : draft.cap_quota

  return (
    <div className='grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]'>
      <form className='space-y-6' onSubmit={(event) => event.preventDefault()}>
        <fieldset className='space-y-4'>
          <legend className='text-sm font-semibold'>{t('Audience')}</legend>

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

          <div className='space-y-2'>
            <Label htmlFor='reward-scope'>{t('Audience scope')}</Label>
            <NativeSelect
              id='reward-scope'
              value={draft.audience.scope}
              onChange={(event) =>
                patch({
                  audience: {
                    ...draft.audience,
                    scope: event.target.value as RewardAudienceScope,
                  },
                })
              }
            >
              {AUDIENCE_SCOPES.map((scope) => (
                <NativeSelectOption key={scope} value={scope}>
                  {t(SCOPE_LABEL_KEYS[scope])}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {draft.audience.scope === 'active' && (
            <div className='space-y-2'>
              <Label htmlFor='reward-active-days'>
                {t('Active within days')}
              </Label>
              <Input
                id='reward-active-days'
                type='number'
                min={1}
                value={draft.audience.active_days}
                onChange={(event) =>
                  patch({
                    audience: {
                      ...draft.audience,
                      active_days: Number(event.target.value) || 0,
                    },
                  })
                }
              />
            </div>
          )}

          {draft.audience.scope === 'spend' && (
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='reward-spend-min'>
                  {t('Minimum spend (USD)')}
                </Label>
                <Input
                  id='reward-spend-min'
                  type='number'
                  min={0}
                  step='0.01'
                  value={draft.audience.spend_min_usd}
                  onChange={(event) =>
                    patch({
                      audience: {
                        ...draft.audience,
                        spend_min_usd: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='reward-spend-max'>
                  {t('Maximum spend (USD)')}
                </Label>
                <Input
                  id='reward-spend-max'
                  type='number'
                  min={0}
                  step='0.01'
                  value={draft.audience.spend_max_usd}
                  onChange={(event) =>
                    patch({
                      audience: {
                        ...draft.audience,
                        spend_max_usd: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              </div>
            </div>
          )}

          {draft.audience.scope === 'specific' && (
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
                  patch({
                    audience: { ...draft.audience, user_ids: ids },
                  })
                }}
              />
              <p className='text-muted-foreground text-xs'>
                {t('{{count}} users selected', {
                  count: draft.audience.user_ids.length,
                })}
              </p>
            </div>
          )}
        </fieldset>

        <fieldset className='space-y-4 border-t pt-6'>
          <legend className='text-sm font-semibold'>
            {t('Reward amount')}
          </legend>

          <div className='space-y-2'>
            <Label htmlFor='reward-mode'>{t('Calculation')}</Label>
            <NativeSelect
              id='reward-mode'
              value={draft.reward_mode}
              onChange={(event) =>
                patch({ reward_mode: event.target.value as RewardMode })
              }
            >
              <NativeSelectOption value='fixed'>
                {t('Fixed amount per user')}
              </NativeSelectOption>
              <NativeSelectOption value='percentage'>
                {t('Percentage of spend')}
              </NativeSelectOption>
            </NativeSelect>
          </div>

          {draft.reward_mode === 'fixed' ? (
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
          ) : (
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

        <fieldset className='space-y-4 border-t pt-6'>
          <legend className='text-sm font-semibold'>
            {t('Ticket content')}
          </legend>

          <div className='space-y-2'>
            <Label htmlFor='reward-style'>{t('Style')}</Label>
            <NativeSelect
              id='reward-style'
              value={draft.style}
              onChange={(event) =>
                patch({ style: event.target.value as RewardStyle })
              }
            >
              {REWARD_STYLES.map((style) => (
                <NativeSelectOption key={style} value={style}>
                  {t(STYLE_LABEL_KEYS[style])}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='reward-title'>{t('Ticket title')}</Label>
            <Input
              id='reward-title'
              value={draft.copy.title}
              maxLength={60}
              onChange={(event) => patchCopy({ title: event.target.value })}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='reward-subtitle'>{t('Ticket subtitle')}</Label>
            <Input
              id='reward-subtitle'
              value={draft.copy.subtitle}
              maxLength={200}
              onChange={(event) => patchCopy({ subtitle: event.target.value })}
            />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='reward-label'>{t('Top label')}</Label>
              <Input
                id='reward-label'
                value={draft.copy.label}
                maxLength={30}
                onChange={(event) => patchCopy({ label: event.target.value })}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='reward-stub'>{t('Stub text')}</Label>
              <Input
                id='reward-stub'
                value={draft.copy.stub_text}
                maxLength={12}
                onChange={(event) =>
                  patchCopy({ stub_text: event.target.value })
                }
              />
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='reward-footer'>{t('Footer text')}</Label>
            <Input
              id='reward-footer'
              value={draft.copy.footer}
              maxLength={160}
              onChange={(event) => patchCopy({ footer: event.target.value })}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='reward-button'>{t('Claim button text')}</Label>
            <Input
              id='reward-button'
              value={draft.copy.button_text}
              maxLength={20}
              onChange={(event) =>
                patchCopy({ button_text: event.target.value })
              }
            />
          </div>
        </fieldset>

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
        <p className='text-muted-foreground text-xs'>
          {draft.reward_mode === 'fixed'
            ? t('{{amount}} per user', { amount: formatQuota(previewAmount) })
            : t('{{percent}}% of spend, capped at {{amount}}', {
                percent: draft.percent,
                amount: formatQuota(draft.cap_quota),
              })}
        </p>
      </aside>
    </div>
  )
}
