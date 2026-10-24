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

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

import {
  type Bounds,
  type DragSample,
  type FlightState,
  dockOffset,
  estimateReleaseVelocity,
  flightStep,
  landingSquash,
  springStep,
  squashScale,
  trimTrail,
  SQUASH_DURATION_MS,
} from './physics'

interface DragOptions {
  /** Element that moves; it is the drag surface too. */
  elementRef: React.RefObject<HTMLElement | null>
  /** Corner the character rests in until the user moves it. */
  dock?: 'left' | 'right'
  /** Called when a drag starts, so the character can switch to its dragged pose. */
  onDragStart?: () => void
  /** Called on release; `thrown` says whether it was a flick rather than a gentle put-down. */
  onDragEnd?: (thrown: boolean) => void
  /** Called on a click that was not a drag. */
  onClick?: () => void
  /** Minimum movement in px before a press counts as a drag. */
  threshold?: number
}

export interface DragHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void
}

/**
 * Drag, throw and squash for the mascot.
 *
 * A press is only promoted to a drag after a few pixels of movement, so tapping
 * still triggers the click response. Once dragging, the element follows the
 * pointer through the same over-damped spring the desktop pet uses; on release
 * the recent samples decide whether the character was thrown or put down.
 *
 * Position is written straight to the element's transform inside the animation
 * frame rather than through React state: at 60fps a state update per frame
 * would re-render the whole subtree for a purely visual change.
 */
