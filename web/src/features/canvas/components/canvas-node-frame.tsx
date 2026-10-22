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
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface CanvasNodeFrameProps {
  id: string
  x: number
  y: number
  width: number
  selected: boolean
  /** Current board scale, so a drag follows the pointer at any zoom level. */
  zoom: number
  onMove: (id: string, x: number, y: number) => void
  onSelect: (id: string) => void
  children: ReactNode
}

/**
 * Position, drag and selection shared by every node kind. Dragging is handled
 * here so both node types behave identically and no helper is duplicated.
 */
export function CanvasNodeFrame(props: CanvasNodeFrameProps) {
  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    // A node sits inside the pannable surface, so its own presses must not pan.
    event.stopPropagation()
    props.onSelect(props.id)

    const element = event.currentTarget
    const startX = event.clientX
    const startY = event.clientY
    const originX = props.x
    const originY = props.y
    element.setPointerCapture(event.pointerId)

    const handleDragMove = (moveEvent: PointerEvent) => {
      props.onMove(
        props.id,
        originX + (moveEvent.clientX - startX) / props.zoom,
        originY + (moveEvent.clientY - startY) / props.zoom
      )
    }

    const handleDragEnd = () => {
      element.removeEventListener('pointermove', handleDragMove)
      element.removeEventListener('pointerup', handleDragEnd)
      element.removeEventListener('pointercancel', handleDragEnd)
    }

    element.addEventListener('pointermove', handleDragMove)
    element.addEventListener('pointerup', handleDragEnd)
    element.addEventListener('pointercancel', handleDragEnd)
  }

  return (
    <div
      className={cn(
        'bg-card absolute overflow-hidden rounded-lg border shadow-sm',
        props.selected && 'ring-primary ring-2'
      )}
      style={{ left: props.x, top: props.y, width: props.width }}
      onPointerDown={handleDragStart}
    >
      {props.children}
    </div>
  )
}
