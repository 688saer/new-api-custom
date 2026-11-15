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

import type { WheelDrawGrant } from '../../types'
import {
  DRAW_GRANT_LIMIT,
  createEmptyDrawGrantDraft,
  toDrawGrantDraft,
  validateDrawGrantDraft,
} from '../draw-grants'

const grant: WheelDrawGrant = {
  user_id: 7,
  username: 'alice',
  permanent_draws: 3,
  daily_free_draws: 2,
  free_today: 3,
  free_used_today: 1,
  free_left_today: 2,
  created_at: 1700000000,
  updated_at: 1700000100,
}

describe('validateDrawGrantDraft', () => {
  it('accepts granting only permanent draws, only daily free draws, or both', () => {
    expect(
      validateDrawGrantDraft({ permanentDraws: 5, dailyFreeDraws: 0 })
    ).toBeNull()
    expect(
      validateDrawGrantDraft({ permanentDraws: 0, dailyFreeDraws: 2 })
    ).toBeNull()
    expect(
      validateDrawGrantDraft({ permanentDraws: 4, dailyFreeDraws: 3 })
    ).toBeNull()
  })

  it('accepts both counts at zero so the grant can be revoked', () => {
    expect(validateDrawGrantDraft(createEmptyDrawGrantDraft())).toBeNull()
  })

  it('rejects negative counts', () => {
    expect(
      validateDrawGrantDraft({ permanentDraws: -1, dailyFreeDraws: 0 })
    ).toBe('Permanent draw attempts must be a whole number of 0 or more')
    expect(
      validateDrawGrantDraft({ permanentDraws: 0, dailyFreeDraws: -2 })
    ).toBe('Daily free draw attempts must be a whole number of 0 or more')
  })

  it('rejects fractional counts', () => {
    expect(
      validateDrawGrantDraft({ permanentDraws: 1.5, dailyFreeDraws: 0 })
    ).toBe('Permanent draw attempts must be a whole number of 0 or more')
  })

  it('rejects counts above the backend limit', () => {
    expect(
      validateDrawGrantDraft({
        permanentDraws: DRAW_GRANT_LIMIT + 1,
        dailyFreeDraws: 0,
      })
    ).toBe('Draw attempts exceed the allowed maximum')
  })
})

describe('toDrawGrantDraft', () => {
  it('prefills the form with the current grant values', () => {
    expect(toDrawGrantDraft(grant)).toEqual({
      permanentDraws: 3,
      dailyFreeDraws: 2,
    })
  })
})