export function useMascotDrag(options: DragOptions): DragHandlers {
  const threshold = options.threshold ?? 4

  const stateRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    active: false,
    moved: false,
    trail: [] as DragSample[],
    targetX: 0,
    targetY: 0,
    vx: 0,
    vy: 0,
    followFrame: 0,
    flightFrame: 0,
    squashFrame: 0,
    squashStart: 0,
    squashDepth: 0,
  })

  const callbacksRef = useRef(options)
  callbacksRef.current = options

  const stopFrames = useCallback(() => {
    const state = stateRef.current
    if (state.followFrame) cancelAnimationFrame(state.followFrame)
    if (state.flightFrame) cancelAnimationFrame(state.flightFrame)
    if (state.squashFrame) cancelAnimationFrame(state.squashFrame)
    state.followFrame = 0
    state.flightFrame = 0
    state.squashFrame = 0
  }, [])

  useEffect(() => stopFrames, [stopFrames])

  /** Play the squash curve on the element. */
  const squash = useCallback((depth: number) => {
    const element = callbacksRef.current.elementRef.current
    if (!element) return
    const state = stateRef.current
    if (state.squashFrame) cancelAnimationFrame(state.squashFrame)
    state.squashStart = performance.now()
    state.squashDepth = depth

    const tick = () => {
      const elapsed = performance.now() - state.squashStart
      const progress = Math.min(elapsed / SQUASH_DURATION_MS, 1)
      const scaleY = squashScale(progress, state.squashDepth)
      // Volume preservation: squashing vertically widens the character.
      const scaleX = 1 + (1 - scaleY) * 0.45
      element.style.setProperty('--mascot-squash-x', String(scaleX))
      element.style.setProperty('--mascot-squash-y', String(scaleY))
      if (progress < 1) {
        state.squashFrame = requestAnimationFrame(tick)
      } else {
        element.style.setProperty('--mascot-squash-x', '1')
        element.style.setProperty('--mascot-squash-y', '1')
        state.squashFrame = 0
      }
    }
    state.squashFrame = requestAnimationFrame(tick)
  }, [])

  const bounds = useCallback((): Bounds => {
    const element = callbacksRef.current.elementRef.current
    const width = element?.offsetWidth ?? 0
    const height = element?.offsetHeight ?? 0
    return {
      minX: 0,
      minY: 0,
      maxX: Math.max(0, window.innerWidth - width),
      maxY: Math.max(0, window.innerHeight - height),
    }
  }, [])

  // Park the character in its corner before the first paint, so it never flashes
  // at the viewport origin. Re-runs when the operator changes the placement.
  useLayoutEffect(() => {
    const element = callbacksRef.current.elementRef.current
    if (!element) return
    const state = stateRef.current
    const parked = dockOffset(
      options.dock ?? 'right',
      { width: element.offsetWidth, height: element.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight }
    )
    state.originX = parked.x
    state.originY = parked.y
    state.targetX = parked.x
    state.targetY = parked.y
    state.vx = 0
    state.vy = 0
    element.style.transform = `translate3d(${parked.x}px, ${parked.y}px, 0)`
  }, [options.dock])

  // A shrunken window must not strand the character off screen. Clamp rather
  // than re-dock, so a position the user chose is kept wherever it still fits.
  //
  // The character's own size also shrinks with the viewport (it is sized in vw),
  // so both the element and the window have to be re-measured here — a stored
  // width would compute the clamp against the size the character used to be.
  useEffect(() => {
    const keepVisible = () => {
      const element = callbacksRef.current.elementRef.current
      if (!element) return
      const state = stateRef.current
      const box = bounds()
      const x = Math.min(Math.max(state.originX, box.minX), box.maxX)
      const y = Math.min(Math.max(state.originY, box.minY), box.maxY)
      state.originX = x
      state.originY = y
      state.targetX = x
      state.targetY = y
      element.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }
    window.addEventListener('resize', keepVisible)
    window.addEventListener('orientationchange', keepVisible)
    // Mobile browsers resize the visual viewport without firing `resize` on the
    // window when the URL bar collapses, which would leave the character parked
    // behind browser chrome.
    window.visualViewport?.addEventListener('resize', keepVisible)
    // The character is sized in `vw`, so a layout change can shrink it without
    // any window event the code above would see. Watching the element itself
    // covers that case, and is the only signal that always fires.
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(keepVisible) : null
    if (observer) {
      const element = callbacksRef.current.elementRef.current
      if (element) observer.observe(element)
    }
    return () => {
      window.removeEventListener('resize', keepVisible)
      window.removeEventListener('orientationchange', keepVisible)
      window.visualViewport?.removeEventListener('resize', keepVisible)
      observer?.disconnect()
    }
  }, [bounds])

  const startFlight = useCallback(
    (velocity: { vx: number; vy: number }) => {
      const element = callbacksRef.current.elementRef.current
      if (!element) return
      const state = stateRef.current
      const box = bounds()
      let current: FlightState = {
        x: Math.min(Math.max(state.targetX, box.minX), box.maxX),
        y: Math.min(Math.max(state.targetY, box.minY), box.maxY),
        vx: velocity.vx,
        vy: velocity.vy,
      }
      let previous = performance.now()

      const tick = (now: number) => {
        const dt = (now - previous) / 1000
        previous = now
        const next = flightStep(current, dt, box)
        current = { x: next.x, y: next.y, vx: next.vx, vy: next.vy }
        element.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`
        if (next.bounced && Math.abs(current.vy) > 200) squash(landingSquash(Math.abs(current.vy)))
        if (next.atRest) {
          state.targetX = current.x
          state.targetY = current.y
          state.flightFrame = 0
          return
        }
        state.flightFrame = requestAnimationFrame(tick)
      }
      state.flightFrame = requestAnimationFrame(tick)
    },
    [bounds, squash]
  )

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // Only the primary button drags; right-click opens the browser menu.
      if (event.button !== 0) return
      const element = callbacksRef.current.elementRef.current
      if (!element) return

      stopFrames()
      const state = stateRef.current
      const rect = element.getBoundingClientRect()

      state.pointerId = event.pointerId
      state.startX = event.clientX
      state.startY = event.clientY
      // The element is laid out at the viewport origin and placed purely by its
      // transform, so the rendered position and the translate offset are the
      // same number. Reading it back here keeps a throw starting from wherever
      // the last one landed.
      state.originX = rect.left
      state.originY = rect.top
      state.targetX = rect.left
      state.targetY = rect.top
      state.vx = 0
      state.vy = 0
      state.trail = [{ t: performance.now(), x: event.clientX, y: event.clientY }]
      state.active = true
      state.moved = false

      if (typeof element.setPointerCapture === 'function') {
        element.setPointerCapture(event.pointerId)
      }
    },
    [stopFrames]
  )

  // Move/up listeners live on the window so a fast drag that leaves the element
  // still tracks the pointer.
  useEffect(() => {
    const state = stateRef.current

    const onPointerMove = (event: PointerEvent) => {
      if (!state.active || event.pointerId !== state.pointerId) return
      const element = callbacksRef.current.elementRef.current
      if (!element) return

      const dx = event.clientX - state.startX
      const dy = event.clientY - state.startY
      if (!state.moved && Math.hypot(dx, dy) < threshold) return

      if (!state.moved) {
        state.moved = true
        callbacksRef.current.onDragStart?.()
        // Start the spring from wherever the character is now.
        const box = bounds()
        state.targetX = Math.min(Math.max(state.originX + dx, box.minX), box.maxX)
        state.targetY = Math.min(Math.max(state.originY + dy, box.minY), box.maxY)
      }

      state.trail = trimTrail(
        [...state.trail, { t: performance.now(), x: event.clientX, y: event.clientY }],
        performance.now()
      )

      // Pointer delta from the press point, applied to the original position:
      // the character keeps its grab offset instead of snapping to the cursor.
      const box = bounds()
      state.targetX = Math.min(Math.max(state.originX + dx, box.minX), box.maxX)
      state.targetY = Math.min(Math.max(state.originY + dy, box.minY), box.maxY)

      if (!state.followFrame) {
        let previous = performance.now()
        const follow = (now: number) => {
          const dt = Math.min((now - previous) / 1000, 0.05)
          previous = now
          const el = callbacksRef.current.elementRef.current
          if (!el) {
            state.followFrame = 0
            return
          }
          // The spring is stiff, so a single step per frame is stable at 60fps.
          state.vx = springStep(state.vx, state.originX, state.targetX, dt)
          state.vy = springStep(state.vy, state.originY, state.targetY, dt)
          state.originX += state.vx * dt
          state.originY += state.vy * dt
          el.style.transform = `translate3d(${state.originX}px, ${state.originY}px, 0)`
          state.followFrame = state.active ? requestAnimationFrame(follow) : 0
        }
        state.followFrame = requestAnimationFrame(follow)
      }
    }

    const finish = (event: PointerEvent) => {
      if (!state.active || event.pointerId !== state.pointerId) return
      state.active = false
      const element = callbacksRef.current.elementRef.current
      // Pointer capture is a browser API; guard it so environments without it
      // (older engines, test DOMs) still release cleanly.
      if (
        element &&
        typeof element.hasPointerCapture === 'function' &&
        element.hasPointerCapture(event.pointerId)
      ) {
        element.releasePointerCapture(event.pointerId)
      }
      if (state.followFrame) {
        cancelAnimationFrame(state.followFrame)
        state.followFrame = 0
      }

      if (!state.moved) {
        callbacksRef.current.onClick?.()
        return
      }

      const velocity = estimateReleaseVelocity(state.trail, performance.now())
      callbacksRef.current.onDragEnd?.(velocity !== null)
      if (velocity) {
        startFlight(velocity)
      } else {
        // Gentle put-down: keep the position the spring settled on.
        state.targetX = state.originX
        state.targetY = state.originY
        squash(0.35)
      }
    }

    const onPointerUp = (event: PointerEvent) => finish(event)
    const onPointerCancel = (event: PointerEvent) => finish(event)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [bounds, squash, startFlight, threshold])

  return { onPointerDown }
}
