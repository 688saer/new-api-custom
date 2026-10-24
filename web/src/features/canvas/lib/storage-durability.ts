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
 * How long the browser intends to keep what the board writes.
 *
 * `best-effort` is not a warning about a small quota: it means the browser has
 * told us it may drop this origin's storage on its own. WebKit does exactly
 * that for every script-writable store, IndexedDB included, once Safari has
 * been used for seven days without a visit to the site, so a board left in that
 * state disappears for a reason the operator can neither see nor undo.
 */
export type StorageDurability = 'persisted' | 'best-effort' | 'unknown'

export interface StorageHealth {
  durability: StorageDurability
  /** Bytes the origin already uses, when the browser reports it. */
  usage: number | null
  /** Bytes the origin may use, when the browser reports it. */
  quota: number | null
}

const UNKNOWN: StorageHealth = {
  durability: 'unknown',
  usage: null,
  quota: null,
}

/** Browsers answer the same question repeatedly; asking once is enough. */
const RECHECK_INTERVAL_MS = 5000

let lastResult: StorageHealth | null = null
let lastCheckAt = 0

function toBytes(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Ask the browser to keep this origin's storage, and report what it answered.
 *
 * Never throws: a browser without the Storage API, a private window, or a
 * refusal all have to leave the canvas usable, just with less protection.
 */
export async function ensurePersistentStorage(): Promise<StorageHealth> {
  const now = Date.now()
  if (lastResult && now - lastCheckAt < RECHECK_INTERVAL_MS) return lastResult
  lastCheckAt = now

  const manager =
    typeof navigator === 'undefined' ? undefined : navigator.storage
  if (!manager || typeof manager.persist !== 'function') {
    lastResult = UNKNOWN
    return lastResult
  }

  // `persisted()` first: asking again for storage that is already persistent
  // would be a no-op at best and a fresh permission prompt at worst.
  const granted =
    typeof manager.persisted === 'function'
      ? await manager.persisted().catch(() => false)
      : false
  const durable = granted ? true : await manager.persist().catch(() => false)

  const estimate =
    typeof manager.estimate === 'function'
      ? await manager.estimate().catch(() => null)
      : null

  lastResult = {
    durability: durable ? 'persisted' : 'best-effort',
    usage: toBytes(estimate?.usage),
    quota: toBytes(estimate?.quota),
  }
  return lastResult
}
