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
import { PanelLeftClose, PanelLeftOpen, StickyNote, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { handleServerError } from '@/lib/handle-server-error'

import { editImage, generateImages, revealApiKey } from './api'
import { CanvasBoard, type NodeMove } from './components/canvas-board'
import { DEFAULT_IMAGE_NODE_WIDTH } from './components/canvas-image-node'
import {
  CanvasPromptPanel,
  type CanvasDraft,
  type CanvasReference,
} from './components/canvas-prompt-panel'
import { CanvasStorageAlerts } from './components/canvas-storage-alerts'
import { useCanvasBoard } from './hooks/use-canvas-board'
import { usePendingGenerations } from './hooks/use-pending-generations'
import { finishGeneration, startGeneration } from './lib/generation-status'
import { draftImageSize, parseImageSize } from './lib/image-size'
import { stepIntoFreeSpot, GRID_SIZE } from './lib/selection'
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
/** How far a second note steps away from one already sitting mid-view. */
const NOTE_CASCADE_STEP = 32
/** How many finished prompts the panel offers to reuse. */
const RECENT_PROMPT_LIMIT = 8

/** Arrow-key nudges, in board units. A held Shift moves a whole grid step. */
const KEY_NUDGES: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
}

const EMPTY_DRAFT: CanvasDraft = {
  apiKeyId: '',
  model: '',
  sizeWidth: '1024',
  sizeHeight: '1024',
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
  const generating = usePendingGenerations() > 0
  const [view, setView] = useState(FALLBACK_VIEW)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [reference, setReference] = useState<CanvasReference | null>(null)
  const [recentPrompts, setRecentPrompts] = useState<string[]>([])
  const [panelOpen, setPanelOpen] = useState(true)
  // A phone cannot spare 320px for a sidebar, so the prompt panel becomes a
  // drawer there and starts closed: the board gets the whole screen.
  const isMobile = useIsMobile()
  const [panelSheetOpen, setPanelSheetOpen] = useState(false)
  // Kept in a ref on purpose: the key authorizes billing, so it must not
  // outlive the page in any form of storage.
  const revealedKeys = useRef(new Map<number, string>())

  const handleResize = useCallback(
    (next: { width: number; height: number }) => {
      if (next.width > 0 && next.height > 0) setView(next)
    },
    []
  )

  const handleDraftChange = useCallback((patch: Partial<CanvasDraft>) => {
    setDraft((previous) => ({ ...previous, ...patch }))
  }, [])

  const rememberPrompt = useCallback((prompt: string) => {
    const trimmed = prompt.trim()
    if (!trimmed) return
    setRecentPrompts((previous) => {
      const without = previous.filter((item) => item !== trimmed)
      return [trimmed, ...without].slice(0, RECENT_PROMPT_LIMIT)
    })
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
    const size = draftImageSize(request.sizeWidth, request.sizeHeight)
    if (!size) {
      handleServerError(new Error(t('Choose a width and height first.')))
      return
    }

    // Counted outside this component: the request keeps running after the
    // operator opens another page, and the panel must not look idle if they
    // come back while it is still drawing.
    startGeneration()
    try {
      let apiKey = revealedKeys.current.get(apiKeyId)
      if (!apiKey) {
        apiKey = await revealApiKey(apiKeyId)
        if (!apiKey) {
          handleServerError(
            new Error(
              t('Could not read the API key. Create a new one and retry.')
            )
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
            size,
            count: Number(request.count),
            reference: from.image,
          })
        : await generateImages({
            apiKey,
            model: request.model,
            prompt: request.prompt,
            size,
            count: Number(request.count),
          })

      const centerX = (view.width / 2 - board.viewport.x) / board.viewport.zoom
      const centerY = (view.height / 2 - board.viewport.y) / board.viewport.zoom
      const columns = Math.min(images.length, 2)
      const originX =
        centerX -
        (columns * (DEFAULT_IMAGE_NODE_WIDTH + NODE_GAP)) / 2 +
        NODE_GAP / 2
      const originY = centerY - NODE_ROW_HEIGHT / 3

      const parent = parentId
        ? board.nodes.find((node) => node.id === parentId)
        : undefined
      // Chain beside the parent only while it is on screen; otherwise the new
      // pictures would be created somewhere the operator cannot see.
      const parentOnScreen =
        parent !== undefined &&
        parent.x * board.viewport.zoom + board.viewport.x >
          -DEFAULT_IMAGE_NODE_WIDTH &&
        parent.x * board.viewport.zoom + board.viewport.x < view.width &&
        parent.y * board.viewport.zoom + board.viewport.y > -NODE_ROW_HEIGHT &&
        parent.y * board.viewport.zoom + board.viewport.y < view.height

      const created = images.map((image, index) => {
        const base = {
          kind: 'image' as const,
          id: newId('img'),
          image,
          prompt: request.prompt,
          model: request.model,
          size,
          parentId: parent?.id,
          createdAt: Date.now(),
        }

        // Hang the result off the source picture, one per row, so the track
        // line between them stays short and readable.
        if (parent && parentOnScreen) {
          return {
            ...base,
            x: parent.x + DEFAULT_IMAGE_NODE_WIDTH + PARENT_GAP,
            y: parent.y + index * NODE_ROW_HEIGHT,
          }
        }

        return {
          ...base,
          x:
            originX + (index % columns) * (DEFAULT_IMAGE_NODE_WIDTH + NODE_GAP),
          y: originY + Math.floor(index / columns) * NODE_ROW_HEIGHT,
        }
      })

      board.addNodes(created)
      // Land the selection on what was just drawn, so Delete and drag act on
      // the new pictures instead of whatever was picked before.
      setSelectedIds(created.map((node) => node.id))
      rememberPrompt(request.prompt)
      // Drawing is a user gesture, which is the moment browsers are most likely
      // to grant persistent storage 鈥?worth asking again after a refusal.
      board.refreshStorage()
    } catch (error) {
      handleServerError(error, t('Could not generate the image.'))
    } finally {
      finishGeneration()
    }
  }

  const handleAddNote = () => {
    const centerX = (view.width / 2 - board.viewport.x) / board.viewport.zoom
    const centerY = (view.height / 2 - board.viewport.y) / board.viewport.zoom
    const spot = stepIntoFreeSpot(
      board.nodes,
      { x: centerX - TEXT_NODE_WIDTH / 2, y: centerY - 60 },
      NOTE_CASCADE_STEP
    )
    const node: CanvasTextNode = {
      kind: 'text',
      id: newId('note'),
      text: '',
      x: spot.x,
      y: spot.y,
      createdAt: Date.now(),
    }
    board.addNodes([node])
    setSelectedIds([node.id])
  }

  /** Draw again from an existing picture, reusing its prompt and model. */
  const handleRegenerate = (node: CanvasImageNode) => {
    const requested = node.size ? parseImageSize(node.size) : null
    const next: CanvasDraft = {
      ...draft,
      prompt: node.prompt,
      model: node.model,
      ...(requested
        ? {
            sizeWidth: String(requested.width),
            sizeHeight: String(requested.height),
          }
        : {}),
    }
    setDraft(next)
    setReference(null)
    void runRequest(next, null, node.id)
  }

  /** Draw a variation that keeps this picture as the visual reference. */
  const handleUseAsReference = (node: CanvasImageNode) => {
    setReference({ id: node.id, image: node.image })
    setDraft((previous) => ({
      ...previous,
      prompt: node.prompt,
      model: node.model,
    }))
    setSelectedIds([node.id])
  }

  const handleDuplicateNode = (id: string) => {
    const copyId = board.duplicateNode(id)
    if (copyId) setSelectedIds([copyId])
  }

  const handleMoveNodes = (moves: NodeMove[]) => {
    board.moveNodes(moves)
  }

  // Delete removes the selection, unless a field has focus. Escape drops it.
  // Ctrl/Cmd+A takes the whole board, and Ctrl/Cmd+D copies the selection.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable

      if (event.key === 'Escape' && !typing) {
        setSelectedIds([])
        return
      }
      if (typing) return

      const command = event.metaKey || event.ctrlKey
      if (command && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelectedIds(board.nodes.map((node) => node.id))
        return
      }
      if (
        command &&
        event.key.toLowerCase() === 'd' &&
        selectedIds.length > 0
      ) {
        event.preventDefault()
        for (const id of selectedIds) board.duplicateNode(id)
        return
      }
      const nudge = KEY_NUDGES[event.key]
      if (nudge) {
        if (selectedIds.length === 0) return
        event.preventDefault()
        const step = event.shiftKey ? GRID_SIZE : 1
        const chosen = new Set(selectedIds)
        board.moveNodes(
          board.nodes
            .filter((node) => chosen.has(node.id))
            .map((node) => ({
              id: node.id,
              x: node.x + nudge.dx * step,
              y: node.y + nudge.dy * step,
            }))
        )
        return
      }

      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (selectedIds.length === 0) return
      event.preventDefault()
      board.removeNodes(selectedIds)
      setSelectedIds([])
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [board, selectedIds])

  const handleGenerate = () => {
    void runRequest(draft, reference, reference?.id ?? null)
    // On a phone the drawer covers the board, which is exactly what the operator
    // wants to look at once the request is on its way.
    if (isMobile) setPanelSheetOpen(false)
  }

  const panelBody = (
    <>
      <CanvasStorageAlerts
        failure={board.saveFailure}
        storage={board.storage}
        hasNodes={board.nodes.length > 0}
      />
      <CanvasPromptPanel
        className='min-h-0 flex-1'
        draft={draft}
        onDraftChange={handleDraftChange}
        generating={generating}
        reference={reference}
        recentPrompts={recentPrompts}
        onClearReference={() => setReference(null)}
        onGenerate={handleGenerate}
      />
    </>
  )

  return (
    <SectionPageLayout bleed>
      <SectionPageLayout.Content>
        <div className='flex h-full min-h-0'>
          {panelOpen && (
            <aside className='bg-background hidden w-80 shrink-0 flex-col gap-3 border-r p-3 md:flex'>
              <div className='flex items-center justify-between gap-2'>
                <h1 className='truncate text-sm font-semibold'>
                  {t('Infinite canvas')}
                </h1>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-7'
                  onClick={() => setPanelOpen(false)}
                  aria-label={t('Collapse panel')}
                >
                  <PanelLeftClose className='size-4' />
                </Button>
              </div>
              {panelBody}
            </aside>
          )}

          <Sheet open={panelSheetOpen} onOpenChange={setPanelSheetOpen}>
            <SheetContent side='left' className='w-[88vw] max-w-sm gap-3 p-3'>
              <SheetHeader className='gap-0'>
                <SheetTitle className='text-sm'>
                  {t('Infinite canvas')}
                </SheetTitle>
              </SheetHeader>
              {panelBody}
            </SheetContent>
          </Sheet>

          <CanvasBoard
            className='min-h-0 flex-1'
            nodes={board.nodes}
            viewport={board.viewport}
            selectedIds={selectedIds}
            busy={generating}
            onViewportChange={board.setViewport}
            onSelectionChange={(ids) => {
              setSelectedIds(ids)
              if (ids.length === 1) board.raiseNode(ids[0])
            }}
            onMoveNodes={handleMoveNodes}
            onRemoveNodes={(ids) => {
              board.removeNodes(ids)
              setSelectedIds((previous) =>
                previous.filter((id) => !ids.includes(id))
              )
            }}
            onChangeText={board.updateTextNode}
            onDuplicateNode={handleDuplicateNode}
            onResizeNode={board.setNodeWidth}
            onRegenerate={handleRegenerate}
            onUseAsReference={handleUseAsReference}
            onUseAsPrompt={(text) => {
              handleDraftChange({ prompt: text })
            }}
            onResize={handleResize}
            actions={
              <>
                {(isMobile ? !panelSheetOpen : !panelOpen) && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      if (isMobile) setPanelSheetOpen(true)
                      else setPanelOpen(true)
                    }}
                    aria-label={t('Expand panel')}
                  >
                    <PanelLeftOpen />
                  </Button>
                )}
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleAddNote}
                  aria-label={t('Add note')}
                >
                  <StickyNote />
                  <span className='max-sm:hidden'>{t('Add note')}</span>
                </Button>
                {board.nodes.length > 0 && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      board.clearNodes()
                      setSelectedIds([])
                    }}
                    aria-label={t('Clear canvas')}
                  >
                    <Trash2 />
                    <span className='max-sm:hidden'>{t('Clear canvas')}</span>
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
