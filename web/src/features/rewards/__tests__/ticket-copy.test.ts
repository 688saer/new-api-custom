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
  clampStubFontSize,
  getRewardClaimState,
  getRewardStatusVariant,
  isRewardClaimable,
  REWARD_MODE_LABEL_KEYS,
  resolveTicketCopy,
  splitStubText,
  toRewardGrantStatus,
  toRewardMode,
} from '../lib/rewards'
import type { RewardTicketCopy } from '../types'

const COPY: RewardTicketCopy = {
  label: 'New API',
  title: 'Thanks',
  subtitle: 'Every build deserves support.',
  footer: 'Usable for model calls',
  stub_text: '专属奖励',
  stub_font_size: 28,
  button_text: 'Claim',
}

describe('reward ticket helpers', () => {
  it('falls back to pending for an unknown status', () => {
    expect(toRewardGrantStatus('pending')).toBe('pending')
    expect(toRewardGrantStatus('refunded')).toBe('pending')
  })

  it('keeps every known reward mode and falls back to fixed for unknown ones', () => {
    expect(toRewardMode('random')).toBe('random')
    expect(toRewardMode('percentage')).toBe('percentage')
    expect(toRewardMode('fixed')).toBe('fixed')
    expect(toRewardMode('tiered')).toBe('fixed')
  })

  it('labels the random mode distinctly from fixed and percentage', () => {
    const labels = Object.values(REWARD_MODE_LABEL_KEYS)
    expect(new Set(labels).size).toBe(labels.length)
    expect(REWARD_MODE_LABEL_KEYS.random).toBe('Random amount per user')
  })

  it('maps each status to a distinct badge variant', () => {
    expect(getRewardStatusVariant('pending')).toBe('default')
    expect(getRewardStatusVariant('claimed')).toBe('secondary')
    expect(getRewardStatusVariant('cancelled')).toBe('outline')
    expect(getRewardStatusVariant('expired')).toBe('outline')
  })

  it('clamps the stub font size into the supported 14-56px range', () => {
    expect(clampStubFontSize(8)).toBe(14)
    expect(clampStubFontSize(28)).toBe(28)
    expect(clampStubFontSize(120)).toBe(56)
    expect(clampStubFontSize(undefined)).toBe(28)
  })

  it('keeps stored copy and fills only the missing stub size', () => {
    const resolved = resolveTicketCopy({
      ...COPY,
      stub_font_size: Number.NaN,
    })

    expect(resolved.title).toBe('Thanks')
    expect(resolved.stub_font_size).toBe(28)
  })

  it('splits the stub text per character and drops whitespace', () => {
    expect(splitStubText('专属 奖励')).toEqual(['专', '属', '奖', '励'])
    expect(splitStubText('')).toEqual([])
  })

  it('treats a pending reward with no deadline as claimable', () => {
    expect(isRewardClaimable('pending', 0, 1_000_000)).toBe(true)
  })

  it('rejects a pending reward whose deadline already passed', () => {
    // 1_700_000_000s is in the past relative to the reference instant.
    expect(isRewardClaimable('pending', 1_700_000_000, 1_800_000_000_000)).toBe(
      false
    )
    expect(isRewardClaimable('pending', 1_800_000_000, 1_700_000_000_000)).toBe(
      true
    )
  })

  it('rejects a non-pending reward even without a deadline', () => {
    expect(isRewardClaimable('claimed', 0)).toBe(false)
    expect(isRewardClaimable('cancelled', 0)).toBe(false)
    expect(isRewardClaimable('expired', 0)).toBe(false)
  })

  it('reports a pending reward as scheduled until its claim start time', () => {
    const now = 1_800_000_000_000
    expect(getRewardClaimState('pending', 1_800_000_600, 0, now)).toBe(
      'scheduled'
    )
    expect(getRewardClaimState('pending', 1_800_000_000, 0, now)).toBe(
      'claimable'
    )
    expect(getRewardClaimState('pending', 0, 0, now)).toBe('claimable')
  })

  it('keeps the deadline ahead of the claim state once the window closes', () => {
    const now = 1_800_000_000_000
    expect(getRewardClaimState('pending', 0, 1_799_999_000, now)).toBe(
      'expired'
    )
    expect(getRewardClaimState('claimed', 0, 0, now)).toBe('unavailable')
  })
})
