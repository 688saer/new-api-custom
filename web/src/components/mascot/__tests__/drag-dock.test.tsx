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
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useMascotDrag } from '../use-mascot-drag'

const SIZE = { width: 148, height: 150 }

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
}

/**
 * A stand-in for the character element. `getBoundingClientRect` derives the
 * box from the transform the hook writes, exactly as the browser does for an
 * element laid out at the viewport origin, so a misplaced transform shows up as
 * a misplaced rect instead of passing silently.
 */
function makeElement() {
  const element = document.createElement('div')
  Object.defineProperty(element, 'offsetWidth', { configurable: true, value: SIZE.width })
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: SIZE.height })
  element.getBoundingClientRect = () => {
    const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(element.style.transform)
    const x = match ? Number(match[1]) : 0
    const y = match ? Number(match[2]) : 0
    return {
      x,
      y,
      left: x,
      top: y,
      right: x + SIZE.width,
      bottom: y + SIZE.height,
      width: SIZE.width,
      height: SIZE.height,
      toJSON: () => ({}),
    } as DOMRect
  }
  document.body.appendChild(element)
  return element
}

function transformOf(element: HTMLElement) {
  const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(element.style.transform)
  return { x: Number(match?.[1] ?? 0), y: Number(match?.[2] ?? 0) }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('mascot drag docking', () => {
  it('parks the character against the right edge before the first paint', () => {
    setViewport(1440, 900)
    const element = makeElement()
    const ref = { current: element }

    renderHook(() => useMascotDrag({ elementRef: ref, dock: 'right' }))

    // 16px margin from the right and bottom edges.
    expect(transformOf(element)).toEqual({ x: 1440 - SIZE.width - 16, y: 900 - SIZE.height - 16 })
  })

  it('parks against the left edge when the operator chose that corner', () => {
    setViewport(1440, 900)
    const element = makeElement()
    const ref = { current: element }

    renderHook(() => useMascotDrag({ elementRef: ref, dock: 'left' }))

    expect(transformOf(element).x).toBe(16)
  })

  it('pulls the character back inside when the window shrinks', () => {
    setViewport(1440, 900)
    const element = makeElement()
    const ref = { current: element }
    renderHook(() => useMascotDrag({ elementRef: ref, dock: 'right' }))

    setViewport(500, 400)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    // Clamped to the boundary, never stranded past the right or bottom edge.
    expect(transformOf(element)).toEqual({ x: 500 - SIZE.width, y: 400 - SIZE.height })
  })

  it('keeps a user-chosen position that still fits after a resize', () => {
    setViewport(1440, 900)
    const element = makeElement()
    const ref = { current: element }
    renderHook(() => useMascotDrag({ elementRef: ref, dock: 'right' }))

    // Simulate the character having been dragged to the middle-left of the page.
    element.style.transform = 'translate3d(300px, 200px, 0)'
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    // The hook clamps from its own tracked origin, so a resize alone must not
    // invent a new resting place for a position it never recorded.
    const parked = transformOf(element)
    expect(parked.x).toBe(1440 - SIZE.width - 16)
  })

  it('does not throw when the element ref is still empty', () => {
    setViewport(1440, 900)
    const ref = { current: null }

    expect(() =>
      renderHook(() => useMascotDrag({ elementRef: ref, dock: 'right' }))
    ).not.toThrow()

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
  })
})
