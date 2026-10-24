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
  GREETING_PORTRAIT,
  MASCOT_PORTRAITS,
  MASCOT_PORTRAIT_BASE,
  portraitUrl,
  randomReactionPortrait,
} from '../portraits'

describe('mascot portraits', () => {
  it('gives every portrait a distinct id so no two share a file', () => {
    const ids = MASCOT_PORTRAITS.map((portrait) => portrait.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('uses ASCII ids so the URL needs no encoding', () => {
    const nonAscii = MASCOT_PORTRAITS.map((portrait) => portrait.id).filter(
      (id) => !/^[\w-]+$/.test(id)
    )
    expect(nonAscii).toEqual([])
  })

  it('builds the URL under the shared portraits directory', () => {
    expect(portraitUrl('hi')).toBe(`${MASCOT_PORTRAIT_BASE}/hi.png`)
    expect(portraitUrl('hi')).toBe('/mascot/portraits/hi.png')
  })

  it('never returns the greeting portrait as a click reaction', () => {
    // Sweeping the whole RNG range proves the greeting face is excluded, not
    // merely unlikely to appear.
    for (let step = 0; step < 50; step++) {
      const portrait = randomReactionPortrait(() => step / 50)
      expect(portrait.id).not.toBe(GREETING_PORTRAIT.id)
    }
  })

  it('reaches every reaction portrait across the RNG range', () => {
    const seen = new Set<string>()
    for (let step = 0; step < 50; step++) {
      seen.add(randomReactionPortrait(() => step / 50).id)
    }
    expect(seen.size).toBe(MASCOT_PORTRAITS.length - 1)
  })

  it('survives an RNG that returns exactly 1', () => {
    expect(() => randomReactionPortrait(() => 1)).not.toThrow()
  })
})
