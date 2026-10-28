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
import type { CanvasNode, CanvasViewport } from '../types'
import type { NodeSize } from './connectors'

/** A rectangle in board units, not screen pixels. */
export interface BoardRect {
  x: number
  y: number
  width: number
  height: number
}

/** Which coordinate a reference line holds constant. */
export type GuideAxis = 'x' | 'y'

/**
 * A line the drag lined up with, drawn while the pointer is down so the
 * operator can see why a node stopped where it did.
 */
export interface SnapGuide {
  axis: GuideAxis
  /** Board coordinate of the line: an x for a vertical line, a y for a horizontal one. */
  position: number
  /** Extent along the other axis, covering both the dragged node and its partner. */
  from: number
  to: number
}

export interface SnapResult {
  /** Top-left the dragged rectangle should take. */
  x: number
  y: number
  guides: SnapGuide[]
}

/** How close two edges must be, in board units, before they count as aligned. */
export const SNAP_THRESHOLD = 6

/** Grid step the board draws and, when snapping is on, rounds to. */
export const GRID_SIZE = 24

/** Smallest and largest board scale the camera allows. */
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 3

/** Room left around the content when the camera frames it. */
const FIT_PADDING = 56

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** Turn a drag between two corners into a positive rectangle. */
export function rectFromPoints(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): BoardRect {
  return {
    x: Math.min(fromX, toX),
    y: Math.min(fromY, toY),
    width: Math.abs(toX - fromX),
    height: Math.abs(toY - fromY),
  }
}

/** True when two rectangles share any area, edges touching included. */
export function rectsIntersect(a: BoardRect, b: BoardRect): boolean {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  )
}

/**
 * Nodes the marquee covers. A node counts once the band touches it, which is
 * what every canvas tool does and what makes a rough sweep across a row work.
 * Nodes that have not painted yet have no size, so they cannot be hit.
 */
export function nodesInRect(
  nodes: CanvasNode[],
  sizes: Record<string, NodeSize>,
  rect: BoardRect
): string[] {
  const hit: string[] = []
  for (const node of nodes) {
    const size = sizes[node.id]
    if (!size) continue
    const box = { x: node.x, y: node.y, width: size.width, height: size.height }
    if (rectsIntersect(box, rect)) hit.push(node.id)
  }
  return hit
}

interface EdgePair {
  /** Distance the dragged rect must move to line the edges up. */
  delta: number
  /** Coordinate of the line, used to draw the guide. */
  position: number
  /** Other rect's span along the perpendicular axis. */
  from: number
  to: number
}

/**
 * Closest alignment between one axis of the dragged rectangle and the same
 * axis of every other node. Like pairs with like — left with left, centre with
 * centre, right with right — so a row of pictures can be lined up on either
 * their tops or their middles, but an edge is never dragged onto a centre.
 */
function closestAlignment(
  moving: { start: number; size: number },
  others: { start: number; size: number; from: number; to: number }[],
  threshold: number
): EdgePair | null {
  let best: EdgePair | null = null
  for (const other of others) {
    for (let edge = 0; edge < 3; edge += 1) {
      const movingEdge = moving.start + (moving.size * edge) / 2
      const otherEdge = other.start + (other.size * edge) / 2
      const delta = otherEdge - movingEdge
      if (Math.abs(delta) > threshold) continue
      if (best && Math.abs(delta) >= Math.abs(best.delta)) continue
      best = {
        delta,
        position: otherEdge,
        from: other.from,
        to: other.to,
      }
    }
  }
  return best
}

interface SnapDragParams {
  /** The dragged rectangle at the position the pointer asks for. */
  moving: BoardRect
  /** Rectangles the drag may line up with; never the ones being dragged. */
  others: BoardRect[]
  /** Distance in board units within which an edge counts as aligned. */
  threshold?: number
  /** Grid step to fall back to when nothing aligns, or null to leave the axis free. */
  grid?: number | null
}

/**
 * Where a dragged rectangle should land: pulled onto a neighbour's edge or
 * centre when it is close, otherwise onto the grid when that is switched on.
 * Both axes are decided independently, so a node can align on x while snapping
 * to the grid on y.
 */
export function snapDrag(params: SnapDragParams): SnapResult {
  const threshold = params.threshold ?? SNAP_THRESHOLD
  const grid = params.grid ?? null

  const vertical = closestAlignment(
    { start: params.moving.x, size: params.moving.width },
    params.others.map((other) => ({
      start: other.x,
      size: other.width,
      from: other.y,
      to: other.y + other.height,
    })),
    threshold
  )
  const horizontal = closestAlignment(
    { start: params.moving.y, size: params.moving.height },
    params.others.map((other) => ({
      start: other.y,
      size: other.height,
      from: other.x,
      to: other.x + other.width,
    })),
    threshold
  )

  let x = params.moving.x
  let y = params.moving.y
  const guides: SnapGuide[] = []

  if (vertical) {
    x += vertical.delta
    guides.push({
      axis: 'x',
      position: vertical.position,
      from: Math.min(params.moving.y, vertical.from),
      to: Math.max(params.moving.y + params.moving.height, vertical.to),
    })
  } else if (grid) {
    x = Math.round(x / grid) * grid
  }

  if (horizontal) {
    y += horizontal.delta
    guides.push({
      axis: 'y',
      position: horizontal.position,
      from: Math.min(params.moving.x, horizontal.from),
      to: Math.max(params.moving.x + params.moving.width, horizontal.to),
    })
  } else if (grid) {
    y = Math.round(y / grid) * grid
  }

  return { x, y, guides }
}

/** Bounding box of every node that has painted, or null when none has. */
export function contentBounds(
  nodes: CanvasNode[],
  sizes: Record<string, NodeSize>
): BoardRect | null {
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  let found = false

  for (const node of nodes) {
    const size = sizes[node.id]
    if (!size) continue
    found = true
    left = Math.min(left, node.x)
    top = Math.min(top, node.y)
    right = Math.max(right, node.x + size.width)
    bottom = Math.max(bottom, node.y + size.height)
  }

  if (!found) return null
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * Camera that frames the whole board, with room to breathe around it. Returns
 * null when there is nothing to frame, so the caller can leave the camera be.
 */
export function fitViewport(
  bounds: BoardRect | null,
  view: { width: number; height: number }
): CanvasViewport | null {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null
  if (view.width <= 0 || view.height <= 0) return null

  const available = {
    width: Math.max(view.width - FIT_PADDING * 2, 1),
    height: Math.max(view.height - FIT_PADDING * 2, 1),
  }
  const zoom = clampZoom(
    Math.min(available.width / bounds.width, available.height / bounds.height)
  )

  return {
    zoom,
    x: (view.width - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (view.height - bounds.height * zoom) / 2 - bounds.y * zoom,
  }
}

/** Union of the rectangles of the given nodes, used to drag a group as one. */
export function unionBounds(
  nodes: CanvasNode[],
  sizes: Record<string, NodeSize>,
  ids: string[]
): BoardRect | null {
  const wanted = new Set(ids)
  return contentBounds(
    nodes.filter((node) => wanted.has(node.id)),
    sizes
  )
}

/**
 * Cascade a new node away from any node already parked on the same spot.
 * Everything is dropped mid-view, so without this a second note would hide the
 * first one exactly.
 */
export function stepIntoFreeSpot(
  nodes: CanvasNode[],
  spot: { x: number; y: number },
  step: number
): { x: number; y: number } {
  let x = spot.x
  let y = spot.y
  while (nodes.some((node) => node.x === x && node.y === y)) {
    x += step
    y += step
  }
  return { x, y }
}
