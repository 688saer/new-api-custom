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
import type {
  CanvasImageNode,
  CanvasNode,
  CanvasTextNode,
  CanvasViewport,
} from '../types'

const DATABASE_NAME = 'newapi-canvas'
const DATABASE_VERSION = 2
/** Small keys: the ordered node list and the camera. */
const BOARD_STORE = 'board'
const NODES_KEY = 'nodes'
const VIEWPORT_KEY = 'viewport'
/** One record per picture, keyed by node id, holding only the image bytes. */
const IMAGE_STORE = 'images'
/** Version 1 kept the whole board, pictures included, under this single key. */
const LEGACY_STORE = 'boards'
const LEGACY_KEY = 'default'

/** A node as stored: everything except the picture itself. */
type NodeMeta = Omit<CanvasImageNode, 'image'> | CanvasTextNode

/**
 * The layout as last seen, kept in synchronous storage.
 *
 * An IndexedDB transaction started from `pagehide` cannot commit before the
 * document is torn down, so a debounced edit that is still in memory when the
 * tab closes has nowhere to land. `localStorage` writes synchronously, so the
 * layout is mirrored there on every change and reconciled on the next load.
 * Pictures stay out of it: they are megabytes, and the quota is small.
 */
const JOURNAL_KEY = 'newapi-canvas:journal'

interface BoardJournal {
  nodes: NodeMeta[]
  viewport: CanvasViewport | null
}

export interface StoredBoard {
  nodes: CanvasNode[]
  viewport: CanvasViewport | null
}

/**
 * A storage failure the caller can act on. `quotaExceeded` means the browser
 * refused the bytes rather than failing for another reason, which is the one
 * case the operator can fix by deleting pictures.
 */
export class CanvasStorageError extends Error {
  readonly quotaExceeded: boolean

  constructor(message: string, quotaExceeded: boolean) {
    super(message)
    this.name = 'CanvasStorageError'
    this.quotaExceeded = quotaExceeded
  }
}

function asStorageError(error: unknown): CanvasStorageError {
  if (error instanceof CanvasStorageError) return error
  const name = (error as { name?: string } | null)?.name
  if (name === 'QuotaExceededError') {
    return new CanvasStorageError('Browser storage is full.', true)
  }
  const message = error instanceof Error ? error.message : String(error)
  return new CanvasStorageError(message, false)
}

/** Strip the picture out of a node so the layout record stays small. */
function toMeta(node: CanvasNode): NodeMeta {
  if (node.kind === 'text') return node
  return {
    kind: 'image',
    id: node.id,
    x: node.x,
    y: node.y,
    createdAt: node.createdAt,
    prompt: node.prompt,
    model: node.model,
    ...(node.parentId ? { parentId: node.parentId } : {}),
  }
}

/**
 * Move a version 1 board into the split stores.
 *
 * This runs inside the version-change transaction, so it either finishes with
 * the upgrade or not at all: an upgrade must never look like a wiped canvas.
 */
