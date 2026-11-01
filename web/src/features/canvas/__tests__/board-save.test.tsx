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
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CanvasImageNode, CanvasNode } from '../types'

const {
  loadBoard,
  saveNodes,
  saveViewport,
  journalNodes,
  journalViewport,
  ensurePersistentStorage,
} = vi.hoisted(() => ({
  loadBoard: vi.fn(),
  saveNodes: vi.fn(),
  saveViewport: vi.fn(),
  journalNodes: vi.fn(),
  journalViewport: vi.fn(),
  ensurePersistentStorage: vi.fn(),
}))

// Only the storage calls are replaced: the writer bookkeeping that tells one
// board instance about another's write runs for real, because that is the path
// this file has to protect.
vi.mock('../lib/board-storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/board-storage')>()
  return {
    ...actual,
    loadBoard,
    saveNodes,
    saveViewport,
    journalNodes,
    journalViewport,
  }
})

vi.mock('../lib/storage-durability', () => ({ ensurePersistentStorage }))

const { useCanvasBoard } = await import('../hooks/use-canvas-board')

function imageNode(id: string): CanvasImageNode {
  return {
    kind: 'image',
    id,
    image: 'data:image/png;base64,AAA',
    prompt: 'a red cube',
    model: 'gpt-image-2',
    x: 0,
    y: 0,
    createdAt: 1,
  }
}

/** Long enough for the hook's save debounce to have elapsed. */
const PAST_DEBOUNCE_MS = 900

/** What the browser store would hold after the writes seen so far. */
let stored: CanvasNode[] = []

