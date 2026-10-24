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

import { MASCOT_CATALOG, allClipNames } from '../catalog'
import { MASCOT_CLIP_FILES } from '../clip-files'
import { nextChainStep, pickCategory, pickOne, rollKind } from '../pickers'

describe('mascot pickers', () => {
  it('pickOne avoids the excluded entry when another exists', () => {
    const picked = pickOne(['a', 'b', 'c'], 'a', () => 0)
    expect(picked).toBe('b')
  })

  it('pickOne repeats rather than returning nothing for a single-entry pool', () => {
    expect(pickOne(['only'], 'only', () => 0.9)).toBe('only')
  })

  it('rollKind maps the configured weights onto the four branches', () => {
    // Weights are idle 10 / turn 5 / move 5, so the boundaries sit at
    // 0.10, 0.15 and 0.20.
    expect(rollKind(0.05, MASCOT_CATALOG)).toBe('idle')
    expect(rollKind(0.12, MASCOT_CATALOG)).toBe('turn')
    expect(rollKind(0.17, MASCOT_CATALOG)).toBe('move')
    expect(rollKind(0.5, MASCOT_CATALOG)).toBe('action')
  })

  it('rollKind drops turn and move when the character is pinned', () => {
    // A pinned character still keeps the idle share; the rest becomes actions.
    expect(rollKind(0.05, MASCOT_CATALOG, true)).toBe('idle')
    expect(rollKind(0.12, MASCOT_CATALOG, true)).toBe('action')
    expect(rollKind(0.17, MASCOT_CATALOG, true)).toBe('action')
  })

  it('pickCategory skips mirrored-text categories while facing right', () => {
    // The text category sits last; with the RNG near 1 it is the natural pick,
    // so an empty result for it proves the filter ran.
    const facingRight = pickCategory(MASCOT_CATALOG.categories, true, () => 0.999)
    expect(facingRight?.id).not.toBe('文字')

    const facingLeft = pickCategory(MASCOT_CATALOG.categories, false, () => 0.999)
    expect(facingLeft?.id).toBe('文字')
  })

  it('nextChainStep returns a play-once step for actions and a looping one for idle', () => {
    const idle = nextChainStep(MASCOT_CATALOG, { facingRight: false, random: () => 0 })
    expect(idle.kind).toBe('idle')
    expect(idle.once).toBe(false)

    const action = nextChainStep(MASCOT_CATALOG, { facingRight: false, random: () => 0.9 })
    expect(action.kind).toBe('action')
    expect(action.once).toBe(true)
  })

  it('nextChainStep marks the turn clip as flipping the facing direction', () => {
    const step = nextChainStep(MASCOT_CATALOG, { facingRight: false, random: () => 0.12 })
    expect(step.kind).toBe('turn')
    expect(step.flips).toBe(true)
  })
})

describe('mascot clip files', () => {
  it('resolves every clip the catalogue references', () => {
    const missing = allClipNames().filter((name) => !(name in MASCOT_CLIP_FILES))
    expect(missing).toEqual([])
  })

  it('uses ASCII slugs so no layer has to encode a non-ASCII path', () => {
    const nonAscii = Object.values(MASCOT_CLIP_FILES).filter((slug) => !/^[\w-]+$/.test(slug))
    expect(nonAscii).toEqual([])
  })

  it('gives every clip a distinct file', () => {
    const slugs = Object.values(MASCOT_CLIP_FILES)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
