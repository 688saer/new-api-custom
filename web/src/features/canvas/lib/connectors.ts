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
import type { CanvasNode } from '../types'

/** Rendered size of a node, measured in board units rather than screen pixels. */
export interface NodeSize {
  width: number
  height: number
}

/** One track line joining a node to the node it was derived from. */
export interface CanvasConnector {
  /** Stable identity, so React can keep the path between renders. */
  id: string
  parentId: string
  childId: string
  /** `d` attribute of the curve, in board units. */
  d: string
  x1: number
  y1: number
  x2: number
  y2: number
  /** True when the child is the node the operator currently has selected. */
  active: boolean
}

/** Shortest bend the curve is allowed to take, so close nodes stay readable. */
const MIN_BEND = 40

/** Keep the path string tidy: sub-pixel noise only bloats the DOM. */
function round(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Curve from a parent's edge to a child's edge. The pair is joined vertically
 * when the child sits above or below, and horizontally when it sits beside, so
 * the line always leaves the closest facing edges.
 */
function curveBetween(
  parent: { x: number; y: number } & NodeSize,
  child: { x: number; y: number } & NodeSize
): { d: string; x1: number; y1: number; x2: number; y2: number } {
  const parentCenterX = parent.x + parent.width / 2
  const parentCenterY = parent.y + parent.height / 2
  const childCenterX = child.x + child.width / 2
  const childCenterY = child.y + child.height / 2

  const sideways =
    Math.abs(childCenterX - parentCenterX) > Math.abs(childCenterY - parentCenterY)

  if (sideways) {
    const toRight = childCenterX >= parentCenterX
    const x1 = toRight ? parent.x + parent.width : parent.x
    const x2 = toRight ? child.x : child.x + child.width
    const y1 = parentCenterY
    const y2 = childCenterY
    const bend = Math.max(MIN_BEND, Math.abs(x2 - x1) / 2)
    const sign = toRight ? 1 : -1
    return {
      x1: round(x1),
      y1: round(y1),
      x2: round(x2),
      y2: round(y2),
      d: `M ${round(x1)} ${round(y1)} C ${round(x1 + sign * bend)} ${round(y1)}, ${round(x2 - sign * bend)} ${round(y2)}, ${round(x2)} ${round(y2)}`,
    }
  }

  const below = childCenterY >= parentCenterY
  const y1 = below ? parent.y + parent.height : parent.y
  const y2 = below ? child.y : child.y + child.height
  const x1 = parentCenterX
  const x2 = childCenterX
  const bend = Math.max(MIN_BEND, Math.abs(y2 - y1) / 2)
  const sign = below ? 1 : -1
  return {
    x1: round(x1),
    y1: round(y1),
    x2: round(x2),
    y2: round(y2),
    d: `M ${round(x1)} ${round(y1)} C ${round(x1)} ${round(y1 + sign * bend)}, ${round(x2)} ${round(y2 - sign * bend)}, ${round(x2)} ${round(y2)}`,
  }
}

/**
 * Every track line the board should draw. A line needs both endpoints measured,
 * so nodes that have not painted yet (and children whose parent was deleted)
 * are skipped instead of collapsing to the origin.
 */
export function buildConnectors(
  nodes: CanvasNode[],
  sizes: Record<string, NodeSize>,
  selectedIds: string[]
): CanvasConnector[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const connectors: CanvasConnector[] = []

  for (const child of nodes) {
    if (!child.parentId) continue
    const parent = byId.get(child.parentId)
    if (!parent) continue
    const parentSize = sizes[parent.id]
    const childSize = sizes[child.id]
    if (!parentSize || !childSize) continue

    connectors.push({
      id: `${parent.id}->${child.id}`,
      parentId: parent.id,
      childId: child.id,
      active: selectedIds.includes(child.id) || selectedIds.includes(parent.id),
      ...curveBetween({ ...parent, ...parentSize }, { ...child, ...childSize }),
    })
  }

  return connectors
}
