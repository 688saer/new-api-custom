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
  DEAD_ZONE_SPEED,
  MAX_THROW_SPEED,
  type DragSample,
  dockOffset,
  estimateReleaseVelocity,
  flightStep,
  landingSquash,
  softClampSpeed,
  springStep,
  squashScale,
  trimTrail,
} from '../physics'

const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 700 }

describe('mascot drag physics', () => {
  it('trimTrail drops samples older than the retention window', () => {
    const trail: DragSample[] = [
      { t: 0, x: 0, y: 0 },
      { t: 900, x: 10, y: 10 },
      { t: 1000, x: 20, y: 20 },
    ]
    // The window is 200ms, so anything before t=800 goes.
    expect(trimTrail(trail, 1000).map((sample) => sample.t)).toEqual([900, 1000])
  })

  it('trimTrail leaves a fresh trail untouched', () => {
    const trail: DragSample[] = [{ t: 950, x: 0, y: 0 }]
    expect(trimTrail(trail, 1000)).toBe(trail)
  })

  it('springStep pulls toward the target and never overshoots from rest', () => {
    let v = 0
    let x = 0
    const target = 100
    for (let i = 0; i < 60; i++) {
      v = springStep(v, x, target, 1 / 60)
      x += v * (1 / 60)
      expect(x).toBeLessThanOrEqual(target + 0.001)
    }
    expect(x).toBeGreaterThan(target - 1)
  })

  it('softClampSpeed stays monotonic and below the ceiling', () => {
    expect(softClampSpeed(0)).toBe(0)
    const slow = softClampSpeed(1000)
    const fast = softClampSpeed(5000)
    expect(slow).toBeLessThan(fast)
    expect(fast).toBeLessThan(MAX_THROW_SPEED)
  })
})

describe('mascot release velocity', () => {
  it('returns null when the pointer paused before release', () => {
    const trail: DragSample[] = [{ t: 0, x: 0, y: 0 }]
    // 400ms of stillness is far past the stale window.
    expect(estimateReleaseVelocity(trail, 400)).toBeNull()
  })

  it('returns null for a trail with no movement', () => {
    const trail: DragSample[] = [
      { t: 900, x: 10, y: 10 },
      { t: 950, x: 10, y: 10 },
    ]
    expect(estimateReleaseVelocity(trail, 950)).toBeNull()
  })

  it('returns null when the flick is slower than the dead zone', () => {
    // 5px over 100ms is 50px/s, well under the 500px/s threshold.
    const trail: DragSample[] = [
      { t: 850, x: 0, y: 0 },
      { t: 950, x: 5, y: 0 },
    ]
    expect(estimateReleaseVelocity(trail, 950)).toBeNull()
  })

  it('returns a velocity pointing along the drag for a real flick', () => {
    const trail: DragSample[] = [
      { t: 800, x: 0, y: 0 },
      { t: 850, x: 200, y: 0 },
      { t: 900, x: 400, y: 0 },
      { t: 950, x: 600, y: 0 },
    ]
    const velocity = estimateReleaseVelocity(trail, 950)
    expect(velocity).not.toBeNull()
    expect(velocity?.vx).toBeGreaterThan(DEAD_ZONE_SPEED)
    expect(Math.abs(velocity?.vy ?? 1)).toBeLessThan(1)
  })
})

describe('mascot flight physics', () => {
  it('bounces off the right edge and reverses horizontal velocity', () => {
    const next = flightStep(
      { x: 995, y: 300, vx: 900, vy: 0 },
      0.02,
      bounds
    )
    expect(next.x).toBe(bounds.maxX)
    expect(next.vx).toBeLessThan(0)
    expect(next.bounced).toBe(true)
  })

  it('settles on the ground and reports atRest', () => {
    const next = flightStep({ x: 500, y: bounds.maxY, vx: 2, vy: 0 }, 0.016, bounds)
    expect(next.atRest).toBe(true)
  })

  it('keeps flying while still moving fast', () => {
    const next = flightStep({ x: 500, y: 100, vx: 0, vy: 0 }, 0.016, bounds)
    expect(next.atRest).toBe(false)
  })

  it('clamps an oversized step so a stalled tab cannot launch the character', () => {
    const huge = flightStep({ x: 500, y: 0, vx: 0, vy: 0 }, 10, bounds)
    const capped = flightStep({ x: 500, y: 0, vx: 0, vy: 0 }, 0.05, bounds)
    expect(huge.y).toBeCloseTo(capped.y, 5)
  })
})

describe('mascot dock position', () => {
  const size = { width: 148, height: 150 }
  const viewport = { width: 1440, height: 900 }

  it('parks in the requested corner with a margin from both edges', () => {
    const right = dockOffset('right', size, viewport)
    expect(right.x).toBe(1440 - 148 - 16)
    expect(right.y).toBe(900 - 150 - 16)

    const left = dockOffset('left', size, viewport)
    expect(left.x).toBe(16)
    expect(left.y).toBe(right.y)
  })

  it('matches the viewport-edge bounds the drag code clamps to', () => {
    // A docked character must sit exactly on the boundary it is clamped to,
    // otherwise the first drag would visibly snap it.
    const right = dockOffset('right', size, viewport)
    expect(right.x).toBeLessThanOrEqual(viewport.width - size.width)
    expect(right.y).toBeLessThanOrEqual(viewport.height - size.height)
  })

  it('never parks off screen on a viewport smaller than the character', () => {
    const tiny = { width: 80, height: 60 }
    const offset = dockOffset('right', { width: 148, height: 150 }, tiny)
    expect(offset.x).toBe(0)
    expect(offset.y).toBe(0)
  })
})

describe('mascot squash', () => {
  it('starts and ends at full height', () => {
    expect(squashScale(0)).toBeCloseTo(1, 5)
    expect(squashScale(1)).toBeCloseTo(1, 2)
  })

  it('compresses below full height in the middle of the curve', () => {
    expect(squashScale(0.45)).toBeLessThan(0.7)
  })

  it('squashes harder for a faster landing', () => {
    expect(landingSquash(2000)).toBeGreaterThan(landingSquash(400))
  })
})
