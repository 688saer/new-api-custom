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
import { describe, expect, test } from 'vitest'

import type { WheelAdminPrize } from '../../types'
import {
  createEmptyPrizeDraft,
  stockLabel,
  toPrizeDraft,
  validatePrizeDraft,
} from '../prizes'

const prize: WheelAdminPrize = {
  id: 9,
  name: '1 USD credit',
  icon: '💰',
  type: 'quota',
  label: 'Hot',
  description: '',
  color: 'gold',
  weight: 10,
  stock: 5,
  issued_count: 2,
  quota_value: 500000,
  plan_id: 0,
  enabled: true,
  sort_order: 3,
  created_at: 1,
  updated_at: 2,
}

describe('createEmptyPrizeDraft', () => {
  test('默认开启并按序号轮换扇区颜色', () => {
    const first = createEmptyPrizeDraft(0)
    const second = createEmptyPrizeDraft(1)
    expect(first.enabled).toBe(true)
    expect(first.type).toBe('quota')
    expect(first.color).not.toBe(second.color)
  })
})

describe('toPrizeDraft', () => {
  test('只保留可提交字段', () => {
    const draft = toPrizeDraft(prize)
    expect(draft).not.toHaveProperty('id')
    expect(draft).not.toHaveProperty('issued_count')
    expect(draft.name).toBe(prize.name)
    expect(draft.sort_order).toBe(3)
  })
})

describe('validatePrizeDraft', () => {
  test('名称为空时报错', () => {
    expect(validatePrizeDraft({ ...prize, name: '   ' })).toBe(
      'Prize name cannot be empty'
    )
  })

  test('额度类奖品面额必须大于 0', () => {
    expect(validatePrizeDraft({ ...prize, quota_value: 0 })).toBe(
      'Prize amount must be greater than zero'
    )
    expect(
      validatePrizeDraft({ ...prize, type: 'redemption_code', quota_value: 0 })
    ).toBe('Prize amount must be greater than zero')
  })

  test('订阅奖品必须选择套餐', () => {
    expect(
      validatePrizeDraft({ ...prize, type: 'subscription', plan_id: 0 })
    ).toBe('Select a subscription plan for this prize')
    expect(
      validatePrizeDraft({ ...prize, type: 'subscription', plan_id: 7 })
    ).toBeNull()
  })

  test('卡密奖品库存由卡密池维护', () => {
    expect(validatePrizeDraft({ ...prize, type: 'card_key', stock: -1 })).toBe(
      'Card key stock is maintained by the card key pool'
    )
  })

  test('库存不能小于 -1', () => {
    expect(validatePrizeDraft({ ...prize, stock: -2 })).toBe(
      'Prize stock cannot be less than -1'
    )
    expect(validatePrizeDraft({ ...prize, stock: -1 })).toBeNull()
  })

  test('权重不能为负', () => {
    expect(validatePrizeDraft({ ...prize, weight: -1 })).toBe(
      'Prize weight cannot be negative'
    )
  })

  test('合法草稿通过校验', () => {
    expect(validatePrizeDraft(prize)).toBeNull()
  })
})

describe('stockLabel', () => {
  test('不限量库存显示为 Unlimited', () => {
    expect(stockLabel(-1)).toBe('Unlimited')
    expect(stockLabel(12)).toBe('12')
  })
})
