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

import { resolvePublicAddress } from '../api-endpoints-card'

describe('resolvePublicAddress', () => {
  it('keeps a configured public address', () => {
    expect(
      resolvePublicAddress('https://api.example.com', 'https://console.example.com')
    ).toBe('https://api.example.com')
  })

  it('falls back to the page origin when the configured address is loopback', () => {
    expect(
      resolvePublicAddress('http://localhost:3000', 'https://console.example.com')
    ).toBe('https://console.example.com')
  })

  it('falls back for 127.0.0.1 and 0.0.0.0 as well', () => {
    expect(
      resolvePublicAddress('http://127.0.0.1:3000', 'https://console.example.com')
    ).toBe('https://console.example.com')
    expect(
      resolvePublicAddress('http://0.0.0.0:3000', 'https://console.example.com')
    ).toBe('https://console.example.com')
  })

  it('keeps a loopback address when the console itself runs on loopback', () => {
    expect(
      resolvePublicAddress('http://localhost:3000', 'http://localhost:3000')
    ).toBe('http://localhost:3000')
  })

  it('uses the page origin when nothing is configured', () => {
    expect(resolvePublicAddress('', 'https://console.example.com')).toBe(
      'https://console.example.com'
    )
  })
})
