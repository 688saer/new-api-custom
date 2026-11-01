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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  finishGeneration,
  pendingGenerations,
  startGeneration,
  subscribeGenerations,
} from '../lib/generation-status'

beforeEach(() => {
  // The count lives for the whole session, so start each case from zero.
  while (pendingGenerations() > 0) finishGeneration()
})

describe('canvas generation status', () => {
  it('counts drawings until each one finishes', () => {
    expect(pendingGenerations()).toBe(0)

    startGeneration()
    startGeneration()
    expect(pendingGenerations()).toBe(2)

    finishGeneration()
    expect(pendingGenerations()).toBe(1)
  })

  it('never counts below zero', () => {
    finishGeneration()

    expect(pendingGenerations()).toBe(0)
  })

  it('tells subscribers whenever the count changes', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeGenerations(listener)

    startGeneration()
    finishGeneration()

    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    startGeneration()
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
