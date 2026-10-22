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
  Download,
  ImagePlus,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import type { CanvasImageNode as CanvasImageNodeData } from '../types'
import { CanvasNodeFrame } from './canvas-node-frame'

/** Width of an image node in board units; the picture keeps its aspect ratio. */
export const IMAGE_NODE_WIDTH = 320

interface CanvasImageNodeProps {
  node: CanvasImageNodeData
  zoom: number
  selected: boolean
  onMove: (id: string, x: number, y: number) => void
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  /** Draw another picture with this node's prompt and model. */
  onRegenerate: (node: CanvasImageNodeData) => void
  /** Draw a variation, using this picture as the reference. */
  onUseAsReference: (node: CanvasImageNodeData) => void
  /** Reports the painted size so track lines can anchor to this node. */
  onMeasure?: (id: string, width: number, height: number) => void
}

/** One generated picture, with the actions that make iterating quick. */
export function CanvasImageNode(props: CanvasImageNodeProps) {
  const { t } = useTranslation()

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = props.node.image
    link.download = `canvas-${props.node.id}.png`
    link.click()
  }

  return (
    <CanvasNodeFrame
      id={props.node.id}
      x={props.node.x}
      y={props.node.y}
      width={IMAGE_NODE_WIDTH}
      zoom={props.zoom}
      selected={props.selected}
      onMove={props.onMove}
      onSelect={props.onSelect}
      onMeasure={props.onMeasure}
    >
      <img
        src={props.node.image}
        alt={props.node.prompt}
        className='pointer-events-none block w-full select-none'
        draggable={false}
      />
      <div
        className='flex items-center gap-1 border-t px-2 py-1.5'
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p
          className='text-muted-foreground min-w-0 flex-1 truncate text-xs'
          title={props.node.prompt}
        >
          {props.node.prompt}
        </p>
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
          <DropdownMenuContent align='end' className='w-44'>
            <DropdownMenuItem onClick={() => props.onRegenerate(props.node)}>
              <RefreshCw />
              {t('Regenerate')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.onUseAsReference(props.node)}>
              <ImagePlus />
              {t('Use as reference')}
            </DropdownMenuItem>
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
    </CanvasNodeFrame>
  )
}
