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
import { useCallback, useEffect, useState } from 'react'

import { loadBoard, saveBoard } from '../lib/board-storage'
import type { CanvasNode, CanvasViewport } from '../types'

/** Identity camera: the board origin sits at the container's top-left corner. */
export const DEFAULT_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 }

/** Editing pauses are common; wait for one before writing to storage. */
const SAVE_DELAY_MS = 500

/**
 * Board contents plus camera, restored from this browser's storage and saved
 * back after edits settle.
 */
export function useCanvasBoard() {
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [viewport, setViewport] = useState<CanvasViewport>(DEFAULT_VIEWPORT)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadBoard()
      .then((board) => {
        if (cancelled || !board) return
        setNodes(board.nodes ?? [])
        if (board.viewport) setViewport(board.viewport)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      void saveBoard({ nodes, viewport }).catch(() => undefined)
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [nodes, viewport, ready])

  const addNodes = useCallback((incoming: CanvasNode[]) => {
    setNodes((previous) => [...previous, ...incoming])
  }, [])

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setNodes((previous) =>
      previous.map((node) => (node.id === id ? { ...node, x, y } : node))
    )
  }, [])

  /** Raise a node above its neighbours, matching how the drag felt. */
  const raiseNode = useCallback((id: string) => {
    setNodes((previous) => {
      const target = previous.find((node) => node.id === id)
      if (!target || previous.at(-1)?.id === id) return previous
      return [...previous.filter((node) => node.id !== id), target]
    })
  }, [])

  const updateTextNode = useCallback((id: string, text: string) => {
    setNodes((previous) =>
      previous.map((node) =>
        node.id === id && node.kind === 'text' ? { ...node, text } : node
      )
    )
  }, [])

  const removeNode = useCallback((id: string) => {
    setNodes((previous) => previous.filter((node) => node.id !== id))
  }, [])

  const clearNodes = useCallback(() => {
    setNodes([])
  }, [])

  return {
    nodes,
    viewport,
    ready,
    setViewport,
    addNodes,
    moveNode,
    raiseNode,
    updateTextNode,
    removeNode,
    clearNodes,
  }
}
