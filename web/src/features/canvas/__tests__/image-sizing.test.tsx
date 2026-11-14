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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { CanvasBoard } from '../components/canvas-board'
import { CanvasImageNode } from '../components/canvas-image-node'
import {
  CanvasPromptPanel,
  type CanvasDraft,
} from '../components/canvas-prompt-panel'
import { aspectLabel, imageSizeValue, parseImageSize } from '../lib/image-size'
import type { CanvasImageNode as CanvasImageNodeData } from '../types'

vi.mock('../api', () => ({
  listApiKeys: () =>
    Promise.resolve([{ id: 1, name: 'main', status: 1 }] as const),
  listImageModels: () => Promise.resolve([{ name: 'gpt-image-2' }] as const),
}))

function draft(overrides: Partial<CanvasDraft> = {}): CanvasDraft {
  return {
    apiKeyId: '1',
    model: 'gpt-image-2',
    sizeWidth: '1024',
    sizeHeight: '1024',
    count: '1',
    prompt: 'a cat asleep on a keyboard',
    ...overrides,
  }
}

function showPanel(initial: CanvasDraft) {
  // The panel is controlled by the workspace, so the harness has to hold the
  // draft for a keystroke to be visible in the next render.
  function Harness() {
    const [draft, setDraft] = useState(initial)
    return (
      <CanvasPromptPanel
        draft={draft}
        onDraftChange={(patch) => {
          setDraft((previous) => ({ ...previous, ...patch }))
        }}
        generating={false}
        reference={null}
        onClearReference={vi.fn()}
        onGenerate={vi.fn()}
      />
    )
  }

  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Harness />
    </QueryClientProvider>
  )
}

describe('image size parsing', () => {
  it('reads every separator a relay accepts and rejects anything else', () => {
    expect(parseImageSize('1024x1024')).toEqual({ width: 1024, height: 1024 })
    expect(parseImageSize(' 1536 × 1024 ')).toEqual({
      width: 1536,
      height: 1024,
    })
    expect(parseImageSize('1024*768')).toEqual({ width: 1024, height: 768 })
    expect(parseImageSize('1024')).toBeNull()
    expect(parseImageSize('widex1024')).toBeNull()
    expect(parseImageSize('0x1024')).toBeNull()
  })

  it('describes a size as the shape people recognise', () => {
    expect(aspectLabel(1536, 1024)).toBe('3:2')
    expect(aspectLabel(1024, 1024)).toBe('1:1')
    expect(aspectLabel(1792, 1024)).toBe('7:4')
  })

  it('refuses a side the model cannot draw', () => {
    expect(imageSizeValue('1536', '1024')).toBe('1536x1024')
    expect(imageSizeValue('32', '1024')).toBe('')
    expect(imageSizeValue('8192', '1024')).toBe('')
    expect(imageSizeValue('', '1024')).toBe('')
  })
})

describe('prompt panel size fields', () => {
  it('shows the requested pair as a ratio and as what will be sent', () => {
    showPanel(draft({ sizeWidth: '1536', sizeHeight: '1024' }))

    expect(screen.getByText('3:2')).toBeVisible()
    expect(screen.getByText('Sends 1536x1024 to the model.')).toBeVisible()
  })

  it('blocks generating while a side is out of range and says why', () => {
    showPanel(draft())

    fireEvent.change(screen.getByLabelText('Width'), {
      target: { value: '9999' },
    })

    expect(
      screen.getByText(
        'Width and height must be whole numbers between 64 and 4096.'
      )
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
  })
})

describe('picture node sizing', () => {
  it('labels the picture with the size the request asked for', () => {
    const node: CanvasImageNodeData = {
      kind: 'image',
      id: 'img-1',
      x: 0,
      y: 0,
      image: 'data:image/png;base64,AAAA',
      prompt: 'a cat asleep on a keyboard',
      model: 'gpt-image-2',
      size: '1792x1024',
      createdAt: 0,
    }

    render(
      <CanvasImageNode
        node={node}
        selected={false}
        onDragStart={vi.fn()}
        onRemove={vi.fn()}
        onDuplicate={vi.fn()}
        onRegenerate={vi.fn()}
        onUseAsReference={vi.fn()}
        onResize={vi.fn()}
      />
    )

    expect(screen.getByText('1792 × 1024')).toBeVisible()
  })
})

describe('board zoom control', () => {
  it('returns the camera to 100% around the middle of the view', () => {
    const onViewportChange = vi.fn()

    render(
      <CanvasBoard
        nodes={[]}
        viewport={{ x: 100, y: 50, zoom: 2 }}
        selectedIds={[]}
        onViewportChange={onViewportChange}
        onSelectionChange={vi.fn()}
        onMoveNodes={vi.fn()}
        onRemoveNodes={vi.fn()}
        onChangeText={vi.fn()}
        onDuplicateNode={vi.fn()}
        onResizeNode={vi.fn()}
        onRegenerate={vi.fn()}
        onUseAsReference={vi.fn()}
        onUseAsPrompt={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom to 100%' }))

    expect(onViewportChange).toHaveBeenCalledWith({ zoom: 1, x: 50, y: 25 })
  })
})
