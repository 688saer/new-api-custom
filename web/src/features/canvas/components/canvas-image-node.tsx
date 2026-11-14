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
import {
  CopyPlus,
  Download,
  ImagePlus,
  Maximize2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { formatImageSize, parseImageSize } from '../lib/image-size'
import type { CanvasImageNode as CanvasImageNodeData } from '../types'
import { CanvasNodeFrame } from './canvas-node-frame'

/** Width of an image node in board units when the node asks for none. */
export const DEFAULT_IMAGE_NODE_WIDTH = 320

/** Preview widths a node can take. The picture keeps its aspect ratio. */
const PREVIEW_WIDTHS = [240, 320, 448]

interface CanvasImageNodeProps {
  node: CanvasImageNodeData
  selected: boolean
  onDragStart: (id: string, event: ReactPointerEvent<HTMLDivElement>) => void
  onRemove: (id: string) => void
  /** Copy this picture onto the board beside the original. */
  onDuplicate: (id: string) => void
  /** Draw another picture with this node's prompt and model. */
  onRegenerate: (node: CanvasImageNodeData) => void
  /** Draw a variation, using this picture as the reference. */
  onUseAsReference: (node: CanvasImageNodeData) => void
  /** Change how large this picture sits on the board. */
  onResize: (id: string, width: number) => void
  /** Reports the painted size so track lines can anchor to this node. */
  onMeasure?: (id: string, width: number, height: number) => void
}

/** One generated picture, with the actions that make iterating quick. */
export function CanvasImageNode(props: CanvasImageNodeProps) {
  const { t } = useTranslation()
  // What the relay actually returned, which is not always what was asked for.
  const [loaded, setLoaded] = useState<{
    width: number
    height: number
  } | null>(null)

  const requested = props.node.size ? parseImageSize(props.node.size) : null
  const width = props.node.width ?? DEFAULT_IMAGE_NODE_WIDTH
  let pixelLabel = ''
  if (loaded) {
    pixelLabel = formatImageSize(loaded.width, loaded.height)
  } else if (requested) {
    pixelLabel = formatImageSize(requested.width, requested.height)
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = props.node.image
    link.download = `canvas-${props.node.id}${pixelLabel ? `-${pixelLabel.replace(' × ', 'x')}` : ''}.png`
    link.click()
  }

  const handleResize = (next: string) => {
    const parsed = Number(next)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    props.onResize(props.node.id, parsed)
  }

  return (
    <CanvasNodeFrame
      id={props.node.id}
      x={props.node.x}
      y={props.node.y}
      width={width}
      selected={props.selected}
      onDragStart={props.onDragStart}
      onMeasure={props.onMeasure}
    >
      <div className='relative'>
        <img
          src={props.node.image}
          alt={props.node.prompt}
          className='pointer-events-none block w-full select-none'
          draggable={false}
          onLoad={(event) =>
            setLoaded({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })
          }
        />
        {pixelLabel && (
          <span className='bg-background/85 text-muted-foreground absolute top-1 right-1 rounded px-1 py-0.5 text-[10px] tabular-nums'>
            {pixelLabel}
          </span>
        )}
      </div>
      {/* The caption is part of the grab area: only the controls on it keep the
          press, so a picture can be picked up anywhere except its buttons. */}
      <div className='flex items-center gap-1 border-t px-2 py-1.5'>
        <p
          className='text-muted-foreground min-w-0 flex-1 truncate text-xs'
          title={props.node.prompt}
        >
          {props.node.prompt}
        </p>
        <div
          className='flex shrink-0 items-center gap-1'
          onPointerDown={(event) => event.stopPropagation()}
        >
          <CopyButton
            value={props.node.prompt}
            size='icon'
            className='size-6'
            iconClassName='size-3.5'
            tooltip={t('Copy prompt')}
          />
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              render={
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-6'
                  aria-label={t('Image actions')}
                />
              }
            >
              <MoreHorizontal className='size-3.5' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-48'>
              <DropdownMenuItem onClick={() => props.onRegenerate(props.node)}>
                <RefreshCw />
                {t('Regenerate')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => props.onUseAsReference(props.node)}
              >
                <ImagePlus />
                {t('Use as reference')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => props.onDuplicate(props.node.id)}
              >
                <CopyPlus />
                {t('Duplicate node')}
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Maximize2 />
                  {t('Preview size')}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={String(width)}
                    onValueChange={handleResize}
                  >
                    {PREVIEW_WIDTHS.map((step) => (
                      <DropdownMenuRadioItem key={step} value={String(step)}>
                        {t('{{width}} px', { width: step })}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={handleDownload}>
                <Download />
                {t('Download image')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant='destructive'
                onClick={() => props.onRemove(props.node.id)}
              >
                <Trash2 />
                {t('Delete image')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </CanvasNodeFrame>
  )
}
