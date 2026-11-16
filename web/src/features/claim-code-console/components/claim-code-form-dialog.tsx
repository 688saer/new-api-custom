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

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatQuota } from '@/lib/format'

import {
  CLAIM_CODE_BATCH_LIMIT,
  CLAIM_CODE_STATUS_DISABLED,
  CLAIM_CODE_STATUS_ENABLED,
  CLAIM_CODE_VALUE_LENGTH_LIMIT,
  CLAIM_TYPE_OPTIONS,
  createEmptyClaimCodeDraft,
  fromExpiredTimeInput,
  toClaimCodeDraft,
  toExpiredTimeInput,
  validateClaimCodeDraft,
} from '../lib/claim-codes'
import type { ClaimCodeDraft, ClaimCodeRow } from '../types'

interface PlanOption {
  id: number
  title: string
}

interface ClaimCodeFormDialogProps {
  open: boolean
  /** 传入口令为编辑，null 为新建。 */
  code: ClaimCodeRow | null
  plans: PlanOption[]
  groups: string[]
  submitting: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: ClaimCodeDraft) => void
}

/** 新建 / 编辑口令弹窗。 */
export function ClaimCodeFormDialog(props: ClaimCodeFormDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.code ? t('Edit claim code') : t('New claim code')}
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
    >
      <ClaimCodeForm
        key={props.code ? `edit-${props.code.id}` : 'create'}
        code={props.code}
        plans={props.plans}
        groups={props.groups}
        submitting={props.submitting}
        error={props.error}
        onSubmit={props.onSubmit}
      />
    </Dialog>
  )
}

