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
import { cn } from '@/lib/utils'

import type { CanvasConnector } from '../lib/connectors'

/** Radius of the dots that pin a track line to its two nodes. */
const ENDPOINT_RADIUS = 3

interface CanvasConnectorLayerProps {
  connectors: CanvasConnector[]
}

/**
 * Track lines tying each picture to the one it came from, painted under the
 * nodes. It sits inside the zoomed container, so the paths are expressed in
 * board units and scale with the camera for free.
 */
export function CanvasConnectorLayer(props: CanvasConnectorLayerProps) {
  if (props.connectors.length === 0) return null

  return (
    <svg
      className='pointer-events-none absolute top-0 left-0'
      width={1}
      height={1}
      style={{ overflow: 'visible' }}
      aria-hidden='true'
    >
      {props.connectors.map((connector) => (
        <g
          key={connector.id}
          className={cn(
            connector.active ? 'text-primary' : 'text-primary/35'
          )}
        >
          <path
            d={connector.d}
            fill='none'
            stroke='currentColor'
            strokeWidth={2}
            strokeLinecap='round'
            strokeDasharray='7 5'
          />
          <circle
            cx={connector.x1}
            cy={connector.y1}
            r={ENDPOINT_RADIUS}
            fill='currentColor'
          />
          <circle
            cx={connector.x2}
            cy={connector.y2}
            r={ENDPOINT_RADIUS}
            fill='currentColor'
          />
        </g>
      ))}
    </svg>
  )
}
