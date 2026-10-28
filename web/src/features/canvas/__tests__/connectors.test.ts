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

import { buildConnectors, type NodeSize } from '../lib/connectors'
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

describe('canvas track lines', () => {
  it('draws nothing for a picture that was not derived from another', () => {
    const nodes = [imageNode({ id: 'a', x: 0, y: 0 })]

    expect(buildConnectors(nodes, { a: SIZE }, [])).toEqual([])
  })

  it('drops the line once the source picture has been deleted', () => {
    const nodes = [imageNode({ id: 'b', x: 400, y: 0, parentId: 'gone' })]

    expect(buildConnectors(nodes, { b: SIZE }, [])).toEqual([])
  })

  it('waits for both nodes to be measured before drawing', () => {
    const nodes = [
      imageNode({ id: 'a', x: 0, y: 0 }),
      imageNode({ id: 'b', x: 400, y: 0, parentId: 'a' }),
    ]

    expect(buildConnectors(nodes, { a: SIZE }, [])).toEqual([])
  })

  it('joins a picture hung to the right of its source with a horizontal track', () => {
    const nodes = [
      imageNode({ id: 'a', x: 0, y: 0 }),
      imageNode({ id: 'b', x: 376, y: 0, parentId: 'a' }),
    ]

    const [connector] = buildConnectors(
      nodes,
      { a: SIZE, b: SIZE },
      []
    )

    // Leaves the source's right edge at its vertical centre and enters the
    // derived picture's left edge at the same height.
    expect(connector).toMatchObject({ x1: 320, y1: 175, x2: 376, y2: 175 })
    expect(connector.d).toBe('M 320 175 C 360 175, 336 175, 376 175')
  })

  it('joins a picture placed underneath its source with a vertical track', () => {
    const nodes = [
      imageNode({ id: 'a', x: 0, y: 0 }),
      imageNode({ id: 'b', x: 0, y: 400, parentId: 'a' }),
    ]

    const [connector] = buildConnectors(
      nodes,
      { a: SIZE, b: SIZE },
      []
    )

    expect(connector).toMatchObject({ x1: 160, y1: 350, x2: 160, y2: 400 })
    expect(connector.d).toBe('M 160 350 C 160 390, 160 360, 160 400')
  })

  it('highlights the track while either end is the selected node', () => {
    const nodes = [
      imageNode({ id: 'a', x: 0, y: 0 }),
      imageNode({ id: 'b', x: 376, y: 0, parentId: 'a' }),
    ]
    const sizes = { a: SIZE, b: SIZE }

    expect(buildConnectors(nodes, sizes, ['b'])[0].active).toBe(true)
    expect(buildConnectors(nodes, sizes, ['a'])[0].active).toBe(true)
    expect(buildConnectors(nodes, sizes, [])[0].active).toBe(false)
  })
})
