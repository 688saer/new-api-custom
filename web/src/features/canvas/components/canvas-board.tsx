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
import { Loader2, Maximize, Minus, Plus } from 'lucide-react'
import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { DEFAULT_VIEWPORT } from '../hooks/use-canvas-board'
import type { CanvasImageNode, CanvasNode, CanvasViewport } from '../types'
import { CanvasImageNode as CanvasImageNodeView } from './canvas-image-node'
import { CanvasTextNode } from './canvas-text-node'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 3
/** Spacing of the background dots, in board units. */
const GRID_SIZE = 24

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

interface CanvasBoardProps {
  nodes: CanvasNode[]
  viewport: CanvasViewport
  selectedId: string | null
  onViewportChange: (viewport: CanvasViewport) => void
  onSelect: (id: string | null) => void
  onMoveNode: (id: string, x: number, y: number) => void
  onRemoveNode: (id: string) => void
  onChangeText: (id: string, text: string) => void
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
 * Drag the empty surface to pan, scroll to zoom around the pointer.
 */
export function CanvasBoard(props: CanvasBoardProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const latest = useRef(props)

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
      const nextZoom = clampZoom(viewport.zoom * Math.exp(-event.deltaY * 0.0015))
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

  useEffect(() => {
    const element = containerRef.current
    if (!element || !props.onResize) return
    const observer = new ResizeObserver(() => {
      props.onResize?.({
        width: element.clientWidth,
        height: element.clientHeight,
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [props.onResize])

  const handlePanStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return
    // Pressing the empty surface clears the selection.
    props.onSelect(null)

    const element = event.currentTarget
    const startX = event.clientX
    const startY = event.clientY
    const originX = props.viewport.x
    const originY = props.viewport.y
    element.setPointerCapture(event.pointerId)

    const handlePanMove = (moveEvent: PointerEvent) => {
      props.onViewportChange({
        zoom: props.viewport.zoom,
        x: originX + (moveEvent.clientX - startX),
        y: originY + (moveEvent.clientY - startY),
      })
    }

    const handlePanEnd = () => {
      element.removeEventListener('pointermove', handlePanMove)
      element.removeEventListener('pointerup', handlePanEnd)
      element.removeEventListener('pointercancel', handlePanEnd)
    }

    element.addEventListener('pointermove', handlePanMove)
    element.addEventListener('pointerup', handlePanEnd)
    element.addEventListener('pointercancel', handlePanEnd)
  }

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

  return (
    <div
      ref={containerRef}
      className={cn(
        'bg-muted/30 relative overflow-hidden rounded-lg border',
        'cursor-grab active:cursor-grabbing',
        props.className
      )}
      onPointerDown={handlePanStart}
      role='application'
      aria-label={t('Image canvas')}
      style={{
        backgroundImage:
          'radial-gradient(var(--border) 1px, transparent 1px)',
        backgroundSize: `${GRID_SIZE * props.viewport.zoom}px ${GRID_SIZE * props.viewport.zoom}px`,
        backgroundPosition: `${props.viewport.x}px ${props.viewport.y}px`,
      }}
    >
      <div
        className='absolute top-0 left-0 origin-top-left'
        style={{
          transform: `translate(${props.viewport.x}px, ${props.viewport.y}px) scale(${props.viewport.zoom})`,
        }}
      >
        {props.nodes.map((node) => {
          if (node.kind === 'text') {
            return (
              <CanvasTextNode
                key={node.id}
                node={node}
                zoom={props.viewport.zoom}
                selected={props.selectedId === node.id}
                onMove={props.onMoveNode}
                onSelect={props.onSelect}
                onRemove={props.onRemoveNode}
                onChange={props.onChangeText}
                onUseAsPrompt={props.onUseAsPrompt}
              />
            )
          }

          return (
            <CanvasImageNodeView
              key={node.id}
              node={node}
              zoom={props.viewport.zoom}
              selected={props.selectedId === node.id}
              onMove={props.onMoveNode}
              onSelect={props.onSelect}
              onRemove={props.onRemoveNode}
              onRegenerate={props.onRegenerate}
              onUseAsReference={props.onUseAsReference}
            />
          )
        })}
      </div>

      {props.nodes.length === 0 && !props.busy && (
        <div className='pointer-events-none absolute inset-0 flex items-center justify-center px-6'>
          <p className='text-muted-foreground max-w-xs text-center text-sm'>
            {t('The canvas is empty. Write a prompt, then press Generate.')}
          </p>
        </div>
      )}

      {props.busy && (
        <div className='bg-background/70 absolute inset-0 flex flex-col items-center justify-center gap-3 backdrop-blur-[1px]'>
          <Loader2 className='text-primary size-7 animate-spin' aria-hidden='true' />
          <p className='text-sm font-medium'>{t('Drawing...')}</p>
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
          onClick={() => props.onViewportChange(DEFAULT_VIEWPORT)}
          aria-label={t('Reset view')}
        >
          <Maximize className='size-4' />
        </Button>
      </div>
    </div>
  )
}
