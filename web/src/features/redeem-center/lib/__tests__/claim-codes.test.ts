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

import {
  claimStatusLabelKey,
  claimTypeLabelKey,
  normalizeClaimCodeInput,
  validateClaimCodeInput,
} from '../claim-codes'

describe('normalizeClaimCodeInput', () => {
  it('trims surrounding whitespace and upper-cases the code', () => {
    expect(normalizeClaimCodeInput('  abcd-2345-wxyz  ')).toBe('ABCD-2345-WXYZ')
  })
})

describe('validateClaimCodeInput', () => {
  it('rejects an empty code', () => {
    expect(validateClaimCodeInput('   ')).toBe('Enter a claim code')
  })

  it('accepts a well formed code', () => {
    expect(validateClaimCodeInput('ABCD-2345-WXYZ')).toBeNull()
  })

  it('rejects codes longer than the backend limit', () => {
    expect(validateClaimCodeInput('A'.repeat(65))).toBe(
      'Claim code is too long'
    )
  })
})

describe('claim labels', () => {
  it('maps every claim type to a translation key', () => {
    expect(claimTypeLabelKey('quota')).toBe('Balance credit')
    expect(claimTypeLabelKey('subscription')).toBe('Subscription plan')
    expect(claimTypeLabelKey('card_key')).toBe('Virtual product')
    expect(claimTypeLabelKey('physical')).toBe('Physical prize')
  })

  it('maps every claim status to a translation key', () => {
    expect(claimStatusLabelKey('pending')).toBe('Waiting for shipping address')
    expect(claimStatusLabelKey('ready')).toBe('Waiting for shipment')
    expect(claimStatusLabelKey('shipped')).toBe('Shipped')
    expect(claimStatusLabelKey('out-of-range' as 'delivered')).toBe(
      'out-of-range'
    )
  })
})
