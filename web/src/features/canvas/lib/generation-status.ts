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

/**
 * Drawings that are still waiting for their pictures, counted outside React.
 *
 * The request keeps running when the operator opens another page, so a count
 * held in the canvas component would drop to zero the moment that component
 * unmounts: coming back would then show an idle panel while the picture is
 * still being drawn. Counting here keeps the answer the same on every page.
 */
let pending = 0

const listeners = new Set<() => void>()

export function startGeneration(): void {
  pending += 1
  announce()
}

export function finishGeneration(): void {
  pending = Math.max(0, pending - 1)
  announce()
}

export function pendingGenerations(): number {
  return pending
}

export function subscribeGenerations(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function announce(): void {
  for (const listener of listeners) listener()
}
