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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { journalNodes, journalViewport } from '../lib/board-storage'
import type { CanvasImageNode, CanvasTextNode } from '../types'

const JOURNAL_KEY = 'newapi-canvas:journal'

function imageNode(id: string): CanvasImageNode {
  return {
    kind: 'image',
    id,
    image: 'data:image/png;base64,AAA',
    prompt: 'a red cube',
    model: 'gpt-image-2',
    x: 10,
    y: 20,
    createdAt: 1,
  }
}

function noteNode(id: string, text: string): CanvasTextNode {
  return { kind: 'text', id, text, x: 0, y: 0, createdAt: 2 }
}

function readJournal(): { nodes: unknown[]; viewport: unknown } {
  return JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? '{}')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('board journal', () => {
  it('keeps the layout but never the picture bytes', () => {
    journalNodes([imageNode('a'), noteNode('b', 'hello')])

    const journal = readJournal()
    expect(journal.nodes).toHaveLength(2)
    // Pictures are megabytes and the synchronous quota is small; the bytes live
    // in IndexedDB and the journal only records that the node exists.
    expect(JSON.stringify(journal)).not.toContain('base64')
    expect(journal.nodes[0]).toMatchObject({
      kind: 'image',
      prompt: 'a red cube',
    })
    expect(journal.nodes[1]).toMatchObject({ kind: 'text', text: 'hello' })
  })

  it('keeps the camera when the layout is written again', () => {
    journalViewport({ x: 5, y: 6, zoom: 2 })
    journalNodes([noteNode('a', 'kept')])

    // Writing one half must not erase the other, or a pan would lose the board.
    expect(readJournal().viewport).toEqual({ x: 5, y: 6, zoom: 2 })
    expect(readJournal().nodes).toHaveLength(1)
  })

  it('keeps the layout when the camera moves', () => {
    journalNodes([noteNode('a', 'kept')])
    journalViewport({ x: 1, y: 2, zoom: 1.5 })

    expect(readJournal().nodes).toHaveLength(1)
    expect(readJournal().viewport).toEqual({ x: 1, y: 2, zoom: 1.5 })
  })

  it('survives a full localStorage instead of breaking the edit', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    // Losing the journal is bad, but throwing here would make the board
    // unusable, and IndexedDB is still there to take the write.
    expect(() => journalNodes([noteNode('a', 'x')])).not.toThrow()
  })
})