function ClaimCodeForm(
  props: Omit<ClaimCodeFormDialogProps, 'open' | 'onOpenChange'>
) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<ClaimCodeDraft>(() =>
    props.code ? toClaimCodeDraft(props.code) : createEmptyClaimCodeDraft()
  )
  const [expiredInput, setExpiredInput] = useState(() =>
    toExpiredTimeInput(props.code?.expired_time ?? 0)
  )
  const [localError, setLocalError] = useState<string | null>(null)

  const patch = (values: Partial<ClaimCodeDraft>) => {
    setDraft((prev) => ({ ...prev, ...values }))
  }

  const typeHint = CLAIM_TYPE_OPTIONS.find(
    (option) => option.value === draft.type
  )?.hintKey

  // 已有领取记录的口令不能再改口令值，否则用户手上的口令会失效
  const claimedLocked = (props.code?.used_count ?? 0) > 0
  let claimCodeValueHintKey: string | null = null
  if (claimedLocked) {
    claimCodeValueHintKey = 'A claimed code cannot change its value'
  }
  const customCode = draft.code.trim() !== ''

  let submitLabel = t('Create claim code')
  if (props.code) {
    submitLabel = t('Save changes')
  }
  if (props.submitting) {
    submitLabel = t('Saving…')
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload: ClaimCodeDraft = {
      ...draft,
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      group_limit: draft.group_limit.trim(),
      expired_time: fromExpiredTimeInput(expiredInput),
    }
    const key = validateClaimCodeDraft(payload)
    if (key != null) {
      setLocalError(t(key))
      return
    }
    setLocalError(null)
    props.onSubmit(payload)
  }

  const message = localError ?? props.error

  return (
    <form className='space-y-3' onSubmit={handleSubmit}>
      <div className='grid gap-1.5'>
        <Label htmlFor='claim-code-name' required>
          {t('Claim code name')}
        </Label>
        <Input
          id='claim-code-name'
          value={draft.name}
          maxLength={64}
          placeholder={t('For example: New year gift')}
          onChange={(event) => patch({ name: event.target.value })}
        />
      </div>

      <div className='grid gap-1.5'>
        <Label htmlFor='claim-code-type' required>
          {t('Prize type')}
        </Label>
        <NativeSelect
          id='claim-code-type'
          value={draft.type}
          onChange={(event) =>
            patch({ type: event.target.value as ClaimCodeDraft['type'] })
          }
        >
          {CLAIM_TYPE_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {t(option.labelKey)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {typeHint != null ? (
        <p className='text-muted-foreground -mt-1 text-xs'>{t(typeHint)}</p>
      ) : null}

      <div className='grid gap-1.5'>
        <Label htmlFor='claim-code-value'>{t('Claim code value')}</Label>
        <Input
          id='claim-code-value'
          value={draft.code}
          maxLength={CLAIM_CODE_VALUE_LENGTH_LIMIT}
          disabled={claimedLocked}
          placeholder={t(
            'Leave empty to generate a random code, or type your own'
          )}
          onChange={(event) => patch({ code: event.target.value })}
        />
        <p className='text-muted-foreground text-xs'>
          {t(claimCodeValueHintKey ?? 'Any text works, including Chinese.')}
        </p>
      </div>

      {draft.type === 'quota' ? (
        <div className='grid gap-1.5'>
          <Label htmlFor='claim-code-quota' required>
            {t('Amount in quota units')}
          </Label>
          <Input
            id='claim-code-quota'
            type='number'
            min={1}
            step={1}
            value={draft.quota}
            onChange={(event) =>
              patch({ quota: Number(event.target.value) || 0 })
            }
          />
          <p className='text-muted-foreground text-xs'>
            ≈ {formatQuota(draft.quota)}
          </p>
        </div>
      ) : null}

      {draft.type === 'subscription' ? (
        <div className='grid gap-1.5'>
          <Label htmlFor='claim-code-plan' required>
            {t('Subscription plan')}
          </Label>
          <NativeSelect
            id='claim-code-plan'
            value={String(draft.plan_id)}
            onChange={(event) =>
              patch({ plan_id: Number(event.target.value) || 0 })
            }
          >
            <NativeSelectOption value='0'>
              {t('Select a plan')}
            </NativeSelectOption>
            {props.plans.map((plan) => (
              <NativeSelectOption key={plan.id} value={String(plan.id)}>
                {plan.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {props.code == null ? (
        <div className='grid gap-1.5'>
          <Label htmlFor='claim-code-count'>
            {t('How many codes to generate')}
          </Label>
          <Input
            id='claim-code-count'
            type='number'
            min={1}
            max={CLAIM_CODE_BATCH_LIMIT}
            step={1}
            disabled={customCode}
            value={customCode ? 1 : draft.count}
            onChange={(event) =>
              patch({ count: Number(event.target.value) || 0 })
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t(
              'Set 1 for a single-use code, or generate up to 200 independent codes at once.'
            )}
          </p>
        </div>
      ) : null}

      <div className='grid grid-cols-2 gap-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor='claim-code-total'>{t('Total claims')}</Label>
          <Input
            id='claim-code-total'
            type='number'
            min={0}
            step={1}
            value={draft.total_count}
            onChange={(event) =>
              patch({ total_count: Number(event.target.value) || 0 })
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t('0 means unlimited claims')}
          </p>
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='claim-code-per-user'>{t('Limit per user')}</Label>
          <Input
            id='claim-code-per-user'
            type='number'
            min={0}
            step={1}
            value={draft.per_user_limit}
            onChange={(event) =>
              patch({ per_user_limit: Number(event.target.value) || 0 })
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t('0 means unlimited claims per user')}
          </p>
        </div>
      </div>

      <div className='grid gap-1.5'>
        <Label htmlFor='claim-code-expiry'>{t('Valid until')}</Label>
        <Input
          id='claim-code-expiry'
          type='datetime-local'
          value={expiredInput}
          onChange={(event) => setExpiredInput(event.target.value)}
        />
        <p className='text-muted-foreground text-xs'>
          {t('Leave empty for a code that never expires')}
        </p>
      </div>

      <div className='grid gap-1.5'>
        <Label htmlFor='claim-code-groups'>
          {t('Restrict to user groups')}
        </Label>
        <Input
          id='claim-code-groups'
          value={draft.group_limit}
          maxLength={255}
          placeholder={t('Leave empty to allow every group')}
          onChange={(event) => patch({ group_limit: event.target.value })}
        />
        {props.groups.length > 0 ? (
          <div className='flex flex-wrap gap-1.5'>
            {props.groups.map((group) => (
              <Button
                key={group}
                type='button'
                variant='outline'
                size='sm'
                onClick={() => patch({ group_limit: group })}
              >
                {group}
              </Button>
            ))}
          </div>
        ) : null}
        <p className='text-muted-foreground text-xs'>
          {t('Separate multiple groups with commas')}
        </p>
      </div>

      <div className='grid gap-1.5'>
        <Label htmlFor='claim-code-description'>{t('Description')}</Label>
        <Textarea
          id='claim-code-description'
          value={draft.description}
          maxLength={500}
          rows={2}
          placeholder={t('Shown to the user after redeeming')}
          onChange={(event) => patch({ description: event.target.value })}
        />
      </div>

      <div className='flex items-center justify-between rounded-lg border px-3 py-2'>
        <div>
          <p className='text-sm font-medium'>{t('Enabled')}</p>
          <p className='text-muted-foreground text-xs'>
            {t('Disabled codes cannot be redeemed')}
          </p>
        </div>
        <Switch
          checked={draft.status === CLAIM_CODE_STATUS_ENABLED}
          onCheckedChange={(checked) =>
            patch({
              status: checked
                ? CLAIM_CODE_STATUS_ENABLED
                : CLAIM_CODE_STATUS_DISABLED,
            })
          }
        />
      </div>

      {message != null && (
        <p role='alert' className='text-destructive text-sm'>
          {message}
        </p>
      )}

      <Button type='submit' className='w-full' disabled={props.submitting}>
        {submitLabel}
      </Button>
    </form>
  )
}
