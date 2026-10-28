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

import type { NodeSize } from '../lib/connectors'
import {
  contentBounds,
  fitViewport,
  nodesInRect,
  rectFromPoints,
  rectsIntersect,
  snapDrag,
  stepIntoFreeSpot,
  unionBounds,
} from '../lib/selection'
import type { CanvasImageNode } from '../types'

function imageNode(
  overrides: Partial<CanvasImageNode> & { id: string; x: number; y: number }
): CanvasImageNode {
  return {
    kind: 'image',
    image: 'data:image/png;base64,AAAA',
    prompt: 'a cat',
    model: 'gpt-image-2',
    createdAt: 0,
    ...overrides,
  }
}

const SIZE: NodeSize = { width: 320, height: 350 }

describe('canvas selection band', () => {
  it('normalises a band dragged up and to the left into a positive rectangle', () => {
    expect(rectFromPoints(200, 180, 40, 20)).toEqual({
      x: 40,
      y: 20,
      width: 160,
      height: 160,
    })
  })

  it('treats rectangles that only share an edge as overlapping', () => {
    expect(
      rectsIntersect(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 100, y: 0, width: 100, height: 100 }
      )
    ).toBe(true)
  })

  it('picks up every node the band touches and skips the rest', () => {
    const nodes = [
      imageNode({ id: 'a', x: 0, y: 0 }),
      imageNode({ id: 'b', x: 400, y: 0 }),
      imageNode({ id: 'c', x: 0, y: 400 }),
    ]
    const sizes = { a: SIZE, b: SIZE, c: SIZE }

    // A band across the top row reaches both pictures sitting side by side.
    expect(
      nodesInRect(nodes, sizes, { x: 0, y: 0, width: 720, height: 100 })
    ).toEqual(['a', 'b'])
  })

  it('ignores a node that has not been measured yet', () => {
    const nodes = [imageNode({ id: 'a', x: 0, y: 0 })]

    expect(
      nodesInRect(nodes, {}, { x: -10, y: -10, width: 500, height: 500 })
    ).toEqual([])
  })
})

describe('canvas alignment snapping', () => {
  const neighbour = { x: 0, y: 0, width: 320, height: 350 }

  it('pulls a dragged node onto a neighbour edge that it comes close to', () => {
    const result = snapDrag({
      moving: { x: 3, y: 500, width: 320, height: 350 },
      others: [neighbour],
      grid: null,
    })

    expect(result.x).toBe(0)
    expect(result.guides).toContainEqual(
      expect.objectContaining({ axis: 'x', position: 0 })
    )
  })

  it('aligns a node with the neighbour centre rather than only its edges', () => {
    // A narrower node whose centre sits 2px off the neighbour's centre is
    // pulled across, which is the alignment a row of mixed widths needs.
    const result = snapDrag({
      moving: { x: 62, y: 500, width: 200, height: 100 },
      others: [neighbour],
      grid: null,
    })

    expect(result.x).toBe(60)
  })

  it('leaves the position alone when nothing is close enough to align with', () => {
    const result = snapDrag({
      moving: { x: 900, y: 900, width: 320, height: 350 },
      others: [neighbour],
      grid: null,
    })

    expect(result).toEqual({ x: 900, y: 900, guides: [] })
  })

  it('falls back to the grid on an axis with no neighbour to line up with', () => {
    const result = snapDrag({
      moving: { x: 890, y: 907, width: 320, height: 350 },
      others: [neighbour],
      grid: 24,
    })

    expect(result.x).toBe(888)
    expect(result.y).toBe(912)
  })
})

describe('canvas framing', () => {
  it('returns no bounds for a board whose nodes have not been measured', () => {
    expect(contentBounds([imageNode({ id: 'a', x: 0, y: 0 })], {})).toBeNull()
  })

  it('frames every node with a margin around the content', () => {
    const nodes = [
      imageNode({ id: 'a', x: 0, y: 0 }),
      imageNode({ id: 'b', x: 400, y: 0 }),
    ]
    const bounds = contentBounds(nodes, { a: SIZE, b: SIZE })

    expect(bounds).toEqual({ x: 0, y: 0, width: 720, height: 350 })

    const viewport = fitViewport(bounds, { width: 720, height: 350 })
    expect(viewport?.zoom).toBeLessThan(1)
    // The framed content sits centred, so the camera offset is positive.
    expect(viewport?.x).toBeGreaterThan(0)
  })

  it('leaves the camera alone when there is nothing to frame', () => {
    expect(fitViewport(null, { width: 900, height: 600 })).toBeNull()
  })

  it('unions only the dragged nodes, so a group drag measures the group', () => {
    const nodes = [
      imageNode({ id: 'a', x: 0, y: 0 }),
      imageNode({ id: 'b', x: 400, y: 100 }),
      imageNode({ id: 'c', x: 2000, y: 2000 }),
    ]
    const sizes = { a: SIZE, b: SIZE, c: SIZE }

    expect(unionBounds(nodes, sizes, ['a', 'b'])).toEqual({
      x: 0,
      y: 0,
      width: 720,
      height: 450,
    })
  })
})

describe('new node placement', () => {
  it('keeps the requested spot when nothing is parked there', () => {
    const nodes = [imageNode({ id: 'a', x: 900, y: 900 })]

    expect(stepIntoFreeSpot(nodes, { x: 100, y: 200 }, 32)).toEqual({
      x: 100,
      y: 200,
    })
  })

  it('steps down-right past a node already sitting mid-view', () => {
    const nodes = [
      imageNode({ id: 'a', x: 100, y: 200 }),
      imageNode({ id: 'b', x: 132, y: 232 }),
    ]

    // Two notes dropped in a row would otherwise land exactly on top of each
    // other, and the second would look like it never appeared.
    expect(stepIntoFreeSpot(nodes, { x: 100, y: 200 }, 32)).toEqual({
      x: 164,
      y: 264,
    })
  })
})
