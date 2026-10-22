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
import { StickyNote, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { handleServerError } from '@/lib/handle-server-error'

import { editImage, generateImages, revealApiKey } from './api'
import { CanvasBoard } from './components/canvas-board'
import { IMAGE_NODE_WIDTH } from './components/canvas-image-node'
import {
  CanvasPromptPanel,
  type CanvasDraft,
  type CanvasReference,
} from './components/canvas-prompt-panel'
import { useCanvasBoard } from './hooks/use-canvas-board'
import type { CanvasImageNode, CanvasTextNode } from './types'

const NODE_GAP = 24
/** Rough height of an image node including its caption row. */
const NODE_ROW_HEIGHT = 380
/** Gap between a source picture and the picture derived from it. */
const PARENT_GAP = 56
/** Width of a note, mirroring the note component's own constant. */
const TEXT_NODE_WIDTH = 260
/** Used before the container reports its size, so a node is never off-screen. */
const FALLBACK_VIEW = { width: 900, height: 640 }

const EMPTY_DRAFT: CanvasDraft = {
  apiKeyId: '',
  model: '',
  size: '1024x1024',
  count: '1',
  prompt: '',
}

function newId(prefix: string): string {
  return crypto.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random()}`
}

/**
 * Draw with this site's own models on an infinite board. Every image is
 * produced through the console API with one of the operator's own keys, so
 * nothing leaves the deployment and no upstream credential is involved.
 */
export function CanvasWorkspace() {
  const { t } = useTranslation()
  const board = useCanvasBoard()
  const [draft, setDraft] = useState<CanvasDraft>(EMPTY_DRAFT)
  const [generating, setGenerating] = useState(false)
  const [view, setView] = useState(FALLBACK_VIEW)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reference, setReference] = useState<CanvasReference | null>(null)
  // Kept in a ref on purpose: the key authorizes billing, so it must not
  // outlive the page in any form of storage.
  const revealedKeys = useRef(new Map<number, string>())

  const handleResize = useCallback((next: { width: number; height: number }) => {
    if (next.width > 0 && next.height > 0) setView(next)
  }, [])

  const handleDraftChange = useCallback((patch: Partial<CanvasDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }))
  }, [])

  /**
   * Run one request and place the results around the middle of the current
   * view, so a fresh batch lands where the operator is looking instead of at a
   * stale saved offset. A result derived from an existing picture is hung off
   * that picture instead, and remembers it as its parent so the board can draw
   * the track line between them.
   */
  const runRequest = async (
    request: CanvasDraft,
    from: CanvasReference | null,
    parentId: string | null = null
  ) => {
    const apiKeyId = Number(request.apiKeyId)
    if (!apiKeyId) {
      handleServerError(new Error(t('Select an API key first.')))
      return
    }
    if (!request.prompt.trim() || !request.model.trim()) {
      handleServerError(new Error(t('Write a prompt and pick a model first.')))
      return
    }

    setGenerating(true)
    try {
      let apiKey = revealedKeys.current.get(apiKeyId)
      if (!apiKey) {
        apiKey = await revealApiKey(apiKeyId)
        if (!apiKey) {
          handleServerError(
            new Error(t('Could not read the API key. Create a new one and retry.'))
          )
          return
        }
        revealedKeys.current.set(apiKeyId, apiKey)
      }

      const images = from
        ? await editImage({
            apiKey,
            model: request.model,
            prompt: request.prompt,
            size: request.size,
            count: Number(request.count),
            reference: from.image,
          })
        : await generateImages({
            apiKey,
            model: request.model,
            prompt: request.prompt,
            size: request.size,
            count: Number(request.count),
          })

      const centerX =
        (view.width / 2 - board.viewport.x) / board.viewport.zoom
      const centerY =
        (view.height / 2 - board.viewport.y) / board.viewport.zoom
      const columns = Math.min(images.length, 2)
      const originX =
        centerX - (columns * (IMAGE_NODE_WIDTH + NODE_GAP)) / 2 + NODE_GAP / 2
      const originY = centerY - NODE_ROW_HEIGHT / 3

      const parent = parentId
        ? board.nodes.find((node) => node.id === parentId)
        : undefined
      // Chain beside the parent only while it is on screen; otherwise the new
      // pictures would be created somewhere the operator cannot see.
      const parentOnScreen =
        parent !== undefined &&
        parent.x * board.viewport.zoom + board.viewport.x > -IMAGE_NODE_WIDTH &&
        parent.x * board.viewport.zoom + board.viewport.x < view.width &&
        parent.y * board.viewport.zoom + board.viewport.y > -NODE_ROW_HEIGHT &&
        parent.y * board.viewport.zoom + board.viewport.y < view.height

      board.addNodes(
        images.map((image, index) => {
          const base = {
            kind: 'image' as const,
            id: newId('img'),
            image,
            prompt: request.prompt,
            model: request.model,
            parentId: parent?.id,
            createdAt: Date.now(),
          }

          // Hang the result off the source picture, one per row, so the track
          // line between them stays short and readable.
          if (parent && parentOnScreen) {
            return {
              ...base,
              x: parent.x + IMAGE_NODE_WIDTH + PARENT_GAP,
              y: parent.y + index * NODE_ROW_HEIGHT,
            }
          }

          return {
            ...base,
            x: originX + (index % columns) * (IMAGE_NODE_WIDTH + NODE_GAP),
            y: originY + Math.floor(index / columns) * NODE_ROW_HEIGHT,
          }
        })
      )
    } catch (error) {
      handleServerError(error, t('Could not generate the image.'))
    } finally {
      setGenerating(false)
    }
  }

  const handleAddNote = () => {
    const centerX = (view.width / 2 - board.viewport.x) / board.viewport.zoom
    const centerY = (view.height / 2 - board.viewport.y) / board.viewport.zoom
    const node: CanvasTextNode = {
      kind: 'text',
      id: newId('note'),
      text: '',
      x: centerX - TEXT_NODE_WIDTH / 2,
      y: centerY - 60,
      createdAt: Date.now(),
    }
    board.addNodes([node])
    setSelectedId(node.id)
  }

  /** Draw again from an existing picture, reusing its prompt and model. */
  const handleRegenerate = (node: CanvasImageNode) => {
    const next: CanvasDraft = { ...draft, prompt: node.prompt, model: node.model }
    setDraft(next)
    setReference(null)
    void runRequest(next, null, node.id)
  }

  /** Draw a variation that keeps this picture as the visual reference. */
  const handleUseAsReference = (node: CanvasImageNode) => {
    setReference({ id: node.id, image: node.image })
    setDraft((previous) => ({ ...previous, prompt: node.prompt, model: node.model }))
    setSelectedId(node.id)
  }

  // Delete removes the selected node, unless a field has focus.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target as HTMLElement | null
      const editing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      if (editing || !selectedId) return
      event.preventDefault()
      board.removeNode(selectedId)
      setSelectedId(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, board])

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Infinite canvas')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex h-full min-h-0 flex-col gap-3 lg:flex-row'>
          <CanvasPromptPanel
            className='shrink-0 lg:w-80'
            draft={draft}
            onDraftChange={handleDraftChange}
            generating={generating}
            reference={reference}
            onClearReference={() => setReference(null)}
            onGenerate={() => void runRequest(draft, reference, reference?.id ?? null)}
          />
          <CanvasBoard
            className='min-h-0 flex-1'
            nodes={board.nodes}
            viewport={board.viewport}
            selectedId={selectedId}
            busy={generating}
            onViewportChange={board.setViewport}
            onSelect={(id) => {
              setSelectedId(id)
              if (id) board.raiseNode(id)
            }}
            onMoveNode={board.moveNode}
            onRemoveNode={board.removeNode}
            onChangeText={board.updateTextNode}
            onRegenerate={handleRegenerate}
            onUseAsReference={handleUseAsReference}
            onUseAsPrompt={(text) => {
              handleDraftChange({ prompt: text })
            }}
            onResize={handleResize}
            actions={
              <>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleAddNote}
                  aria-label={t('Add note')}
                >
                  <StickyNote />
                  <span>{t('Add note')}</span>
                </Button>
                {board.nodes.length > 0 && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={board.clearNodes}
                    aria-label={t('Clear canvas')}
                  >
                    <Trash2 />
                    <span>{t('Clear canvas')}</span>
                  </Button>
                )}
              </>
            }
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
