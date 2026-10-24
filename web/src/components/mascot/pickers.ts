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

import type { MascotCatalog, MascotCategory, RollKind } from './catalog'

/**
 * Random clip selection.
 *
 * Every function takes the RNG as a parameter instead of calling `Math.random`
 * directly, so the tests can pin exact outcomes and the behaviour stays
 * reproducible when debugging.
 */

export type Random = () => number

/** Pick one entry uniformly, preferring anything other than `exclude`. */
export function pickOne<T>(pool: readonly T[], exclude?: T, random: Random = Math.random): T {
  const filtered = exclude === undefined ? pool : pool.filter((item) => item !== exclude)
  // A single-entry pool plus an exclusion empties the list; repeating is better
  // than returning nothing.
  const source = filtered.length > 0 ? filtered : pool
  return source[Math.floor(random() * source.length)]
}

/**
 * Choose which kind of clip comes next.
 *
 * `idle`, `turn` and `move` take a fixed slice of the probability space; the
 * rest goes to `action`, which is a random clip from the weighted categories.
 * When the character is pinned, the two branches that would move or flip it
 * are dropped and their share falls through to `action` — no renormalisation,
 * so `idle` keeps exactly the probability the operator configured.
 */
export function rollKind(
  roll: number,
  catalog: MascotCatalog,
  pinned = false
): RollKind {
  const turn = pinned ? 0 : catalog.weights.turn
  const move = pinned ? 0 : catalog.weights.move
  const idle = catalog.weights.idle
  if (roll < idle / 100) return 'idle'
  if (roll < (idle + turn) / 100) return 'turn'
  if (roll < (idle + turn + move) / 100) return 'move'
  return 'action'
}

/** Pick a category by weight, skipping mirrored-text categories when flipped. */
export function pickCategory(
  categories: readonly MascotCategory[],
  facingRight: boolean,
  random: Random = Math.random
): MascotCategory | null {
  const usable = categories.filter((category) => category.actions.length > 0)
  if (usable.length === 0) return null
  const eligible = usable.filter((category) => !(category.noMirror && facingRight))
  const pool = eligible.length > 0 ? eligible : usable
  const total = pool.reduce((sum, category) => sum + category.weight, 0) || 1
  let cursor = random() * total
  for (const category of pool) {
    cursor -= category.weight
    if (cursor <= 0) return category
  }
  return pool[pool.length - 1]
}

/**
 * Pick the next clip for the idle chain.
 *
 * Returns the clip name plus whether it should play once (everything except the
 * idle loop does) and whether it flips the facing direction when it ends.
 */
export interface ChainStep {
  name: string
  once: boolean
  flips: boolean
  kind: RollKind
}

export function nextChainStep(
  catalog: MascotCatalog,
  options: {
    facingRight: boolean
    current?: string
    pinned?: boolean
    random?: Random
  }
): ChainStep {
  const random = options.random ?? Math.random
  const kind = rollKind(random(), catalog, options.pinned === true)

  if (kind === 'idle') {
    return {
      name: pickOne(catalog.idle, options.current, random),
      once: false,
      flips: false,
      kind,
    }
  }
  if (kind === 'turn') {
    return {
      name: pickOne(catalog.turn, options.current, random),
      once: true,
      flips: true,
      kind,
    }
  }
  if (kind === 'move') {
    return {
      name: pickOne(catalog.moves, options.current, random),
      once: true,
      flips: false,
      kind,
    }
  }

  const category = pickCategory(catalog.categories, options.facingRight, random)
  if (!category) {
    return {
      name: pickOne(catalog.idle, options.current, random),
      once: false,
      flips: false,
      kind: 'idle',
    }
  }
  return {
    name: pickOne(category.actions, options.current, random),
    once: true,
    flips: false,
    kind,
  }
}
