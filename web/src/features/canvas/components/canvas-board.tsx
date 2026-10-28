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
import { Grid3x3, Loader2, Maximize, Minus, Plus, Trash2 } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { DEFAULT_VIEWPORT } from '../hooks/use-canvas-board'
import { buildConnectors, type NodeSize } from '../lib/connectors'
import {
  contentBounds,
  fitViewport,
  GRID_SIZE,
  MAX_ZOOM,
  MIN_ZOOM,
  nodesInRect,
  rectFromPoints,
  snapDrag,
  unionBounds,
  type BoardRect,
  type SnapGuide,
} from '../lib/selection'
import type { CanvasImageNode, CanvasNode, CanvasViewport } from '../types'
import { CanvasConnectorLayer } from './canvas-connectors'
import { CanvasMarquee, CanvasSnapGuides } from './canvas-guides'
import { CanvasImageNode as CanvasImageNodeView } from './canvas-image-node'
import { CanvasTextNode } from './canvas-text-node'

/** A node position after a drag, in board units. */
export interface NodeMove {
  id: string
  x: number
  y: number
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

interface CanvasBoardProps {
  nodes: CanvasNode[]
  viewport: CanvasViewport
  selectedIds: string[]
  onViewportChange: (viewport: CanvasViewport) => void
  onSelectionChange: (ids: string[]) => void
  onMoveNodes: (moves: NodeMove[]) => void
  onRemoveNodes: (ids: string[]) => void
  onChangeText: (id: string, text: string) => void
  onDuplicateNode: (id: string) => void
  onRegenerate: (node: CanvasImageNode) => void
  onUseAsReference: (node: CanvasImageNode) => void
  onUseAsPrompt: (text: string) => void
  /** Reports the visible area so the caller can centre new images in it. */
  onResize?: (size: { width: number; height: number }) => void
  /** True while a picture is being drawn, to show progress over the board. */
  busy?: boolean
  /** Rendered in the top-right corner, e.g. the board actions. */
  actions?: ReactNode
  className?: string
}

/**
 * The board itself: a pannable, zoomable surface holding pictures and notes.
 *
 * Drag on empty space to band-select; drag a node to move it, and everything
 * else selected with it. Scroll to zoom around the pointer, hold Space to pan.
 * A dragged node lines up with its neighbours' edges and centres, and the board
 * shows the line it snapped to.
 */
export function CanvasBoard(props: CanvasBoardProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  // Sizes drive the track lines and the marquee, so they live here rather than
  // in the nodes: a node cannot know where its parent ended up.
  const [sizes, setSizes] = useState<Record<string, NodeSize>>({})
  const sizesRef = useRef(sizes)
  sizesRef.current = sizes

  const [marquee, setMarquee] = useState<BoardRect | null>(null)
  const [guides, setGuides] = useState<SnapGuide[]>([])
  const [grid, setGrid] = useState(true)
  const gridRef = useRef(grid)
  gridRef.current = grid
  const [panning, setPanning] = useState(false)
  const spaceRef = useRef(false)
  const [spaceHeld, setSpaceHeld] = useState(false)

  const handleMeasure = useCallback(
    (id: string, width: number, height: number) => {
      if (width <= 0 || height <= 0) return
      setSizes((previous) => {
        const current = previous[id]
        if (current && current.width === width && current.height === height) {
          return previous
        }
        return { ...previous, [id]: { width, height } }
      })
    },
    []
  )

  const connectors = useMemo(
    () => buildConnectors(props.nodes, sizes, props.selectedIds),
    [props.nodes, sizes, props.selectedIds]
  )

  useEffect(() => {
    latest.current = props
  })

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const { viewport, onViewportChange } = latest.current
      const rect = element.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const nextZoom = clampZoom(
        viewport.zoom * Math.exp(-event.deltaY * 0.0015)
      )
      const ratio = nextZoom / viewport.zoom

      // Keep whatever sits under the pointer pinned while the scale changes.
      onViewportChange({
        zoom: nextZoom,
        x: pointerX - (pointerX - viewport.x) * ratio,
        y: pointerY - (pointerY - viewport.y) * ratio,
      })
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [])

