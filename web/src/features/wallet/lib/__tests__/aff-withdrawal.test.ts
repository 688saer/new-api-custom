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

import { estimateAffWithdrawal, formatCNY } from '../aff-withdrawal'

describe('estimateAffWithdrawal', () => {
  test('deducts the fee in integer quota units and converts the payout to CNY', () => {
    // 1000 quota, 10% fee: fee 100, payout 900.
    // 900 / 500000 * 7 = 0.0126 -> 0.01
    const estimate = estimateAffWithdrawal(1000, 10, 500000, 7)
    expect(estimate.feeQuota).toBe(100)
    expect(estimate.payoutQuota).toBe(900)
    expect(estimate.payoutCNY).toBe(0.01)
  })

  test('rounds the fee down and clamps the percent to 100', () => {
    const estimate = estimateAffWithdrawal(105, 7, 1000, 1)
    // floor(105 * 7 / 100) = 7
    expect(estimate.feeQuota).toBe(7)
    expect(estimate.payoutQuota).toBe(98)

    const capped = estimateAffWithdrawal(100, 150, 1000, 1)
    expect(capped.feeQuota).toBe(100)
    expect(capped.payoutQuota).toBe(0)
    expect(capped.payoutCNY).toBe(0)
  })

  test('treats non-positive quota and invalid rates safely', () => {
    const estimate = estimateAffWithdrawal(-5, 10, 0, 7)
    expect(estimate.feeQuota).toBe(0)
    expect(estimate.payoutQuota).toBe(0)
    expect(estimate.payoutCNY).toBe(0)
  })
})

describe('formatCNY', () => {
  test('formats with the fixed yen symbol and two decimals', () => {
    expect(formatCNY(1)).toBe('¥1.00')
    expect(formatCNY(0.01)).toBe('¥0.01')
    expect(formatCNY(Number.NaN)).toBe('-')
  })
})
