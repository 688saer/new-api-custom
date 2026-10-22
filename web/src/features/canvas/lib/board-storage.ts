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
import type { CanvasBoard } from '../types'

const DATABASE_NAME = 'newapi-canvas'
const STORE_NAME = 'boards'
const BOARD_KEY = 'default'

/**
 * The board holds generated pictures as data URLs, which outgrow the few
 * megabytes localStorage allows after a couple of images, so it lives in
 * IndexedDB instead. Everything stays on this device.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function runRequest<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode)
        const request = action(transaction.objectStore(STORE_NAME))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        transaction.oncomplete = () => database.close()
        transaction.onabort = () => database.close()
      })
  )
}

/** The stored board, or null when this browser has none yet. */
export function loadBoard(): Promise<CanvasBoard | null> {
  return runRequest<CanvasBoard | undefined>('readonly', (store) =>
    store.get(BOARD_KEY)
  ).then((board) => board ?? null)
}

/** Replace the stored board with the current one. */
export function saveBoard(board: CanvasBoard): Promise<void> {
  return runRequest('readwrite', (store) => store.put(board, BOARD_KEY)).then(
    () => undefined
  )
}