function upgrade(request: IDBOpenDBRequest): void {
  const database = request.result
  const transaction = request.transaction
  if (!transaction) return

  if (!database.objectStoreNames.contains(BOARD_STORE)) {
    database.createObjectStore(BOARD_STORE)
  }
  if (!database.objectStoreNames.contains(IMAGE_STORE)) {
    database.createObjectStore(IMAGE_STORE)
  }
  if (!database.objectStoreNames.contains(LEGACY_STORE)) return

  const read = transaction.objectStore(LEGACY_STORE).get(LEGACY_KEY)
  read.onsuccess = () => {
    const legacy = read.result as
      | { nodes?: CanvasNode[]; viewport?: CanvasViewport }
      | undefined
    const nodes = legacy?.nodes ?? []
    const board = transaction.objectStore(BOARD_STORE)
    const images = transaction.objectStore(IMAGE_STORE)

    board.put(nodes.map(toMeta), NODES_KEY)
    if (legacy?.viewport) board.put(legacy.viewport, VIEWPORT_KEY)
    for (const node of nodes) {
      if (node.kind === 'image') images.put(node.image, node.id)
    }
    // Drop the copy rather than pay for the same pictures twice.
    database.deleteObjectStore(LEGACY_STORE)
  }
}

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const factory = typeof window === 'undefined' ? undefined : window.indexedDB
    if (!factory) {
      reject(new CanvasStorageError('This browser has no IndexedDB.', false))
      return
    }
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => upgrade(request)
    request.onsuccess = () => {
      const database = request.result
      // Another tab is upgrading: let go so it is not blocked forever.
      database.onversionchange = () => {
        database.close()
        databasePromise = null
      }
      resolve(database)
    }
    request.onerror = () => reject(asStorageError(request.error))
    request.onblocked = () =>
      reject(
        new CanvasStorageError(
          'Another tab is holding the canvas database open.',
          false
        )
      )
  })

  // A failed open must not be cached, or the canvas stays broken for the rest
  // of the session.
  databasePromise.catch(() => {
    databasePromise = null
  })
  return databasePromise
}

/**
 * Run one transaction and settle only when it commits.
 *
 * Resolving on the request instead would report success while the write is
 * still pending, and closing the tab right then loses it.
 */
function runTransaction(
  database: IDBDatabase,
  storeNames: string[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction
    try {
      transaction = database.transaction(storeNames, mode)
    } catch (error) {
      reject(asStorageError(error))
      return
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(asStorageError(transaction.error))
    transaction.onabort = () => reject(asStorageError(transaction.error))
    try {
      work(transaction)
    } catch (error) {
      reject(asStorageError(error))
    }
  })
}

function readBoardRecord(
  database: IDBDatabase
): Promise<{ nodes: NodeMeta[]; viewport: CanvasViewport | null }> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction
    try {
      transaction = database.transaction(BOARD_STORE, 'readonly')
    } catch (error) {
      reject(asStorageError(error))
      return
    }
    const store = transaction.objectStore(BOARD_STORE)
    const nodesRequest = store.get(NODES_KEY)
    const viewportRequest = store.get(VIEWPORT_KEY)

    transaction.oncomplete = () =>
      resolve({
        nodes: (nodesRequest.result as NodeMeta[] | undefined) ?? [],
        viewport:
          (viewportRequest.result as CanvasViewport | undefined) ?? null,
      })
    transaction.onerror = () => reject(asStorageError(transaction.error))
    transaction.onabort = () => reject(asStorageError(transaction.error))
  })
}

function readImages(database: IDBDatabase): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction
    try {
      transaction = database.transaction(IMAGE_STORE, 'readonly')
    } catch (error) {
      reject(asStorageError(error))
      return
    }
    const store = transaction.objectStore(IMAGE_STORE)
    const keysRequest = store.getAllKeys()
    const valuesRequest = store.getAll()

    transaction.oncomplete = () => {
      const keys = (keysRequest.result as IDBValidKey[] | undefined) ?? []
      const values = (valuesRequest.result as string[] | undefined) ?? []
      const images = new Map<string, string>()
      for (let index = 0; index < keys.length; index += 1) {
        images.set(String(keys[index]), values[index])
      }
      resolve(images)
    }
    transaction.onerror = () => reject(asStorageError(transaction.error))
    transaction.onabort = () => reject(asStorageError(transaction.error))
  })
}

/** Ids of the pictures already stored, so a save only writes the new ones. */
function readImageKeys(database: IDBDatabase): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction
    try {
      transaction = database.transaction(IMAGE_STORE, 'readonly')
    } catch (error) {
      reject(asStorageError(error))
      return
    }
    const request = transaction.objectStore(IMAGE_STORE).getAllKeys()

    transaction.oncomplete = () =>
      resolve(
        new Set(
          ((request.result as IDBValidKey[] | undefined) ?? []).map(String)
        )
      )
    transaction.onerror = () => reject(asStorageError(transaction.error))
    transaction.onabort = () => reject(asStorageError(transaction.error))
  })
}

