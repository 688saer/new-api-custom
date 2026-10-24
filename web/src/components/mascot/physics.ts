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

/**
 * Drag and throw physics for the mascot.
 *
 * Adapted from the MIT-licensed `dsh-pet` project (see `public/mascot/CREDITS.md`)
 * so the character feels the same as the desktop pet: an over-damped spring
 * while dragged, a parabolic flight with edge bounce and ground friction after
 * release, and a squash on landing.
 *
 * Kept free of React and DOM so the behaviour is unit tested directly.
 */

/** Spring stiffness while following the pointer. Higher follows tighter. */
export const SPRING_K = 200
/** Spring damping. ζ = c/(2√k) ≈ 1.06 — over-damped, never overshoots. */
export const SPRING_C = 30
/** How much drag history feeds the release velocity estimate. */
export const TRAIL_KEEP_MS = 200
/** Window used to estimate the release velocity. */
export const RELEASE_WINDOW_MS = 150
/** A pause longer than this before release means "put it down gently". */
export const RELEASE_STALE_MS = 150
/** Shorter windows cannot give a reliable velocity. */
export const MIN_SPAN_MS = 20
/** Minimum segment duration; high-polling mice report 1ms deltas that read as spikes. */
export const SEG_MIN_DT_MS = 8
/** Below this speed the character is simply put down, not thrown. */
export const DEAD_ZONE_SPEED = 500
/** Soft ceiling on throw speed, so a hard flick still stays on screen. */
export const MAX_THROW_SPEED = 3600
/** Blend of mean and peak speed; pure mean under-reads fast flicks. */
export const PEAK_WEIGHT = 0.5
/** Acceleration at which the flick bonus is fully applied. */
export const ACCEL_REF = 8000
/** Cap on that bonus. */
export const ACCEL_GAIN_MAX = 0.6
/** Downward acceleration during flight. */
export const GRAVITY = 1400
/** Fraction of speed kept on each bounce. */
export const RESTITUTION = 0.78
/** Horizontal friction per second while on the ground. */
export const GROUND_FRICTION = 2.5
/** Vertical speed below which landing stops the vertical motion. */
export const REST_VY = 40
/** Horizontal speed below which the character counts as stopped. */
export const REST_VX = 15
/** Largest integration step, so a stalled tab cannot launch the character. */
export const MAX_STEP_DT = 0.05
/** Squash depth when pressed. */
export const SQUASH_DEPTH = 0.55
/** Squash animation length. */
export const SQUASH_DURATION_MS = 220
/** Impact speed mapped to the minimum squash. */
export const SQUASH_SOFT_SPEED = 300
/** Impact speed mapped to the maximum squash. */
export const SQUASH_HARD_SPEED = 1500

export interface PhysicsParams {
  gravity: number
  restitution: number
  groundFriction: number
}

export const DEFAULT_PHYSICS: PhysicsParams = {
  gravity: GRAVITY,
  restitution: RESTITUTION,
  groundFriction: GROUND_FRICTION,
}

/** One pointer sample: `t` is a `performance.now()` timestamp, `x`/`y` are viewport coordinates. */
export interface DragSample {
  t: number
  x: number
  y: number
}

/** Box the character may occupy, in viewport pixels. */
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface FlightState {
  x: number
  y: number
  vx: number
  vy: number
}

/** Gap between the character and the viewport edge when it is docked. */
const DOCK_MARGIN = 16

/**
 * Where the character rests before the user moves it.
 *
 * The character is laid out at the viewport origin and moved only by its
 * transform, so this offset and a dragged position live in the same coordinate
 * space and can be swapped without conversion.
 */
export function dockOffset(
  dock: 'left' | 'right',
  size: { width: number; height: number },
  viewport: { width: number; height: number }
): { x: number; y: number } {
  const x = dock === 'left' ? DOCK_MARGIN : viewport.width - size.width - DOCK_MARGIN
  const y = viewport.height - size.height - DOCK_MARGIN
  return { x: Math.max(0, x), y: Math.max(0, y) }
}

/** Drop samples older than the retention window. */
export function trimTrail(trail: DragSample[], now: number): DragSample[] {
  const cutoff = now - TRAIL_KEEP_MS
  let index = 0
  while (index < trail.length && trail[index].t < cutoff) index++
  return index === 0 ? trail : trail.slice(index)
}

/** One axis step of the over-damped drag spring. The caller adds `v * dt` to the position. */
export function springStep(v: number, x: number, target: number, dt: number): number {
  return v + ((target - x) * SPRING_K - v * SPRING_C) * dt
}

/** Monotonic soft clamp: approaches `MAX_THROW_SPEED` without ever exceeding it. */
export function softClampSpeed(speed: number): number {
  if (speed <= 0) return 0
  return MAX_THROW_SPEED * (1 - Math.exp(-speed / MAX_THROW_SPEED))
}

/**
 * Release velocity from the drag trail, in px/s.
 *
 * Direction comes from the first-to-last displacement in the window, which is
 * far steadier than the last two samples. Magnitude blends the mean and peak
 * segment speeds and adds a bonus while the pointer is still accelerating.
 *
 * Returns `null` when the character should just be put down: no samples, a
 * pause before release, too short a window, or a speed under the dead zone.
 */
