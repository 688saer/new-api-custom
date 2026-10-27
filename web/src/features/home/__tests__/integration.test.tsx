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
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Integration } from '../components/sections/integration'

const BASE_URL = 'https://gateway.example.com/v1'
const DOCS_URL = 'https://docs.example.com'

function renderSection() {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(
    <RouterContextProvider router={router}>
      <Integration baseUrl={BASE_URL} docsUrl={DOCS_URL} />
    </RouterContextProvider>
  )
}

describe('integration section', () => {
  it('shows the deployment base URL and links to the docs', () => {
    renderSection()

    expect(screen.getByText(BASE_URL)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Read the docs/ })).toHaveAttribute(
      'href',
      DOCS_URL
    )
  })

  it('starts on the first protocol with a Python sample', () => {
    renderSection()

    expect(screen.getByRole('tab', { name: 'OpenAI' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByText('request.py')).toBeInTheDocument()
  })

  it('switches the code sample to another protocol', async () => {
    renderSection()

    await userEvent.click(screen.getByRole('tab', { name: 'Anthropic' }))

    expect(screen.getByRole('tab', { name: 'Anthropic' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByText(/from anthropic import Anthropic/)).toBeVisible()
  })

  it('switches the code sample between Python and cURL', async () => {
    renderSection()

    await userEvent.click(screen.getByRole('button', { name: 'cURL' }))

    expect(screen.getByText('request.sh')).toBeInTheDocument()
    expect(
      screen.getByText(/curl "https:\/\/gateway\.example\.com/)
    ).toBeVisible()
  })

  it('offers copy controls for the base URL and the sample', () => {
    renderSection()

    expect(
      screen.getByRole('button', { name: 'Copy base URL' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Copy code sample' })
    ).toBeInTheDocument()
  })
})
