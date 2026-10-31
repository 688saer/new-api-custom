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

import { PAYMENT_TYPES } from '../constants'
import type { TopupInfo } from '../types'
import {
  dispatchSelectedPayment,
  getMinTopupAmount,
  isAlipayOfficialPayment,
  isStripePayment,
  isWaffoPayment,
  isWaffoPancakePayment,
} from './payment'

describe('payment type classification', () => {
  test('keeps Waffo and Waffo Pancake on their dedicated flows', () => {
    expect(isWaffoPayment(PAYMENT_TYPES.WAFFO)).toBe(true)
    expect(isWaffoPayment(PAYMENT_TYPES.WAFFO_PANCAKE)).toBe(false)
    expect(isWaffoPancakePayment(PAYMENT_TYPES.WAFFO_PANCAKE)).toBe(true)
    expect(isWaffoPancakePayment(PAYMENT_TYPES.WAFFO)).toBe(false)
    expect(isStripePayment(PAYMENT_TYPES.STRIPE)).toBe(true)
  })
})

describe('payment dispatch', () => {
  test('keeps the selected Waffo method index through confirmation', async () => {
    const calls: string[] = []
    const success = await dispatchSelectedPayment(
      { name: 'Waffo Card', type: PAYMENT_TYPES.WAFFO },
      120,
      3,
      {
        regular: async () => {
          calls.push('regular')
          return false
        },
        alipay: async () => false,
        waffo: async (amount, index) => {
          calls.push(`waffo:${amount}:${index}`)
          return true
        },
        waffoPancake: async () => {
          calls.push('pancake')
          return false
        },
      }
    )

    expect(success).toBe(true)
    expect(calls).toEqual(['waffo:120:3'])
  })

  test('does not create a Waffo order without a selected method index', async () => {
    let called = false
    const success = await dispatchSelectedPayment(
      { name: 'Waffo Card', type: PAYMENT_TYPES.WAFFO },
      120,
      null,
      {
        regular: async () => false,
        alipay: async () => false,
        waffo: async () => {
          called = true
          return true
        },
        waffoPancake: async () => false,
      }
    )

    expect(success).toBe(false)
    expect(called).toBe(false)
  })
})
describe('official Alipay channel', () => {
  test('routes the official Alipay method to its own processor', async () => {
    const calls: string[] = []
    const success = await dispatchSelectedPayment(
      { name: '支付宝', type: PAYMENT_TYPES.ALIPAY_OFFICIAL },
      50,
      null,
      {
        regular: async () => {
          calls.push('regular')
          return false
        },
        alipay: async (amount) => {
          calls.push(`alipay:${amount}`)
          return true
        },
        waffo: async () => false,
        waffoPancake: async () => false,
      }
    )

    expect(success).toBe(true)
    expect(calls).toEqual(['alipay:50'])
  })

  test('keeps the aggregator alipay method off the official flow', () => {
    // 易支付也会挂一个叫 alipay 的渠道，两者是不同的支付路径。
    expect(isAlipayOfficialPayment(PAYMENT_TYPES.ALIPAY)).toBe(false)
    expect(isAlipayOfficialPayment(PAYMENT_TYPES.ALIPAY_OFFICIAL)).toBe(true)
  })

  test('uses the official channel minimum when only that channel is enabled', () => {
    const topupInfo = {
      enable_online_topup: false,
      enable_stripe_topup: false,
      enable_alipay_topup: true,
      alipay_min_topup: 30,
      pay_methods: [],
      min_topup: 1,
      stripe_min_topup: 1,
      amount_options: [],
      discount: {},
    } satisfies TopupInfo

    expect(getMinTopupAmount(topupInfo)).toBe(30)
  })
})
