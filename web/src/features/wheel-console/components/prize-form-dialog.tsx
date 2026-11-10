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

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatQuota } from '@/lib/format'

import {
  PRIZE_COLOR_OPTIONS,
  PRIZE_TYPE_OPTIONS,
  createEmptyPrizeDraft,
  toPrizeDraft,
  validatePrizeDraft,
} from '../lib/prizes'
import type { WheelAdminPrize, WheelPrizeDraft } from '../types'

interface PlanOption {
  id: number
  title: string
}

interface PrizeFormDialogProps {
  open: boolean
  /** 传入奖品为编辑，null 为新建。 */
  prize: WheelAdminPrize | null
  plans: PlanOption[]
  nextSortOrder: number
  submitting: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (draft: WheelPrizeDraft) => void
}

/** 新建 / 编辑奖品弹窗。 */
export function PrizeFormDialog(props: PrizeFormDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={props.prize ? t('Edit prize') : t('New prize')}
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
    >
      <PrizeForm
        key={props.prize ? `edit-${props.prize.id}` : 'create'}
        prize={props.prize}
        plans={props.plans}
        nextSortOrder={props.nextSortOrder}
        submitting={props.submitting}
        error={props.error}
        onSubmit={props.onSubmit}
      />
    </Dialog>
  )
}

interface PrizeFormProps {
  prize: WheelAdminPrize | null
  plans: PlanOption[]
  nextSortOrder: number
  submitting: boolean
  error: string | null
  onSubmit: (draft: WheelPrizeDraft) => void
}