export function estimateReleaseVelocity(
  trail: DragSample[],
  now: number
): { vx: number; vy: number } | null {
  if (trail.length === 0) return null
  const last = trail[trail.length - 1]
  if (now - last.t > RELEASE_STALE_MS) return null
  const window = trail.filter((sample) => now - sample.t <= RELEASE_WINDOW_MS)
  if (window.length < 2) return null

  const first = window[0]
  const end = window[window.length - 1]
  const spanMs = end.t - first.t
  if (spanMs < MIN_SPAN_MS) return null

  const baseVx = ((end.x - first.x) / spanMs) * 1000
  const baseVy = ((end.y - first.y) / spanMs) * 1000
  const baseSpeed = Math.hypot(baseVx, baseVy)
  // Pure jitter inside the window: no usable direction, so treat it as a drop.
  if (baseSpeed < 1e-6) return null

  const segments: { speed: number; tEnd: number }[] = []
  let prevX = first.x
  let prevY = first.y
  let prevT = first.t
  for (const sample of window.slice(1)) {
    const dt = sample.t - prevT
    if (dt < SEG_MIN_DT_MS) continue
    segments.push({
      speed: (Math.hypot(sample.x - prevX, sample.y - prevY) / dt) * 1000,
      tEnd: sample.t,
    })
    prevX = sample.x
    prevY = sample.y
    prevT = sample.t
  }

  const peakSpeed =
    segments.length > 0 ? Math.max(...segments.map((segment) => segment.speed)) : baseSpeed

  let accel = 0
  if (segments.length >= 2) {
    const lastSegment = segments[segments.length - 1]
    const firstSegment = segments[0]
    accel =
      (lastSegment.speed - firstSegment.speed) /
      Math.max((lastSegment.tEnd - firstSegment.tEnd) / 1000, MIN_SPAN_MS / 1000)
  }

  const beforeClamp =
    ((1 - PEAK_WEIGHT) * baseSpeed + PEAK_WEIGHT * peakSpeed) *
    (1 + Math.min(Math.max(accel, 0) / ACCEL_REF, 1) * ACCEL_GAIN_MAX)
  const speed = softClampSpeed(beforeClamp)
  if (speed < DEAD_ZONE_SPEED) return null

  return { vx: (baseVx / baseSpeed) * speed, vy: (baseVy / baseSpeed) * speed }
}

/**
 * Integrate one flight step with edge bounce and ground friction.
 *
 * `bounced` reports whether an edge was touched this step (used to trigger the
 * squash), `atRest` whether the character has settled and the loop can stop.
 */
export function flightStep(
  state: FlightState,
  dtRaw: number,
  bounds: Bounds,
  physics: PhysicsParams = DEFAULT_PHYSICS
): FlightState & { bounced: boolean; atRest: boolean } {
  const dt = Math.min(Math.max(dtRaw, 0), MAX_STEP_DT)
  let { x, y, vx, vy } = state
  vy += physics.gravity * dt
  x += vx * dt
  y += vy * dt

  let bounced = false
  if (x < bounds.minX) {
    x = bounds.minX
    vx = Math.abs(vx) * physics.restitution
    bounced = true
  } else if (x > bounds.maxX) {
    x = bounds.maxX
    vx = -Math.abs(vx) * physics.restitution
    bounced = true
  }

  if (y >= bounds.maxY) {
    y = bounds.maxY
    vx *= Math.max(0, 1 - physics.groundFriction * dt)
    if (Math.abs(vy) < REST_VY) vy = 0
    else vy = -Math.abs(vy) * physics.restitution
    bounced = true
  } else if (y < bounds.minY) {
    // The top edge is open: the character may fly above the viewport and fall
    // back, which looks better than bouncing off an invisible ceiling.
    y = bounds.minY
    vy = Math.abs(vy) * physics.restitution
    bounced = true
  }

  const speed = Math.hypot(vx, vy)
  const atRest =
    (y >= bounds.maxY - 1 && Math.abs(vy) < 1 && Math.abs(vx) < REST_VX) ||
    (bounced && speed < REST_VY && Math.abs(vy) < 1)

  return { x, y, vx, vy, bounced, atRest }
}

/**
 * Squash curve: progress in [0,1] to a vertical scale.
 *
 * Compresses during the first 45% and springs back with a small overshoot, so
 * the character reads as soft rather than rigid.
 */
export function squashScale(progress: number, depth: number = SQUASH_DEPTH): number {
  const u = Math.min(Math.max(progress, 0), 1)
  if (u < 0.45) {
    const t = u / 0.45
    return 1 - (1 - depth) * (t * t)
  }
  const t = (u - 0.45) / 0.55
  // easeOutBack: overshoots by ~4% then settles at 1.
  const c1 = 1.70158
  const c3 = c1 + 1
  const back = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  return depth + (1 - depth) * back
}

/** Map a landing impact speed to a squash depth, so a hard throw squashes more. */
export function landingSquash(impactSpeed: number): number {
  if (impactSpeed <= SQUASH_SOFT_SPEED) return SQUASH_DEPTH * 0.8
  if (impactSpeed >= SQUASH_HARD_SPEED) return SQUASH_DEPTH
  const t = (impactSpeed - SQUASH_SOFT_SPEED) / (SQUASH_HARD_SPEED - SQUASH_SOFT_SPEED)
  return SQUASH_DEPTH * (0.8 + 0.2 * t)
}
