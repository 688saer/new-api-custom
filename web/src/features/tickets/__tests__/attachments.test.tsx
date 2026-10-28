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
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TicketAttachmentList } from '../components/ticket-attachments'
import type { TicketAttachment } from '../types'

const attachment: TicketAttachment = {
  id: 7,
  ticket_id: 12,
  message_id: 3,
  file_name: 'screenshot.png',
  mime_type: 'image/png',
  size: 75,
  created_at: 1793174000,
}

const createObjectURL = vi.fn(() => 'blob:ticket-image')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  Object.assign(URL, { createObjectURL, revokeObjectURL })
})

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL')
  Reflect.deleteProperty(URL, 'revokeObjectURL')
})

describe('ticket attachments', () => {
  it('renders the image fetched through the caller loader', async () => {
    // 读图接口要令牌，所以必须走 loader 拿字节，不能用 <img src> 直接请求
    const load = vi.fn(async () => new Blob(['png'], { type: 'image/png' }))

    render(<TicketAttachmentList attachments={[attachment]} loadImage={load} />)

    const image = await screen.findByRole('img', { name: 'screenshot.png' })
    expect(load).toHaveBeenCalledWith(7)
    expect(image).toHaveAttribute('src', 'blob:ticket-image')
    expect(screen.queryByText('Image unavailable')).not.toBeInTheDocument()
  })

  it('shows the placeholder when the loader is rejected', async () => {
    // 无令牌时接口返回 401，这里必须退化成占位图而不是空白
    const load = vi.fn(async () => {
      throw new Error('401')
    })

    render(<TicketAttachmentList attachments={[attachment]} loadImage={load} />)

    expect(await screen.findByText('Image unavailable')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows the placeholder when the response is not an image', async () => {
    const load = vi.fn(
      async () => new Blob(['{}'], { type: 'application/json' })
    )

    render(<TicketAttachmentList attachments={[attachment]} loadImage={load} />)

    expect(await screen.findByText('Image unavailable')).toBeInTheDocument()
  })

  it('renders nothing when the message has no attachment', () => {
    const load = vi.fn(async () => new Blob([], { type: 'image/png' }))

    const { container } = render(
      <TicketAttachmentList attachments={[]} loadImage={load} />
    )

    expect(container).toBeEmptyDOMElement()
    expect(load).not.toHaveBeenCalled()
  })
})
