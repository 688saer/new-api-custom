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
import { describe, expect, it } from 'vitest'

import type { ClaimCodeDraft, ClaimCodeRow } from '../../types'
import {
  claimCodeStatusLabelKey,
  createEmptyClaimCodeDraft,
  fromExpiredTimeInput,
  isClaimCodeExhausted,
  toClaimCodeDraft,
  toExpiredTimeInput,
  validateClaimCodeDraft,
} from '../claim-codes'

const baseRow: ClaimCodeRow = {
  id: 7,
  code: 'ABCD-2345-WXYZ',
  name: 'New year gift',
  type: 'subscription',
  status: 2,
  quota: 0,
  quota_display: '',
  plan_id: 3,
  plan_title: 'Pro monthly',
  description: 'For vip users',
  total_count: 0,
  used_count: 4,
  per_user_limit: 2,
  group_limit: 'vip,svip',
  expired_time: 1900000000,
  remaining_count: -1,
  available_cards: 0,
  claimed_users: 3,
  expired: false,
  created_at: 1800000000,
  updated_at: 1800000000,
}

function draftWith(patch: Partial<ClaimCodeDraft>): ClaimCodeDraft {
  return { ...createEmptyClaimCodeDraft(), ...patch }
}

describe('createEmptyClaimCodeDraft', () => {
  it('starts as an enabled single quota code', () => {
    const draft = createEmptyClaimCodeDraft()
    expect(draft.type).toBe('quota')
    expect(draft.status).toBe(1)
    expect(draft.count).toBe(1)
    expect(draft.total_count).toBe(1)
    expect(draft.per_user_limit).toBe(1)
  })
})

describe('toClaimCodeDraft', () => {
  it('copies every editable field of an existing code', () => {
    const draft = toClaimCodeDraft(baseRow)
    expect(draft.name).toBe('New year gift')
    expect(draft.type).toBe('subscription')
    expect(draft.plan_id).toBe(3)
    expect(draft.total_count).toBe(0)
    expect(draft.per_user_limit).toBe(2)
    expect(draft.group_limit).toBe('vip,svip')
    expect(draft.expired_time).toBe(1900000000)
    expect(draft.status).toBe(2)
    expect(draft.count).toBe(1)
  })
})

describe('validateClaimCodeDraft', () => {
  it('requires a name', () => {
    expect(validateClaimCodeDraft(draftWith({ quota: 500000 }))).toBe(
      'Enter the claim code name'
    )
  })

  it('requires a balance amount for quota codes', () => {
    expect(validateClaimCodeDraft(draftWith({ name: 'Gift' }))).toBe(
      'Enter the balance amount of this claim code'
    )
  })

  it('requires a plan for subscription codes', () => {
    expect(
      validateClaimCodeDraft(
        draftWith({ name: 'Gift', type: 'subscription', plan_id: 0 })
      )
    ).toBe('Select a subscription plan')
  })

  it('limits the batch size of generated codes', () => {
    expect(
      validateClaimCodeDraft(
        draftWith({ name: 'Gift', quota: 500000, count: 0 })
      )
    ).toBe('Generate between 1 and 200 claim codes at a time')
    expect(
      validateClaimCodeDraft(
        draftWith({ name: 'Gift', quota: 500000, count: 201 })
      )
    ).toBe('Generate between 1 and 200 claim codes at a time')
  })

  it('limits the total claim count and the per-user limit', () => {
    expect(
      validateClaimCodeDraft(
        draftWith({ name: 'Gift', quota: 500000, total_count: -1 })
      )
    ).toBe('Total claims must be between 0 and 1000000')
    expect(
      validateClaimCodeDraft(
        draftWith({ name: 'Gift', quota: 500000, per_user_limit: 1001 })
      )
    ).toBe('Per-user limit must be between 0 and 1000')
  })

  it('accepts a complete quota draft', () => {
    expect(
      validateClaimCodeDraft(draftWith({ name: 'Gift', quota: 500000 }))
    ).toBeNull()
  })
})

describe('custom claim code values', () => {
  it('starts with an empty value so the server generates the code', () => {
    expect(createEmptyClaimCodeDraft().code).toBe('')
  })

  it('copies the existing value and keeps it in a draft', () => {
    expect(toClaimCodeDraft({ ...baseRow, code: '新年礼物' }).code).toBe(
      '新年礼物'
    )
  })

  it('accepts a custom value on a single code', () => {
    expect(
      validateClaimCodeDraft(
        draftWith({ name: 'Gift', quota: 500000, code: '新年礼物' })
      )
    ).toBeNull()
  })

  it('rejects a custom value longer than 64 characters', () => {
    expect(
      validateClaimCodeDraft(
        draftWith({ name: 'Gift', quota: 500000, code: '令'.repeat(65) })
      )
    ).toBe('Claim code value must be at most 64 characters')
  })

  it('rejects a custom value when several codes are requested', () => {
    expect(
      validateClaimCodeDraft(
        draftWith({ name: 'Gift', quota: 500000, code: 'GIFT', count: 3 })
      )
    ).toBe('A custom claim code can only be created once at a time')
  })
})

describe('claim code helpers', () => {
  it('labels enabled and disabled codes', () => {
    expect(claimCodeStatusLabelKey(1)).toBe('Enabled')
    expect(claimCodeStatusLabelKey(2)).toBe('Disabled')
  })

  it('reports exhausted codes', () => {
    expect(isClaimCodeExhausted(baseRow)).toBe(false)
    expect(isClaimCodeExhausted({ ...baseRow, remaining_count: 0 })).toBe(true)
  })

  it('round-trips the expiry input', () => {
    // datetime-local 精确到分钟，取值对齐到分钟避免秒级截断
    const minuteAligned = 1900000020
    expect(toExpiredTimeInput(0)).toBe('')
    expect(fromExpiredTimeInput('')).toBe(0)
    expect(fromExpiredTimeInput(toExpiredTimeInput(minuteAligned))).toBe(
      minuteAligned
    )
  })
})
