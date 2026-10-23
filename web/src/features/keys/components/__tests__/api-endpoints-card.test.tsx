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
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { STATUS_QUERY_KEY, type StatusData } from '@/lib/status-query'

import { ApiEndpointsCard } from '../api-endpoints-card'

let client: QueryClient

beforeEach(() => {
  localStorage.clear()
  client = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } },
  })
})

afterEach(() => {
  cleanup()
  client.clear()
})

function renderCard(status: Partial<StatusData>) {
  client.setQueryData(STATUS_QUERY_KEY, status as StatusData)
  return render(
    <QueryClientProvider client={client}>
      <ApiEndpointsCard />
    </QueryClientProvider>
  )
}

describe('api endpoints card', () => {
  it('shows the configured server address when it is publicly reachable', () => {
    renderCard({ server_address: 'https://api.example.com' })

    expect(screen.getByText('https://api.example.com')).toBeInTheDocument()
  })

  it('marks the first address as the recommended base URL', () => {
    renderCard({ server_address: 'https://api.example.com' })

    expect(screen.getByText('Recommended')).toBeInTheDocument()
  })

  it('renders the page origin when the deployment has no address configured', () => {
    renderCard({ server_address: '' })

    expect(screen.getByText(window.location.origin)).toBeInTheDocument()
  })

  it('renders a copy control for every address', () => {
    renderCard({ server_address: 'https://api.example.com' })

    expect(
      screen.getByRole('button', { name: /copy api url/i })
    ).toBeInTheDocument()
  })
})