beforeEach(() => {
  stored = []
  // `loadBoard` answers with the split-storage shape, never null.
  loadBoard.mockImplementation(async () => ({ nodes: stored, viewport: null }))
  saveNodes.mockImplementation(async (nodes: CanvasNode[]) => {
    stored = nodes
  })
  saveViewport.mockResolvedValue(undefined)
  ensurePersistentStorage.mockResolvedValue({
    durability: 'persisted',
    usage: null,
    quota: null,
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('canvas autosave', () => {
  it('writes the board once edits settle', async () => {
    const { result } = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(result.current.ready).toBe(true))

    act(() => result.current.addNodes([imageNode('a')]))

    await waitFor(() => expect(saveNodes).toHaveBeenCalled())
    expect(saveNodes.mock.calls.at(-1)?.[0]).toHaveLength(1)
  })

  it('does not overwrite stored pictures before they have been read', async () => {
    // A slow read must not let an empty board win the race and wipe the work.
    let release = () => {}
    loadBoard.mockReturnValue(
      new Promise((resolve) => {
        release = () =>
          resolve({ nodes: [imageNode('stored')], viewport: null })
      })
    )

    const { result } = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(saveNodes).toHaveBeenCalledTimes(0))

    await act(async () => {
      release()
    })
    await waitFor(() => expect(result.current.nodes).toHaveLength(1))
  })

  it('flushes a pending edit when the page is hidden', async () => {
    const { result } = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(result.current.ready).toBe(true))

    // Edit and leave immediately: the debounce timer never gets to fire, so
    // only an explicit flush on hide can save this picture.
    act(() => result.current.addNodes([imageNode('pending')]))
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })

    await waitFor(() => expect(saveNodes).toHaveBeenCalled())
    const saved = saveNodes.mock.calls.at(-1)?.[0] as CanvasImageNode[]
    expect(saved.map((node) => node.id)).toContain('pending')
  })

  it('flushes a pending edit when the page becomes hidden', async () => {
    const { result } = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(result.current.ready).toBe(true))

    act(() => result.current.addNodes([imageNode('tabbed')]))
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => expect(saveNodes).toHaveBeenCalled())
    const saved = saveNodes.mock.calls.at(-1)?.[0] as CanvasImageNode[]
    expect(saved.map((node) => node.id)).toContain('tabbed')
  })

  it('reports a full storage quota instead of dropping the board silently', async () => {
    saveNodes.mockRejectedValue(
      Object.assign(new Error('Browser storage is full.'), {
        quotaExceeded: true,
      })
    )

    const { result } = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(result.current.ready).toBe(true))

    act(() => result.current.addNodes([imageNode('big')]))

    await waitFor(() => expect(result.current.saveFailure).not.toBeNull())
    expect(result.current.saveFailure).toEqual({
      operation: 'write',
      quotaExceeded: true,
    })
  })

  it('clears the failure once a later save succeeds', async () => {
    saveNodes.mockRejectedValueOnce(
      Object.assign(new Error('Browser storage is full.'), {
        quotaExceeded: true,
      })
    )

    const { result } = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(result.current.ready).toBe(true))

    act(() => result.current.addNodes([imageNode('one')]))
    await waitFor(() => expect(result.current.saveFailure).not.toBeNull())

    act(() => result.current.addNodes([imageNode('two')]))
    await waitFor(() => expect(result.current.saveFailure).toBeNull())
  })

  it('reports how durable the browser storage is', async () => {
    ensurePersistentStorage.mockResolvedValue({
      durability: 'best-effort',
      usage: 1024,
      quota: 2048,
    })

    const { result } = renderHook(() => useCanvasBoard())

    await waitFor(() =>
      expect(result.current.storage?.durability).toBe('best-effort')
    )
  })

  it('does not rewrite a board that was just read back', async () => {
    loadBoard.mockResolvedValue({
      nodes: [imageNode('stored')],
      viewport: null,
    })

    const { result } = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(result.current.nodes).toHaveLength(1))

    // Re-writing megabytes of stored pictures on every visit is what makes the
    // quota fill up, so a plain reload must stay quiet.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, PAST_DEBOUNCE_MS))
    })
    expect(saveNodes).not.toHaveBeenCalled()
  })

  it('stores a new picture as soon as it exists', async () => {
    const { result } = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(result.current.ready).toBe(true))

    act(() => result.current.addNodes([imageNode('fresh')]))

    // Opening another page unmounts this board, and a debounce that never fires
    // would leave the picture in a component that is already gone.
    await waitFor(() => expect(saveNodes).toHaveBeenCalled())
    const saved = saveNodes.mock.calls.at(-1)?.[0] as CanvasImageNode[]
    expect(saved.map((node) => node.id)).toEqual(['fresh'])
  })

  it('journals the layout synchronously on every edit', async () => {
    const { result } = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(result.current.ready).toBe(true))

    act(() => result.current.addNodes([imageNode('journaled')]))

    // An IndexedDB write started from `pagehide` cannot commit, so the layout
    // has to reach synchronous storage before the tab can go away.
    expect(journalNodes).toHaveBeenCalled()
    const journaled = journalNodes.mock.calls.at(-1)?.[0] as CanvasImageNode[]
    expect(journaled.map((node) => node.id)).toEqual(['journaled'])
  })

  it('journals the camera when it moves', async () => {
    const { result } = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(result.current.ready).toBe(true))

    act(() => result.current.setViewport({ x: 12, y: -8, zoom: 1.5 }))

    expect(journalViewport).toHaveBeenCalledWith({ x: 12, y: -8, zoom: 1.5 })
  })

  it('shows a picture finished while the board was on another page', async () => {
    // The board that started the drawing is the one that gets unmounted when
    // the operator opens another page; the request answers afterwards.
    const away = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(away.result.current.ready).toBe(true))
    away.unmount()

    const returned = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(returned.result.current.ready).toBe(true))

    await act(async () => {
      away.result.current.addNodes([imageNode('finished-elsewhere')])
    })

    await waitFor(() =>
      expect(returned.result.current.nodes.map((node) => node.id)).toContain(
        'finished-elsewhere'
      )
    )
  })

  it('keeps its own layout when it adopts a stored one', async () => {
    const kept = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(kept.result.current.ready).toBe(true))
    act(() => kept.result.current.addNodes([imageNode('mine')]))

    // A picture drawn elsewhere lands while this board holds unsaved edits: the
    // adopted layout may only add to what is on screen, never replace it.
    const away = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(away.result.current.ready).toBe(true))
    await act(async () => {
      away.result.current.addNodes([imageNode('theirs')])
    })

    await waitFor(() =>
      expect(kept.result.current.nodes.map((node) => node.id)).toContain(
        'theirs'
      )
    )
    expect(kept.result.current.nodes.map((node) => node.id)).toContain('mine')
  })

  it('does not reread the board after its own write', async () => {
    const { result } = renderHook(() => useCanvasBoard())
    await waitFor(() => expect(result.current.ready).toBe(true))
    const readsAfterRestore = loadBoard.mock.calls.length

    await act(async () => {
      result.current.addNodes([imageNode('own')])
    })
    await waitFor(() => expect(saveNodes).toHaveBeenCalled())

    expect(loadBoard.mock.calls.length).toBe(readsAfterRestore)
  })
})
