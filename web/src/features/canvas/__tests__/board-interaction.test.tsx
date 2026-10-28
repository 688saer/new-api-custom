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
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CanvasBoard } from '../components/canvas-board'
import type { CanvasImageNode, CanvasTextNode } from '../types'

function imageNode(id: string, x: number, y: number): CanvasImageNode {
  return {
    kind: 'image',
    id,
    x,
    y,
    image: 'data:image/png;base64,AAAA',
    prompt: `prompt ${id}`,
    model: 'gpt-image-2',
    createdAt: 0,
  }
}

function textNode(
  id: string,
  x: number,
  y: number,
  text = 'parked idea'
): CanvasTextNode {
  return { kind: 'text', id, x, y, text, createdAt: 0 }
}

const NODES = [
  imageNode('a', 0, 0),
  imageNode('b', 400, 0),
  textNode('n', 0, 600),
  // An empty note opens in its editor, which is the case the drag handle exists
  // for.
  textNode('e', 0, 0, ''),
]

function showBoard(selectedIds: string[]) {
  const onSelectionChange = vi.fn()
  const onMoveNodes = vi.fn()
  const onRemoveNodes = vi.fn()

  render(
    <CanvasBoard
      nodes={NODES}
      viewport={{ x: 0, y: 0, zoom: 1 }}
      selectedIds={selectedIds}
      onViewportChange={vi.fn()}
      onSelectionChange={onSelectionChange}
      onMoveNodes={onMoveNodes}
      onRemoveNodes={onRemoveNodes}
      onChangeText={vi.fn()}
      onDuplicateNode={vi.fn()}
      onRegenerate={vi.fn()}
      onUseAsReference={vi.fn()}
      onUseAsPrompt={vi.fn()}
    />
  )

  return { onSelectionChange, onMoveNodes, onRemoveNodes }
}

function frameOf(id: string): HTMLElement {
  const frame = document.querySelector<HTMLElement>(
    `[data-canvas-node="${id}"]`
  )
  if (!frame) throw new Error(`no frame for ${id}`)
  return frame
}

describe('canvas board dragging', () => {
  it('moves every selected node by the same offset', () => {
    const { onMoveNodes } = showBoard(['a', 'b'])

    fireEvent.pointerDown(frameOf('a'), {
      button: 0,
      clientX: 100,
      clientY: 100,
    })
    fireEvent.pointerMove(window, { clientX: 150, clientY: 130 })

    expect(onMoveNodes).toHaveBeenCalledWith([
      { id: 'a', x: 50, y: 30 },
      { id: 'b', x: 450, y: 30 },
    ])

    fireEvent.pointerUp(window)
  })

  it('selects a node that is dragged while something else is selected', () => {
    const { onSelectionChange } = showBoard(['b'])

    fireEvent.pointerDown(frameOf('a'), { button: 0, clientX: 10, clientY: 10 })

    // Dragging an unselected node takes the selection, so the drag acts on
    // what the pointer is holding rather than on the old selection.
    expect(onSelectionChange).toHaveBeenCalledWith(['a'])

    fireEvent.pointerUp(window)
  })

  it('starts a drag from a note body, which is where an operator grabs it', () => {
    const { onMoveNodes } = showBoard([])

    // The note's own text button covers the whole card, so swallowing the press
    // there would leave a note with nothing to drag by.
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Edit note' }), {
      button: 0,
      clientX: 40,
      clientY: 40,
    })
    fireEvent.pointerMove(window, { clientX: 70, clientY: 60 })

    expect(onMoveNodes).toHaveBeenCalledWith([{ id: 'n', x: 30, y: 620 }])

    fireEvent.pointerUp(window)
  })

  it('drags a note by its handle while the note is being typed into', () => {
    const { onMoveNodes } = showBoard([])

    // A fresh note opens straight into its editor, and the textarea keeps the
    // press so text selection still works. The handle is the way out.
    const handle = document.querySelector<HTMLElement>(
      '[data-canvas-drag-handle="e"]'
    )
    if (!handle) throw new Error('no drag handle for the empty note')

    fireEvent.pointerDown(handle, { button: 0, clientX: 500, clientY: 700 })
    fireEvent.pointerMove(window, { clientX: 540, clientY: 730 })

    expect(onMoveNodes).toHaveBeenCalledWith([{ id: 'e', x: 40, y: 30 }])

    fireEvent.pointerUp(window)
  })
})

describe('canvas board selection', () => {
  it('clears the selection when the empty surface is pressed', () => {
    const { onSelectionChange } = showBoard(['a'])

    fireEvent.pointerDown(screen.getByRole('application'), {
      button: 0,
      clientX: 600,
      clientY: 400,
    })
    fireEvent.pointerUp(window)

    expect(onSelectionChange).toHaveBeenCalledWith([])
  })

  it('offers a way to delete the whole selection once more than one is picked', () => {
    const { onRemoveNodes } = showBoard(['a', 'b'])

    fireEvent.click(screen.getByRole('button', { name: 'Delete image' }))

    expect(onRemoveNodes).toHaveBeenCalledWith(['a', 'b'])
  })
})