  // Space is the pan modifier, so it must not scroll the page while held.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      if (typing) return
      event.preventDefault()
      if (!spaceRef.current) {
        spaceRef.current = true
        setSpaceHeld(true)
      }
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      spaceRef.current = false
      setSpaceHeld(false)
    }
    const handleBlur = () => {
      spaceRef.current = false
      setSpaceHeld(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  // Report the painted size so the workspace can place new nodes and frame the
  // content. Reading the callback from `latest` keeps the observer attached
  // across renders instead of tearing it down on every new closure.
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      latest.current.onResize?.({
        width: element.clientWidth,
        height: element.clientHeight,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  /** Screen point to board coordinates, for both the band and drag deltas. */
  const toBoard = useCallback((clientX: number, clientY: number) => {
    const element = containerRef.current
    const { viewport } = latest.current
    if (!element) return { x: 0, y: 0 }
    const rect = element.getBoundingClientRect()
    return {
      x: (clientX - rect.left - viewport.x) / viewport.zoom,
      y: (clientY - rect.top - viewport.y) / viewport.zoom,
    }
  }, [])

  const handlePanStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    const startX = event.clientX
    const startY = event.clientY
    const originX = latest.current.viewport.x
    const originY = latest.current.viewport.y
    element.setPointerCapture?.(event.pointerId)
    setPanning(true)

    const handlePanMove = (moveEvent: PointerEvent) => {
      latest.current.onViewportChange({
        zoom: latest.current.viewport.zoom,
        x: originX + (moveEvent.clientX - startX),
        y: originY + (moveEvent.clientY - startY),
      })
    }

    const handlePanEnd = () => {
      setPanning(false)
      element.removeEventListener('pointermove', handlePanMove)
      element.removeEventListener('pointerup', handlePanEnd)
      element.removeEventListener('pointercancel', handlePanEnd)
    }

    element.addEventListener('pointermove', handlePanMove)
    element.addEventListener('pointerup', handlePanEnd)
    element.addEventListener('pointercancel', handlePanEnd)
  }

  const handleMarqueeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    const start = toBoard(event.clientX, event.clientY)
    // A plain press on empty space drops the selection; a modified one keeps it
    // so several bands can be added together.
    if (!additive) latest.current.onSelectionChange([])
    setMarquee({ x: start.x, y: start.y, width: 0, height: 0 })
    element.setPointerCapture?.(event.pointerId)

    const handleMarqueeMove = (moveEvent: PointerEvent) => {
      const point = toBoard(moveEvent.clientX, moveEvent.clientY)
      setMarquee(rectFromPoints(start.x, start.y, point.x, point.y))
    }

    const handleMarqueeEnd = (endEvent: PointerEvent) => {
      const point = toBoard(endEvent.clientX, endEvent.clientY)
      const band = rectFromPoints(start.x, start.y, point.x, point.y)
      const current = latest.current
      // A press that never moved is a click on empty space, which has already
      // cleared the selection.
      if (band.width >= 2 || band.height >= 2) {
        const hit = nodesInRect(current.nodes, sizesRef.current, band)
        if (additive) {
          const merged = new Set([...current.selectedIds, ...hit])
          current.onSelectionChange([...merged])
        } else {
          current.onSelectionChange(hit)
        }
      }
      setMarquee(null)
      element.removeEventListener('pointermove', handleMarqueeMove)
      element.removeEventListener('pointerup', handleMarqueeEnd)
      element.removeEventListener('pointercancel', handleMarqueeEnd)
    }

    element.addEventListener('pointermove', handleMarqueeMove)
    element.addEventListener('pointerup', handleMarqueeEnd)
    element.addEventListener('pointercancel', handleMarqueeEnd)
  }

  const handleSurfacePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>
  ) => {
    if (event.button === 1 || spaceRef.current) {
      event.preventDefault()
      handlePanStart(event)
      return
    }
    if (event.button !== 0) return
    handleMarqueeStart(event)
  }

  /**
   * Move every selected node together. The node the pointer holds leads, and
   * its neighbours follow by the same delta, so a group keeps its arrangement
   * however far it is dragged.
   */
  const handleNodeDragStart = useCallback(
    (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      const current = latest.current
      const ids = current.selectedIds.includes(id) ? current.selectedIds : [id]
      if (!current.selectedIds.includes(id)) {
        current.onSelectionChange([id])
      }

      const origins = new Map<string, { x: number; y: number }>()
      for (const node of current.nodes) {
        if (ids.includes(node.id)) {
          origins.set(node.id, { x: node.x, y: node.y })
        }
      }
      const union = unionBounds(current.nodes, sizesRef.current, ids)
      const others = current.nodes
        .filter((node) => !origins.has(node.id))
        .flatMap((node) => {
          const size = sizesRef.current[node.id]
          if (!size) return []
          return [
            { x: node.x, y: node.y, width: size.width, height: size.height },
          ]
        })

      const zoom = current.viewport.zoom
      const startX = event.clientX
      const startY = event.clientY

      const handleDragMove = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - startX) / zoom
        const dy = (moveEvent.clientY - startY) / zoom
        let shiftX = dx
        let shiftY = dy

        if (union) {
          const snapped = snapDrag({
            moving: {
              x: union.x + dx,
              y: union.y + dy,
              width: union.width,
              height: union.height,
            },
            others,
            grid: gridRef.current ? GRID_SIZE : null,
          })
          shiftX = snapped.x - union.x
          shiftY = snapped.y - union.y
          setGuides(snapped.guides)
        }

        latest.current.onMoveNodes(
          [...origins].map(([nodeId, origin]) => ({
            id: nodeId,
            x: origin.x + shiftX,
            y: origin.y + shiftY,
          }))
        )
      }

      const handleDragEnd = () => {
        setGuides([])
        window.removeEventListener('pointermove', handleDragMove)
        window.removeEventListener('pointerup', handleDragEnd)
        window.removeEventListener('pointercancel', handleDragEnd)
      }

      window.addEventListener('pointermove', handleDragMove)
      window.addEventListener('pointerup', handleDragEnd)
      window.addEventListener('pointercancel', handleDragEnd)
    },
    []
  )

  const zoomAround = (factor: number) => {
    const element = containerRef.current
    if (!element) return
    const centerX = element.clientWidth / 2
    const centerY = element.clientHeight / 2
    const nextZoom = clampZoom(props.viewport.zoom * factor)
    const ratio = nextZoom / props.viewport.zoom

    props.onViewportChange({
      zoom: nextZoom,
      x: centerX - (centerX - props.viewport.x) * ratio,
      y: centerY - (centerY - props.viewport.y) * ratio,
    })
  }

  /** Frame every node, which is what an operator wants after panning away. */
  const fitContent = () => {
    const element = containerRef.current
    if (!element) return
    const bounds = contentBounds(props.nodes, sizes)
    const next = fitViewport(bounds, {
      width: element.clientWidth,
      height: element.clientHeight,
    })
    props.onViewportChange(next ?? DEFAULT_VIEWPORT)
  }

  const selectedCount = props.selectedIds.length

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-muted/20 relative overflow-hidden',
        panning || spaceHeld ? 'cursor-grabbing' : 'cursor-default',
        props.className
      )}
      onPointerDown={handleSurfacePointerDown}
      role='application'
      aria-label={t('Image canvas')}
      style={{
        backgroundImage: grid
          ? 'radial-gradient(var(--border) 1px, transparent 1px)'
          : undefined,
        backgroundSize: grid
          ? `${GRID_SIZE * props.viewport.zoom}px ${GRID_SIZE * props.viewport.zoom}px`
          : undefined,
        backgroundPosition: grid
          ? `${props.viewport.x}px ${props.viewport.y}px`
          : undefined,
      }}
    >
      <div
        className='absolute top-0 left-0 origin-top-left'
        style={{
          transform: `translate(${props.viewport.x}px, ${props.viewport.y}px) scale(${props.viewport.zoom})`,
        }}
      >
        <CanvasConnectorLayer connectors={connectors} />
        <CanvasSnapGuides guides={guides} />

        {props.nodes.map((node) => {
          if (node.kind === 'text') {
            return (
              <CanvasTextNode
                key={node.id}
                node={node}
                selected={props.selectedIds.includes(node.id)}
                onDragStart={handleNodeDragStart}
                onRemove={(id) => props.onRemoveNodes([id])}
                onDuplicate={props.onDuplicateNode}
                onChange={props.onChangeText}
                onUseAsPrompt={props.onUseAsPrompt}
                onMeasure={handleMeasure}
              />
            )
          }

          return (
            <CanvasImageNodeView
              key={node.id}
              node={node}
              selected={props.selectedIds.includes(node.id)}
              onDragStart={handleNodeDragStart}
              onRemove={(id) => props.onRemoveNodes([id])}
              onDuplicate={props.onDuplicateNode}
              onRegenerate={props.onRegenerate}
              onUseAsReference={props.onUseAsReference}
              onMeasure={handleMeasure}
            />
          )
        })}
      </div>

      {marquee && <CanvasMarquee rect={marquee} viewport={props.viewport} />}

      {selectedCount > 1 && (
        <div
          className='bg-background/95 absolute top-3 left-3 flex items-center gap-1 rounded-lg border py-1 pr-1 pl-2.5 shadow-sm'
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className='text-xs font-medium tabular-nums'>
            {t('{{count}} selected', { count: selectedCount })}
          </span>
          <Button
            variant='ghost'
            size='icon'
            className='text-destructive hover:text-destructive size-6'
            onClick={() => props.onRemoveNodes(props.selectedIds)}
            aria-label={t('Delete image')}
          >
            <Trash2 className='size-3.5' />
          </Button>
        </div>
      )}

      {props.nodes.length === 0 && !props.busy && (
        <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-6'>
          <p className='text-muted-foreground max-w-xs text-center text-sm'>
            {t('The canvas is empty. Write a prompt, then press Generate.')}
          </p>
          <p className='text-muted-foreground/80 max-w-xs text-center text-xs'>
            {t('Scroll to zoom. Hold Space and drag to pan.')}
          </p>
        </div>
      )}

      {props.busy && (
        <div className='bg-background/70 absolute inset-0 flex flex-col items-center justify-center gap-3 backdrop-blur-[1px]'>
          <Loader2
            className='text-primary size-7 animate-spin'
            aria-hidden='true'
          />
          <p className='text-sm font-medium'>{t('Generating...')}</p>
          <p className='text-muted-foreground text-xs'>
            {t('A large image can take up to a minute.')}
          </p>
        </div>
      )}

      {props.actions && (
        <div
          className='absolute top-3 right-3 flex items-center gap-2'
          onPointerDown={(event) => event.stopPropagation()}
        >
          {props.actions}
        </div>
      )}

      <div
        className='bg-background/90 absolute right-3 bottom-3 flex items-center gap-1 rounded-lg border p-1 shadow-sm'
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Button
          variant='ghost'
          size='icon'
          className='size-7'
          onClick={() => setGrid((previous) => !previous)}
          aria-pressed={grid}
          aria-label={t('Show grid')}
        >
          <Grid3x3 className='size-4' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='size-7'
          onClick={() => zoomAround(1 / 1.2)}
          aria-label={t('Zoom out')}
        >
          <Minus className='size-4' />
        </Button>
        <span className='text-muted-foreground w-11 text-center text-xs tabular-nums'>
          {Math.round(props.viewport.zoom * 100)}%
        </span>
        <Button
          variant='ghost'
          size='icon'
          className='size-7'
          onClick={() => zoomAround(1.2)}
          aria-label={t('Zoom in')}
        >
          <Plus className='size-4' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='size-7'
          onClick={fitContent}
          aria-label={t('Fit to content')}
        >
          <Maximize className='size-4' />
        </Button>
      </div>
    </div>
  )
}
