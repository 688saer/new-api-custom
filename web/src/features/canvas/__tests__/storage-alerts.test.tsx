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
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CanvasStorageAlerts } from '../components/canvas-storage-alerts'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('canvas storage alerts', () => {
  it('stays quiet while the browser keeps the data', () => {
    render(
      <CanvasStorageAlerts
        failure={null}
        storage={{ durability: 'persisted', usage: 10, quota: 100 }}
        hasNodes
      />
    )

    expect(screen.queryByTestId('canvas-storage-alert')).not.toBeInTheDocument()
  })

  it('warns that the browser may drop the board when storage is best-effort', () => {
    render(
      <CanvasStorageAlerts
        failure={null}
        storage={{ durability: 'best-effort', usage: 10, quota: 100 }}
        hasNodes
      />
    )

    expect(screen.getByTestId('canvas-storage-alert')).toHaveTextContent(
      /can delete stored canvas data/i
    )
  })

  it('does not warn on an empty board', () => {
    render(
      <CanvasStorageAlerts
        failure={null}
        storage={{ durability: 'best-effort', usage: 0, quota: 100 }}
        hasNodes={false}
      />
    )

    expect(screen.queryByTestId('canvas-storage-alert')).not.toBeInTheDocument()
  })

  it('tells the operator to free space when the quota is full', () => {
    render(
      <CanvasStorageAlerts
        failure={{ operation: 'write', quotaExceeded: true }}
        storage={{ durability: 'persisted', usage: 100, quota: 100 }}
        hasNodes
      />
    )

    expect(screen.getByTestId('canvas-storage-alert')).toHaveTextContent(
      /storage is full/i
    )
  })

  it('says a failed save only lasts until the page closes', () => {
    render(
      <CanvasStorageAlerts
        failure={{ operation: 'write', quotaExceeded: false }}
        storage={null}
        hasNodes
      />
    )

    expect(screen.getByTestId('canvas-storage-alert')).toHaveTextContent(
      /could not be saved/i
    )
  })

  it('reports an unreadable saved board', () => {
    render(
      <CanvasStorageAlerts
        failure={{ operation: 'read', quotaExceeded: false }}
        storage={null}
        hasNodes={false}
      />
    )

    expect(screen.getByTestId('canvas-storage-alert')).toHaveTextContent(
      /could not be restored/i
    )
  })
})
