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
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OwnFeatures } from '../components/sections/own-features'

function renderSection() {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(
    <RouterContextProvider router={router}>
      <OwnFeatures />
    </RouterContextProvider>
  )
}

describe('own feature entries', () => {
  it('lists every module this deployment adds', () => {
    renderSection()

    const items = within(screen.getByRole('list')).getAllByRole('listitem')

    expect(items).toHaveLength(9)
  })

  it('links each routed module to its page', () => {
    renderSection()

    expect(screen.getByRole('link', { name: /Lucky draw/ })).toHaveAttribute(
      'href',
      '/lottery'
    )
    expect(screen.getByRole('link', { name: /My rewards/ })).toHaveAttribute(
      'href',
      '/rewards'
    )
    expect(
      screen.getByRole('link', { name: /Channel availability/ })
    ).toHaveAttribute('href', '/service-status')
  })

  it('does not pretend to link a module configured elsewhere', () => {
    renderSection()

    expect(
      screen.queryByRole('link', { name: /Geetest verification/ })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Geetest verification')).toBeInTheDocument()
  })
})
