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
import { api } from '@/lib/api'

import type { CanvasApiKey, CanvasImageModel } from './types'

type Envelope<T> = {
  success: boolean
  message?: string
  data?: T
}

type TokenPage = {
  items?: CanvasApiKey[]
}

type PricingRow = {
  model_name?: string
  supported_endpoint_types?: string[]
}

type ImageGenerationResponse = {
  data?: { b64_json?: string; url?: string }[]
  error?: { message?: string }
}

/** The endpoint type that marks a model as able to produce images. */
const IMAGE_ENDPOINT_TYPE = 'image-generation'

/** Every enabled API key the caller owns. */
export async function listApiKeys(): Promise<CanvasApiKey[]> {
  const res = await api.get('/api/token/?p=0&size=100')
  const body = res.data as Envelope<TokenPage>
  return body?.data?.items ?? []
}

/** The unmasked secret of one key, needed to authorize the drawing request. */
export async function revealApiKey(id: number): Promise<string> {
  const res = await api.post(`/api/token/${id}/key`)
  const body = res.data as Envelope<{ key?: string }>
  return body?.data?.key ?? ''
}

/**
 * Models the caller can draw with. `/api/pricing` is already narrowed to the
 * caller's group, so this mirrors what the site offers instead of every model
 * any channel happens to declare.
 */
export async function listImageModels(): Promise<CanvasImageModel[]> {
  const res = await api.get('/api/pricing')
  const body = res.data as Envelope<PricingRow[]>
  const seen = new Set<string>()
  const models: CanvasImageModel[] = []

  for (const row of body?.data ?? []) {
    const name = (row.model_name ?? '').trim()
    if (!name || seen.has(name)) continue
    const endpoints = row.supported_endpoint_types ?? []
    if (!endpoints.includes(IMAGE_ENDPOINT_TYPE)) continue
    seen.add(name)
    models.push({ name })
  }

  return models.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Draw with this site's relay endpoint. The relay authenticates with an API key
 * rather than the console session, so this bypasses the shared client and its
 * cookie-based refresh handling. Relays answer with base64 payloads or, for
 * some models, a short-lived link; both work as an `<img>` source.
 */
export async function generateImages(params: {
  apiKey: string
  model: string
  prompt: string
  size: string
  count: number
  signal?: AbortSignal
}): Promise<string[]> {
  const response = await fetch('/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      n: params.count,
      size: params.size,
    }),
    signal: params.signal,
  })

  const body = (await response.json().catch(() => null)) as
    | ImageGenerationResponse
    | null

  if (!response.ok) {
    throw new Error(body?.error?.message ?? `HTTP ${response.status}`)
  }

  return readImageResults(body)
}

/** Turn a data URL or a remote link into bytes the edit endpoint accepts. */
async function toImageBlob(source: string): Promise<Blob> {
  const response = await fetch(source)
  if (!response.ok) throw new Error('Could not read the reference image.')
  return response.blob()
}

/**
 * Draw a variation of an existing picture. The relay expects multipart here, so
 * the reference is uploaded as a real image part rather than a URL.
 */
export async function editImage(params: {
  apiKey: string
  model: string
  prompt: string
  size: string
  count: number
  /** Board node the variation should be based on. */
  reference: string
  signal?: AbortSignal
}): Promise<string[]> {
  const form = new FormData()
  form.append('model', params.model)
  form.append('prompt', params.prompt)
  form.append('n', String(params.count))
  form.append('size', params.size)
  form.append('image', await toImageBlob(params.reference), 'reference.png')

  const response = await fetch('/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.apiKey}` },
    body: form,
    signal: params.signal,
  })

  const body = (await response.json().catch(() => null)) as
    | ImageGenerationResponse
    | null

  if (!response.ok) {
    throw new Error(body?.error?.message ?? `HTTP ${response.status}`)
  }

  return readImageResults(body)
}

/** Base64 payloads win when present; otherwise fall back to returned links. */
function readImageResults(body: ImageGenerationResponse | null): string[] {
  const base64 = (body?.data ?? [])
    .map((item) => item.b64_json)
    .filter((item): item is string => Boolean(item))

  if (base64.length > 0) {
    return base64.map((item) => `data:image/png;base64,${item}`)
  }

  const remote = (body?.data ?? [])
    .map((item) => item.url)
    .filter((item): item is string => Boolean(item))

  if (remote.length > 0) return remote
  throw new Error(body?.error?.message ?? 'The site returned no image.')
}