function PrizeForm(props: PrizeFormProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<WheelPrizeDraft>(() =>
    props.prize
      ? toPrizeDraft(props.prize)
      : createEmptyPrizeDraft(props.nextSortOrder)
  )
  const [localError, setLocalError] = useState<string | null>(null)

  const patch = (values: Partial<WheelPrizeDraft>) => {
    setDraft((prev) => ({ ...prev, ...values }))
  }

  const isCardKey = draft.type === 'card_key'
  const needsQuota = draft.type === 'quota' || draft.type === 'redemption_code'

  let submitLabel = t('Create prize')
  if (props.prize) {
    submitLabel = t('Save changes')
  }
  if (props.submitting) {
    submitLabel = t('Saving…')
  }

  useEffect(() => {
    // 卡密奖品的库存由卡密池维护，切换类型时避免提交非法库存
    if (isCardKey && draft.stock < 0) {
      patch({ stock: 0 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCardKey])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const key = validatePrizeDraft(draft)
    if (key != null) {
      setLocalError(t(key))
      return
    }
    setLocalError(null)
    props.onSubmit({
      ...draft,
      name: draft.name.trim(),
      icon: draft.icon.trim(),
      label: draft.label.trim(),
      description: draft.description.trim(),
      stock: isCardKey ? draft.stock : Math.trunc(draft.stock),
    })
  }

  const typeHint = PRIZE_TYPE_OPTIONS.find(
    (option) => option.value === draft.type
  )?.hintKey
  const message = localError ?? props.error

  return (
    <form className='space-y-3' onSubmit={handleSubmit}>
      <div className='grid grid-cols-[1fr_84px] gap-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor='wheel-prize-name' required>
            {t('Prize name')}
          </Label>
          <Input
            id='wheel-prize-name'
            value={draft.name}
            maxLength={64}
            placeholder={t('For example: 1 USD credit')}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='wheel-prize-icon'>{t('Icon')}</Label>
          <Input
            id='wheel-prize-icon'
            value={draft.icon}
            maxLength={8}
            placeholder='🎁'
            className='text-center'
            onChange={(event) => patch({ icon: event.target.value })}
          />
        </div>
      </div>

      <div className='grid grid-cols-2 gap-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor='wheel-prize-type' required>
            {t('Claim method')}
          </Label>
          <NativeSelect
            id='wheel-prize-type'
            value={draft.type}
            onChange={(event) =>
              patch({ type: event.target.value as WheelPrizeDraft['type'] })
            }
          >
            {PRIZE_TYPE_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {t(option.labelKey)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='wheel-prize-weight'>{t('Weight')}</Label>
          <Input
            id='wheel-prize-weight'
            type='number'
            min={0}
            step={1}
            value={draft.weight}
            onChange={(event) =>
              patch({ weight: Number(event.target.value) || 0 })
            }
          />
        </div>
      </div>
      {typeHint ? (
        <p className='text-muted-foreground -mt-1 text-xs'>{t(typeHint)}</p>
      ) : null}

      <div className='grid grid-cols-2 gap-3'>
        {needsQuota ? (
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-prize-quota' required>
              {t('Amount in quota units')}
            </Label>
            <Input
              id='wheel-prize-quota'
              type='number'
              min={1}
              step={1}
              value={draft.quota_value}
              onChange={(event) =>
                patch({ quota_value: Number(event.target.value) || 0 })
              }
            />
            <p className='text-muted-foreground text-xs'>
              ≈ {formatQuota(draft.quota_value)}
            </p>
          </div>
        ) : null}

        {draft.type === 'subscription' ? (
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-prize-plan' required>
              {t('Subscription plan')}
            </Label>
            <NativeSelect
              id='wheel-prize-plan'
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

        {isCardKey ? (
          <div className='grid gap-1.5'>
            <Label>{t('Stock')}</Label>
            <p className='text-muted-foreground flex h-9 items-center rounded-md border border-dashed px-3 text-xs'>
              {t('Maintained by the card key pool')}
            </p>
          </div>
        ) : (
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-prize-stock'>{t('Stock')}</Label>
            <Input
              id='wheel-prize-stock'
              type='number'
              min={-1}
              step={1}
              value={draft.stock}
              onChange={(event) =>
                patch({ stock: Number(event.target.value) || 0 })
              }
            />
            <p className='text-muted-foreground text-xs'>
              {t('-1 means unlimited')}
            </p>
          </div>
        )}
      </div>

      <div className='grid grid-cols-2 gap-3'>
        <div className='grid gap-1.5'>
          <Label htmlFor='wheel-prize-color'>{t('Segment color')}</Label>
          <NativeSelect
            id='wheel-prize-color'
            value={draft.color}
            onChange={(event) => patch({ color: event.target.value })}
          >
            {PRIZE_COLOR_OPTIONS.map((option) => (
              <NativeSelectOption key={option.value} value={option.value}>
                {t(option.labelKey)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='wheel-prize-sort'>{t('Sort order')}</Label>
          <Input
            id='wheel-prize-sort'
            type='number'
            step={1}
            value={draft.sort_order}
            onChange={(event) =>
              patch({ sort_order: Number(event.target.value) || 0 })
            }
          />
        </div>
      </div>

      <div className='grid gap-1.5'>
        <Label htmlFor='wheel-prize-label'>{t('Badge text')}</Label>
        <Input
          id='wheel-prize-label'
          value={draft.label}
          maxLength={16}
          placeholder={t('For example: Hot')}
          onChange={(event) => patch({ label: event.target.value })}
        />
      </div>

      <div className='grid gap-1.5'>
        <Label htmlFor='wheel-prize-description'>{t('Description')}</Label>
        <Textarea
          id='wheel-prize-description'
          value={draft.description}
          maxLength={255}
          rows={2}
          onChange={(event) => patch({ description: event.target.value })}
        />
      </div>

      <div className='flex items-center justify-between rounded-lg border px-3 py-2'>
        <div>
          <p className='text-sm font-medium'>{t('Enabled')}</p>
          <p className='text-muted-foreground text-xs'>
            {t('Disabled prizes stay on the wheel but never win')}
          </p>
        </div>
        <Switch
          checked={draft.enabled}
          onCheckedChange={(checked) => patch({ enabled: !!checked })}
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