/**
 * The stored board, already recombined from its layout and picture records.
 *
 * A picture whose bytes are missing is dropped rather than restored as a
 * broken frame: there is nothing left to show and no way to tell what it was.
 */
export async function loadBoard(): Promise<StoredBoard> {
  const database = await openDatabase()
  const record = await readBoardRecord(database)
  const images = await readImages(database)

  // The journal is newer than the last committed transaction whenever the tab
  // was closed mid-edit, so it wins for the layout. Its pictures are already on
  // the board; their bytes come from the image store as usual.
  const journal = readJournal()
  const layout = journal?.nodes ?? record.nodes
  const viewport = journal?.viewport ?? record.viewport

  const nodes: CanvasNode[] = []
  for (const meta of layout) {
    if (meta.kind === 'text') {
      nodes.push(meta)
      continue
    }
    const image = images.get(meta.id)
    if (!image) continue
    nodes.push({ ...meta, image })
  }

  return { nodes, viewport }
}

function readJournal(): BoardJournal | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(JOURNAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BoardJournal
    return Array.isArray(parsed?.nodes) ? parsed : null
  } catch {
    // A corrupt journal is worth less than the last committed board.
    return null
  }
}

/**
 * Mirror the layout into synchronous storage.
 *
 * Called on every change, so it must stay cheap: no pictures, no formatting.
 * This is the only write that can survive a tab being closed immediately after
 * an edit, which is exactly when the newest picture would otherwise be lost.
 */
export function journalNodes(nodes: CanvasNode[]): void {
  writeJournal({
    nodes: nodes.map(toMeta),
    viewport: readJournal()?.viewport ?? null,
  })
}

export function journalViewport(viewport: CanvasViewport): void {
  writeJournal({ nodes: readJournal()?.nodes ?? [], viewport })
}

function writeJournal(journal: BoardJournal): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(journal))
  } catch {
    // A full or blocked localStorage must not break editing; IndexedDB is
    // still the durable copy and the debounced save still runs.
  }
}

/**
 * Store the layout and any picture that is not stored yet.
 *
 * Only additions are written. Rewriting every picture on each edit would double
 * the bytes a save needs at the worst moment — when the quota is nearly full —
 * so a moved node or one extra picture must not touch the others.
 */
export async function saveNodes(nodes: CanvasNode[]): Promise<void> {
  const database = await openDatabase()
  const stored = await readImageKeys(database)

  const images = nodes.filter(
    (node): node is CanvasImageNode => node.kind === 'image'
  )
  const wanted = new Set(images.map((node) => node.id))
  const additions = images.filter((node) => !stored.has(node.id))
  const removals = [...stored].filter((id) => !wanted.has(id))

  await runTransaction(
    database,
    [BOARD_STORE, IMAGE_STORE],
    'readwrite',
    (transaction) => {
      transaction.objectStore(BOARD_STORE).put(nodes.map(toMeta), NODES_KEY)
      const store = transaction.objectStore(IMAGE_STORE)
      for (const node of additions) store.put(node.image, node.id)
      for (const id of removals) store.delete(id)
    }
  )
}

/**
 * Keep one picture right away.
 *
 * A generated picture is the expensive part of the board and the part that
 * cannot be recreated from anything else, so it is committed the moment it
 * exists rather than waiting for the debounced save.
 */
export async function saveImage(id: string, image: string): Promise<void> {
  const database = await openDatabase()
  await runTransaction(database, [IMAGE_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(IMAGE_STORE).put(image, id)
  })
}

export async function saveViewport(viewport: CanvasViewport): Promise<void> {
  const database = await openDatabase()
  await runTransaction(database, [BOARD_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(BOARD_STORE).put(viewport, VIEWPORT_KEY)
  })
}
