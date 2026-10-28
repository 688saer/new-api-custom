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
import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

import { cn } from '@/lib/utils'

interface CanvasNodeFrameProps {
  id: string
  x: number
  y: number
  width: number
  selected: boolean
  /**
   * Starts a drag. The board owns the gesture because a drag may move several
   * selected nodes at once, and only the board knows where they all sit.
   */
  onDragStart: (id: string, event: ReactPointerEvent<HTMLDivElement>) => void
  /** Reports the painted size, which track lines need to find their anchors. */
  onMeasure?: (id: string, width: number, height: number) => void
  children: ReactNode
}

/**
 * Position, drag and selection shared by every node kind. Dragging is handled
 * by the board so both node types behave identically and a group moves as one.
 */
export function CanvasNodeFrame(props: CanvasNodeFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const measure = props.onMeasure

  useEffect(() => {
    const element = frameRef.current
    if (!element || !measure) return

    // offsetWidth/offsetHeight ignore the board's CSS transform, so they hand
    // back board units rather than the zoomed on-screen size.
    const report = () =>
      measure(props.id, element.offsetWidth, element.offsetHeight)
    report()

    const observer = new ResizeObserver(report)
    observer.observe(element)
    return () => observer.disconnect()
  }, [props.id, measure])

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    // A node sits inside the pannable surface, so its own presses must not pan
    // or start a selection band.
    event.stopPropagation()
    props.onDragStart(props.id, event)
  }

  return (
    <div
      ref={frameRef}
      data-canvas-node={props.id}
      data-selected={props.selected ? 'true' : 'false'}
      className={cn(
        'bg-card group/node absolute overflow-hidden rounded-xl border shadow-sm transition-shadow',
        'hover:shadow-md',
        props.selected
          ? 'border-primary ring-primary/60 shadow-md ring-2'
          : 'border-border'
      )}
      style={{ left: props.x, top: props.y, width: props.width }}
      onPointerDown={handlePointerDown}
    >
      {props.children}
    </div>
  )
}
