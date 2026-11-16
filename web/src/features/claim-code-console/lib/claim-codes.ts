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
import { formatTimestampForInput, parseTimestampFromInput } from '@/lib/format'

import type { ClaimCodeDraft, ClaimCodeRow, ClaimCodeType } from '../types'

export const CLAIM_CODE_BATCH_LIMIT = 200
export const CLAIM_CODE_COUNT_LIMIT = 1000000
export const CLAIM_CODE_PER_USER_LIMIT = 1000
export const CLAIM_CODE_VALUE_LENGTH_LIMIT = 64
export const CLAIM_CODE_STATUS_ENABLED = 1
export const CLAIM_CODE_STATUS_DISABLED = 2

export const CLAIM_CODE_TYPES: ClaimCodeType[] = [
  'quota',
  'subscription',
  'card_key',
  'physical',
]

/** 口令类型选项：labelKey 为下拉文案，hintKey 为类型说明。 */
export const CLAIM_TYPE_OPTIONS: {
  value: ClaimCodeType
  labelKey: string
  hintKey: string
}[] = [
  {
    value: 'quota',
    labelKey: 'Balance credit',
    hintKey: 'Redeeming adds the amount directly to the user balance.',
  },
  {
    value: 'subscription',
    labelKey: 'Subscription plan',
    hintKey: 'Redeeming activates the selected subscription plan for the user.',
  },
  {
    value: 'card_key',
    labelKey: 'Virtual product',
    hintKey: 'Redeeming issues one card key from the card key pool.',
  },
  {
    value: 'physical',
    labelKey: 'Physical prize',
    hintKey:
      'Redeeming collects a shipping address from the user; you ship it and record the tracking number.',
  },
]

export function createEmptyClaimCodeDraft(): ClaimCodeDraft {
  return {
    code: '',
    name: '',
    type: 'quota',
    quota: 0,
    plan_id: 0,
    description: '',
    total_count: 1,
    per_user_limit: 1,
    group_limit: '',
    expired_time: 0,
    status: CLAIM_CODE_STATUS_ENABLED,
    count: 1,
  }
}

export function toClaimCodeDraft(row: ClaimCodeRow): ClaimCodeDraft {
  return {
    code: row.code,
    name: row.name,
    type: row.type,
    quota: row.quota,
    plan_id: row.plan_id,
    description: row.description,
    total_count: row.total_count,
    per_user_limit: row.per_user_limit,
    group_limit: row.group_limit,
    expired_time: row.expired_time,
    status: row.status,
    count: 1,
  }
}

/** 校验口令草稿，返回 i18n 键；null 表示可以提交。 */
export function validateClaimCodeDraft(draft: ClaimCodeDraft): string | null {
  if (draft.name.trim() === '') {
    return 'Enter the claim code name'
  }
  if ([...draft.code.trim()].length > CLAIM_CODE_VALUE_LENGTH_LIMIT) {
    return 'Claim code value must be at most 64 characters'
  }
  if (draft.code.trim() !== '' && draft.count !== 1) {
    return 'A custom claim code can only be created once at a time'
  }
  if (draft.count < 1 || draft.count > CLAIM_CODE_BATCH_LIMIT) {
    return 'Generate between 1 and 200 claim codes at a time'
  }
  if (draft.total_count < 0 || draft.total_count > CLAIM_CODE_COUNT_LIMIT) {
    return 'Total claims must be between 0 and 1000000'
  }
  if (
    draft.per_user_limit < 0 ||
    draft.per_user_limit > CLAIM_CODE_PER_USER_LIMIT
  ) {
    return 'Per-user limit must be between 0 and 1000'
  }
  if (draft.type === 'quota' && draft.quota <= 0) {
    return 'Enter the balance amount of this claim code'
  }
  if (draft.type === 'subscription' && draft.plan_id <= 0) {
    return 'Select a subscription plan'
  }
  return null
}

export function claimCodeStatusLabelKey(status: number): string {
  return status === CLAIM_CODE_STATUS_DISABLED ? 'Disabled' : 'Enabled'
}

/** 有效期时间戳转 datetime-local 输入值。 */
export function toExpiredTimeInput(expiredTime: number): string {
  return expiredTime > 0 ? formatTimestampForInput(expiredTime) : ''
}

/** datetime-local 输入值转有效期时间戳，空值表示长期有效。 */
export function fromExpiredTimeInput(value: string): number {
  return value === '' ? 0 : parseTimestampFromInput(value)
}

/** 剩余可领次数的展示文案所需数据。 */
export function isClaimCodeExhausted(row: ClaimCodeRow): boolean {
  return row.remaining_count === 0
}
