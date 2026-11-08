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

import { formatQuota, formatQuotaFixed } from '../format'

// The default currency config in tests is USD with 500000 quota per unit.
describe('formatQuotaFixed', () => {
  test('keeps exactly two decimals for money amounts', () => {
    expect(formatQuotaFixed(0)).toBe('$0.00')
    expect(formatQuotaFixed(500000)).toBe('$1.00')
    expect(formatQuotaFixed(250000)).toBe('$0.50')
    expect(formatQuotaFixed(1500000)).toBe('$3.00')
  })

  test('rounds sub-cent amounts to two decimals', () => {
    expect(formatQuotaFixed(500)).toBe('$0.00')
    expect(formatQuotaFixed(3000)).toBe('$0.01')
  })

  test('keeps the regular quota format available for non-money contexts', () => {
    expect(formatQuota(500000)).toBe('$1')
    expect(formatQuota(1500000)).toBe('$3')
  })
})
