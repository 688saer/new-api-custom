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

import type { AdminEnabledApiKey, AdminEnabledApiKeyUser } from '../../types'
import {
  formatKeyInfo,
  formatUserKeysInfo,
  isKeyUsable,
  maskedKeyText,
} from '../api-key-board'

const DAY = 86400
const NOW = 1_800_000_000

// The helpers translate their labels; these tests assert the shape and the
// values, so an identity-style translator keeps them language independent.
const t = ((key: string) => key) as unknown as Parameters<
  typeof formatKeyInfo
>[1]['t']

const liveKey: AdminEnabledApiKey = {
  id: 8101,
  name: 'alice-fast',
  masked_key: 'a**********aaaa',
  group: 'vip',
  remain_quota: 1_000_000,
  used_quota: 500_000,
  unlimited_quota: false,
  expired_time: -1,
  created_time: NOW - 3 * DAY,
  accessed_time: NOW - DAY,
  model_limits_enabled: true,
  model_limits: 'gpt-4o,claude-3',
}

describe('maskedKeyText', () => {
  it('prefixes the stored mask the way a key reads', () => {
    expect(maskedKeyText(liveKey)).toBe('sk-a**********aaaa')
  })
})

describe('isKeyUsable', () => {
  it('treats a funded, unexpired key as usable', () => {
    expect(isKeyUsable(liveKey, NOW)).toBe(true)
  })

  it('treats an expired key as unusable even with quota left', () => {
    expect(isKeyUsable({ ...liveKey, expired_time: NOW - 1 }, NOW)).toBe(false)
  })

  it('treats an exhausted key as unusable', () => {
    expect(
      isKeyUsable({ ...liveKey, remain_quota: 0, used_quota: 10 }, NOW)
    ).toBe(false)
  })

  it('keeps an unlimited key usable with no remaining quota', () => {
    expect(
      isKeyUsable({ ...liveKey, unlimited_quota: true, remain_quota: 0 }, NOW)
    ).toBe(true)
  })
})

describe('formatKeyInfo', () => {
  it('writes one labelled line per field, with the mask when no value is given', () => {
    const text = formatKeyInfo(liveKey, { t, nowSeconds: NOW })
    const lines = text.split('\n')

    expect(lines).toEqual([
      'Name: alice-fast',
      'Key: sk-a**********aaaa',
      'Status: Usable',
      'Group: vip',
      expect.stringMatching(/^Quota: .+ \/ .+$/),
      'Models: gpt-4o, claude-3',
      'Expires: Never expires',
      expect.stringMatching(/^Last Used: \d{4}-\d{2}-\d{2}T/),
    ])
  })

  it('carries the revealed key when the operator has disclosed it', () => {
    const text = formatKeyInfo(liveKey, {
      t,
      nowSeconds: NOW,
      keyValue: 'sk-abcdefghijklmnop',
    })
    expect(text).toContain('Key: sk-abcdefghijklmnop')
    // The mask must not survive next to the full value.
    expect(text).not.toContain('sk-a**********aaaa')
  })

  it('names the states instead of printing raw numbers', () => {
    const text = formatKeyInfo(
      {
        ...liveKey,
        unlimited_quota: true,
        remain_quota: 0,
        accessed_time: 0,
        model_limits_enabled: false,
        model_limits: '',
      },
      { t, nowSeconds: NOW }
    )
    expect(text).toContain('Quota: Unlimited')
    expect(text).toContain('Models: All models')
    expect(text).toContain('Last Used: Never used')
  })

  it('marks a key past its expiry as not usable', () => {
    const text = formatKeyInfo(
      { ...liveKey, expired_time: NOW - 1 },
      {
        t,
        nowSeconds: NOW,
      }
    )
    expect(text).toContain('Status: Not usable')
    expect(text).not.toContain('Expires: Never expires')
  })
})

describe('formatUserKeysInfo', () => {
  it('heads the block with the owner and reproduces every key', () => {
    const user: AdminEnabledApiKeyUser = {
      user_id: 801,
      username: 'alice',
      display_name: 'Alice',
      email: 'alice@example.com',
      user_group: 'vip',
      user_status: 1,
      key_count: 2,
      keys: [liveKey, { ...liveKey, id: 8102, name: 'alice-slow' }],
    }

    const text = formatUserKeysInfo(user, { t, nowSeconds: NOW })
    const lines = text.split('\n')

    expect(lines[0]).toBe('Alice (alice · #801)')
    expect(lines[1]).toBe('Enabled keys: 2')
    expect(text).toContain('Name: alice-fast')
    expect(text).toContain('Name: alice-slow')
    // A copy of the block never carries a usable secret.
    expect(text).not.toContain('sk-abcdefghijklmnop')
  })
})
