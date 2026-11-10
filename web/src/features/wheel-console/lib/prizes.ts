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
import type { WheelPrizeType } from '@/features/lucky-wheel'

import type { WheelAdminPrize, WheelPrizeDraft } from '../types'

interface PrizeTypeOption {
  value: WheelPrizeType
  /** 展示文案的 i18n 键。 */
  labelKey: string
  /** 领取流程说明的 i18n 键。 */
  hintKey: string
}

export const PRIZE_TYPE_OPTIONS: PrizeTypeOption[] = [
  {
    value: 'quota',
    labelKey: 'Account credit',
    hintKey: 'Credited to your balance right away',
  },
  {
    value: 'card_key',
    labelKey: 'Card key',
    hintKey: 'Preload card keys; the winner sees one right away',
  },
  {
    value: 'redemption_code',
    labelKey: 'Redemption code',
    hintKey: 'A one-time redemption code is generated for the winner',
  },
  {
    value: 'physical',
    labelKey: 'Physical prize',
    hintKey: 'The winner fills in the shipping address, then you ship it',
  },
  {
    value: 'subscription',
    labelKey: 'Subscription plan',
    hintKey: 'The selected plan is activated for the winner',
  },
  {
    value: 'none',
    labelKey: 'Thanks for playing',
    hintKey: 'No reward, only for filling the wheel',
  },
]

export const PRIZE_COLOR_OPTIONS = [
  { value: 'gold', labelKey: 'Gold' },
  { value: 'rose', labelKey: 'Rose' },
  { value: 'mint', labelKey: 'Mint' },
  { value: 'violet', labelKey: 'Violet' },
  { value: 'sky', labelKey: 'Sky' },
  { value: 'amber', labelKey: 'Amber' },
]

export const RECORD_STATUS_FILTERS = [
  { value: '', labelKey: 'All statuses' },
  { value: 'pending', labelKey: 'Waiting to claim' },
  { value: 'delivered', labelKey: 'Delivered' },
  { value: 'shipped', labelKey: 'Shipped' },
  { value: 'cancelled', labelKey: 'Cancelled' },
]

export function createEmptyPrizeDraft(sortOrder: number): WheelPrizeDraft {
  const tone = PRIZE_COLOR_OPTIONS[sortOrder % PRIZE_COLOR_OPTIONS.length]
  return {
    name: '',
    icon: '',
    type: 'quota',
    label: '',
    description: '',
    color: tone?.value ?? 'gold',
    weight: 10,
    stock: 100,
    quota_value: 500000,
    plan_id: 0,
    enabled: true,
    sort_order: sortOrder,
  }
}

export function toPrizeDraft(prize: WheelAdminPrize): WheelPrizeDraft {
  return {
    name: prize.name,
    icon: prize.icon,
    type: prize.type,
    label: prize.label,
    description: prize.description,
    color: prize.color,
    weight: prize.weight,
    stock: prize.stock,
    quota_value: prize.quota_value,
    plan_id: prize.plan_id,
    enabled: prize.enabled,
    sort_order: prize.sort_order,
  }
}

/** 校验奖品草稿，返回 i18n 键；通过时返回 null。 */
export function validatePrizeDraft(draft: WheelPrizeDraft): string | null {
  if (draft.name.trim() === '') return 'Prize name cannot be empty'
  if (draft.name.trim().length > 64) {
    return 'Prize name must be at most 64 characters'
  }
  if (draft.weight < 0) return 'Prize weight cannot be negative'
  if (
    (draft.type === 'quota' || draft.type === 'redemption_code') &&
    draft.quota_value <= 0
  ) {
    return 'Prize amount must be greater than zero'
  }
  if (draft.type === 'subscription' && draft.plan_id <= 0) {
    return 'Select a subscription plan for this prize'
  }
  if (draft.type !== 'card_key' && draft.stock < -1) {
    return 'Prize stock cannot be less than -1'
  }
  if (draft.type === 'card_key' && draft.stock < 0) {
    return 'Card key stock is maintained by the card key pool'
  }
  return null
}

/** 库存的展示文案键：-1 表示不限量。 */
export function stockLabel(stock: number): string {
  return stock < 0 ? 'Unlimited' : String(stock)
}
