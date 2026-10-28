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
import { CopyPlus, GripHorizontal, Send, Trash2 } from 'lucide-react'
import { useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import type { CanvasTextNode as CanvasTextNodeData } from '../types'
import { CanvasNodeFrame } from './canvas-node-frame'

/** Width of a note in board units. */
const TEXT_NODE_WIDTH = 260

interface CanvasTextNodeProps {
  node: CanvasTextNodeData
  selected: boolean
  onDragStart: (id: string, event: ReactPointerEvent<HTMLDivElement>) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onChange: (id: string, text: string) => void
  /** Move this note's text into the prompt box to draw from it. */
  onUseAsPrompt: (text: string) => void
  /** Reports the painted size so track lines can anchor to this node. */
  onMeasure?: (id: string, width: number, height: number) => void
}

/** A free-form note for parking prompts and ideas next to the pictures. */
export function CanvasTextNode(props: CanvasTextNodeProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(props.node.text.length === 0)

  return (
    <CanvasNodeFrame
      id={props.node.id}
      x={props.node.x}
      y={props.node.y}
      width={TEXT_NODE_WIDTH}
      selected={props.selected}
      onDragStart={props.onDragStart}
      onMeasure={props.onMeasure}
    >
      <div
        data-canvas-drag-handle={props.node.id}
        className='text-muted-foreground flex cursor-grab touch-none items-center justify-center border-b py-0.5 active:cursor-grabbing'
      >
        <GripHorizontal className='size-3.5' aria-hidden='true' />
      </div>
      {editing ? (
        <Textarea
          autoFocus
          value={props.node.text}
          onChange={(event) =>
            props.onChange(props.node.id, event.target.value)
          }
          onBlur={() => setEditing(false)}
          onPointerDown={(event) => event.stopPropagation()}
          placeholder={t('Write a note')}
          className='min-h-24 resize-none rounded-none border-0 shadow-none focus-visible:ring-0'
          aria-label={t('Note')}
        />
      ) : (
        <button
          type='button'
          className='w-full px-3 py-2.5 text-left text-sm whitespace-pre-wrap'
          onDoubleClick={() => setEditing(true)}
          aria-label={t('Edit note')}
        >
          {props.node.text || t('Write a note')}
        </button>
      )}
      <div
        className='flex items-center justify-end gap-1 border-t px-2 py-1.5'
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Button
          variant='ghost'
          size='icon'
          className='size-6'
          onClick={() => props.onUseAsPrompt(props.node.text)}
          disabled={props.node.text.trim().length === 0}
          aria-label={t('Use as prompt')}
        >
          <Send className='size-3.5' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='size-6'
          onClick={() => props.onDuplicate(props.node.id)}
          aria-label={t('Duplicate node')}
        >
          <CopyPlus className='size-3.5' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='text-destructive hover:text-destructive size-6'
          onClick={() => props.onRemove(props.node.id)}
          aria-label={t('Delete note')}
        >
          <Trash2 className='size-3.5' />
        </Button>
      </div>
    </CanvasNodeFrame>
  )
}
