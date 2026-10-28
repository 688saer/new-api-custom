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
import type { CSSProperties } from 'react'

import type { BoardRect, SnapGuide } from '../lib/selection'

interface CanvasSnapGuidesProps {
  guides: SnapGuide[]
}

/**
 * Alignment lines shown while a node is dragged. They live inside the scaled
 * board layer so their coordinates are board units, and use a non-scaling
 * stroke so they stay hairline thin at any zoom.
 */
export function CanvasSnapGuides(props: CanvasSnapGuidesProps) {
  if (props.guides.length === 0) return null

  return (
    <svg
      className='pointer-events-none absolute overflow-visible'
      style={{ left: 0, top: 0, width: 1, height: 1 }}
      aria-hidden='true'
    >
      {props.guides.map((guide) => {
        const isVertical = guide.axis === 'x'
        return (
          <line
            key={`${guide.axis}-${guide.position}-${guide.from}`}
            x1={isVertical ? guide.position : guide.from}
            y1={isVertical ? guide.from : guide.position}
            x2={isVertical ? guide.position : guide.to}
            y2={isVertical ? guide.to : guide.position}
            stroke='var(--primary)'
            strokeWidth={1}
            strokeDasharray='4 3'
            vectorEffect='non-scaling-stroke'
          />
        )
      })}
    </svg>
  )
}

interface CanvasMarqueeProps {
  rect: BoardRect
  viewport: { x: number; y: number; zoom: number }
}

/** The selection band, drawn in screen space so its border stays one pixel. */
export function CanvasMarquee(props: CanvasMarqueeProps) {
  const style: CSSProperties = {
    left: props.rect.x * props.viewport.zoom + props.viewport.x,
    top: props.rect.y * props.viewport.zoom + props.viewport.y,
    width: props.rect.width * props.viewport.zoom,
    height: props.rect.height * props.viewport.zoom,
  }

  return (
    <div
      className='border-primary/70 bg-primary/10 pointer-events-none absolute rounded-sm border'
      style={style}
      aria-hidden='true'
    />
  )
}
