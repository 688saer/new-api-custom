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
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  journalNodes,
  journalViewport,
  loadBoard,
  saveImage,
  saveNodes,
  saveViewport,
} from '../lib/board-storage'
import {
  ensurePersistentStorage,
  type StorageHealth,
} from '../lib/storage-durability'
import type { CanvasImageNode, CanvasNode, CanvasViewport } from '../types'

/** Identity camera: the board origin sits at the container's top-left corner. */
export const DEFAULT_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 }

/** Editing pauses are common; wait for one before writing to storage. */
const SAVE_DELAY_MS = 500

/** Why the board is not safely stored, so the page can say what to do. */
export interface CanvasStorageFailure {
  /** `read` when the saved board could not be restored, `write` when it cannot be kept. */
  operation: 'read' | 'write'
  quotaExceeded: boolean
}

/**
 * Board contents plus camera, restored from this browser's storage and saved
 * back after edits settle.
 *
 * Saving is deliberately not fire-and-forget. Everything the board holds lives
 * in one browser's storage, which browsers shrink, evict, and — in Safari, after
 * a week without a visit — delete outright, so a write that fails has to be
 * reported instead of looking like a success.
 */
export function useCanvasBoard() {
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [viewport, setViewport] = useState<CanvasViewport>(DEFAULT_VIEWPORT)
  const [ready, setReady] = useState(false)
  const [saveFailure, setSaveFailure] = useState<CanvasStorageFailure | null>(
    null
  )
  const [storage, setStorage] = useState<StorageHealth | null>(null)

  // A flush can be triggered by the browser at any moment, so the writers read
  // the newest state from refs rather than from a captured render.
  const nodesRef = useRef(nodes)
  const viewportRef = useRef(viewport)
  const readyRef = useRef(false)
  const dirtyRef = useRef({ nodes: false, viewport: false })
  nodesRef.current = nodes
  viewportRef.current = viewport

  const refreshStorage = useCallback(() => {
    void ensurePersistentStorage().then(setStorage, () => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadBoard()
      .then((board) => {
        if (cancelled) return
        setNodes(board.nodes)
        if (board.viewport) setViewport(board.viewport)
      })
      .catch(() => {
        if (!cancelled) {
          setSaveFailure({ operation: 'read', quotaExceeded: false })
        }
      })
      .finally(() => {
        if (cancelled) return
        readyRef.current = true
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    refreshStorage()
  }, [refreshStorage])

  /**
   * Commit whatever the debounce is still holding.
   *
   * An IndexedDB transaction started from `pagehide` cannot commit before the
   * document is gone, so this only helps while the page is still alive — the
   * synchronous journal written on each edit is what actually protects a tab
   * that closes mid-pause. This catches up at every other usable moment.
   */
  const flush = useCallback(() => {
    if (!readyRef.current) return
    const pending = dirtyRef.current
    if (!pending.nodes && !pending.viewport) return

    const writeNodes = pending.nodes
    const writeViewport = pending.viewport
    dirtyRef.current = { nodes: false, viewport: false }

    const writes: Promise<void>[] = []
    if (writeNodes) writes.push(saveNodes(nodesRef.current))
    if (writeViewport) writes.push(saveViewport(viewportRef.current))

    void Promise.all(writes).then(
      () => setSaveFailure(null),
      (error: unknown) => {
        // Stay dirty so the next edit tries again instead of reporting a board
        // that was never stored.
        dirtyRef.current = {
          nodes: dirtyRef.current.nodes || writeNodes,
          viewport: dirtyRef.current.viewport || writeViewport,
        }
        setSaveFailure({
          operation: 'write',
          quotaExceeded: Boolean(
            (error as { quotaExceeded?: boolean } | null)?.quotaExceeded
          ),
        })
      }
    )
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!dirtyRef.current.nodes && !dirtyRef.current.viewport) return
    const timer = window.setTimeout(flush, SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [nodes, viewport, ready, flush])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', handleVisibility)
      // Leaving the page must not drop the edit the debounce still holds.
      flush()
    }
  }, [flush])

  const addNodes = useCallback((incoming: CanvasNode[]) => {
    const next = [...nodesRef.current, ...incoming]
    dirtyRef.current.nodes = true
    journalNodes(next)
    setNodes(next)

    // A picture cannot be recreated from anything else, so its bytes are
    // committed the moment they exist instead of waiting for the debounce.
    for (const node of incoming) {
      if (node.kind !== 'image') continue
      const image = (node as CanvasImageNode).image
      void saveImage(node.id, image).catch((error: unknown) => {
        setSaveFailure({
          operation: 'write',
          quotaExceeded: Boolean(
            (error as { quotaExceeded?: boolean } | null)?.quotaExceeded
          ),
        })
      })
    }
  }, [])

  const moveNode = useCallback((id: string, x: number, y: number) => {
    const next = nodesRef.current.map((node) =>
      node.id === id ? { ...node, x, y } : node
    )
    dirtyRef.current.nodes = true
    journalNodes(next)
    setNodes(next)
  }, [])

  /** Raise a node above its neighbours, matching how the drag felt. */
  const raiseNode = useCallback((id: string) => {
    const current = nodesRef.current
    const target = current.find((node) => node.id === id)
    if (!target || current.at(-1)?.id === id) return
    const next = [...current.filter((node) => node.id !== id), target]
    dirtyRef.current.nodes = true
    journalNodes(next)
    setNodes(next)
  }, [])

  const updateTextNode = useCallback((id: string, text: string) => {
    const next = nodesRef.current.map((node) =>
      node.id === id && node.kind === 'text' ? { ...node, text } : node
    )
    dirtyRef.current.nodes = true
    journalNodes(next)
    setNodes(next)
  }, [])

  const removeNode = useCallback((id: string) => {
    const next = nodesRef.current.filter((node) => node.id !== id)
    dirtyRef.current.nodes = true
    journalNodes(next)
    setNodes(next)
  }, [])

  const clearNodes = useCallback(() => {
    dirtyRef.current.nodes = true
    journalNodes([])
    setNodes([])
  }, [])

  /** Camera moves are the most frequent edit, so they get their own record. */
  const updateViewport = useCallback((next: CanvasViewport) => {
    dirtyRef.current.viewport = true
    journalViewport(next)
    setViewport(next)
  }, [])

  return {
    nodes,
    viewport,
    ready,
    saveFailure,
    storage,
    refreshStorage,
    setViewport: updateViewport,
    addNodes,
    moveNode,
    raiseNode,
    updateTextNode,
    removeNode,
    clearNodes,
  }
}
