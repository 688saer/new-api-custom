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
  createBoardWriterId,
  journalNodes,
  journalViewport,
  loadBoard,
  notifyBoardStored,
  saveNodes,
  saveViewport,
  subscribeBoardStored,
} from '../lib/board-storage'
import {
  ensurePersistentStorage,
  type StorageHealth,
} from '../lib/storage-durability'
import type { CanvasNode, CanvasViewport } from '../types'

/** Identity camera: the board origin sits at the container's top-left corner. */
export const DEFAULT_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 }

/** Editing pauses are common; wait for one before writing to storage. */
const SAVE_DELAY_MS = 500

/** Offset a duplicated node takes, matching the board's grid so it lands tidy. */
const GRID_STEP = 24

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
  /** Identifies this board among the instances that share one browser store. */
  const [writerId] = useState(createBoardWriterId)

  // A flush can be triggered by the browser at any moment, so the writers read
  // the newest state from refs rather than from a captured render.
  const nodesRef = useRef(nodes)
  const viewportRef = useRef(viewport)
  const readyRef = useRef(false)
  const dirtyRef = useRef({ nodes: false, viewport: false })
  // A picture can finish after this board is gone; the write then has to know
  // that the layout in memory is frozen and no longer the whole truth.
  const aliveRef = useRef(true)
  nodesRef.current = nodes
  viewportRef.current = viewport

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  const refreshStorage = useCallback(() => {
    void ensurePersistentStorage().then(setStorage, () => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false

    const restore = async () => {
      try {
        const board = await loadBoard()
        if (cancelled) return
        setNodes(board.nodes)
        if (board.viewport) setViewport(board.viewport)
      } catch {
        if (!cancelled) {
          setSaveFailure({ operation: 'read', quotaExceeded: false })
        }
      } finally {
        if (!cancelled) {
          readyRef.current = true
          setReady(true)
        }
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    refreshStorage()
  }, [refreshStorage])

  /**
   * Take over a layout another instance wrote.
   *
   * A picture finished while the operator was browsing elsewhere is stored by
   * the board that asked for it, and that board is unmounted by then. Reading
   * the store back here is what shows the picture on the page they returned to
   * instead of only after a reload; the board still being restored needs no
   * help, because its own read sees the same layout.
   */
  useEffect(
    () =>
      subscribeBoardStored((origin) => {
        if (origin === writerId || !readyRef.current) return
        void loadBoard().then(
          (board) => {
            setNodes((previous) => {
              const known = new Set(previous.map((node) => node.id))
              const additions = board.nodes.filter(
                (node) => !known.has(node.id)
              )
              return additions.length === 0
                ? previous
                : [...previous, ...additions]
            })
          },
          () => undefined
        )
      }),
    [writerId]
  )

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

  /**
   * Add nodes and commit them before the caller moves on.
   *
   * Saving is not left to the debounce. A generated picture outlives the page
   * that asked for it: by the time the request answers, the board instance that
   * would have flushed it is unmounted, so a layout held only in this tab's
   * memory never reaches storage. Writing it here — additions only, never the
   * pictures already stored — is what lets another page read it back.
   */
  const addNodes = useCallback(
    (incoming: CanvasNode[]) => {
      const local = [...nodesRef.current, ...incoming]
      journalNodes(local)
      setNodes(local)

      const write = async () => {
        if (aliveRef.current) {
          await saveNodes(local)
          return
        }
        // This board is unmounted, so `local` is the layout as it was when the
        // page closed. Another page may have added or moved things since; its
        // stored layout wins, and only the pictures that are new here get
        // appended, because writing `local` alone would drop that work.
        const stored = await loadBoard().catch(() => null)
        const known = new Set(stored?.nodes.map((node) => node.id))
        await saveNodes([
          ...(stored?.nodes ?? []),
          ...local.filter((node) => !known.has(node.id)),
        ])
      }

      void write().then(
        () => {
          dirtyRef.current.nodes = false
          setSaveFailure(null)
          // Announced only after the write commits, so a board reacting to this
          // signal cannot read the layout from before it.
          notifyBoardStored(writerId)
        },
        (error: unknown) => {
          // Stay dirty, so the debounced save tries again instead of leaving
          // the picture in this tab only.
          dirtyRef.current.nodes = true
          setSaveFailure({
            operation: 'write',
            quotaExceeded: Boolean(
              (error as { quotaExceeded?: boolean } | null)?.quotaExceeded
            ),
          })
        }
      )
    },
    [writerId]
  )

  const moveNodes = useCallback(
    (moves: { id: string; x: number; y: number }[]) => {
      if (moves.length === 0) return
      const targets = new Map(moves.map((move) => [move.id, move]))
      const next = nodesRef.current.map((node) => {
        const move = targets.get(node.id)
        if (!move) return node
        return { ...node, x: move.x, y: move.y }
      })
      dirtyRef.current.nodes = true
      journalNodes(next)
      setNodes(next)
    },
    []
  )

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

  /** Change how large a picture sits on the board. */
  const setNodeWidth = useCallback((id: string, width: number) => {
    const next = nodesRef.current.map((node) =>
      node.id === id && node.kind === 'image' ? { ...node, width } : node
    )
    dirtyRef.current.nodes = true
    journalNodes(next)
    setNodes(next)
  }, [])

  const removeNodes = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const doomed = new Set(ids)
    const next = nodesRef.current.filter((node) => !doomed.has(node.id))
    dirtyRef.current.nodes = true
    journalNodes(next)
    setNodes(next)
  }, [])

  /**
   * Copy a node onto the board beside the original, offset by one grid step so
   * the copy is visibly separate and can be dragged away. The copy starts a
   * family of its own: it keeps the parent link, but nothing points at it yet.
   */
  const duplicateNode = useCallback(
    (id: string): string | null => {
      const source = nodesRef.current.find((node) => node.id === id)
      if (!source) return null

      const copyId = `copy-${crypto.randomUUID?.() ?? Date.now()}`
      const copy: CanvasNode = {
        ...source,
        id: copyId,
        x: source.x + GRID_STEP,
        y: source.y + GRID_STEP,
        createdAt: Date.now(),
      }
      addNodes([copy])
      return copyId
    },
    [addNodes]
  )

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
    moveNodes,
    raiseNode,
    updateTextNode,
    setNodeWidth,
    removeNodes,
    duplicateNode,
    clearNodes,
  }
}
