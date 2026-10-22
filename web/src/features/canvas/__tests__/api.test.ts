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
import { describe, expect, it, vi } from 'vitest'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@/lib/api', () => ({
  api: { get, post: vi.fn() },
}))

const { editImage, generateImages, listImageModels } = await import('../api')

function mockPricing(rows: unknown[]) {
  get.mockResolvedValueOnce({ data: { success: true, data: rows } })
}

describe('listImageModels', () => {
  it('keeps only models that advertise image generation', async () => {
    mockPricing([
      {
        model_name: 'gpt-image-2',
        supported_endpoint_types: ['image-generation', 'openai'],
      },
      { model_name: 'gpt-4o', supported_endpoint_types: ['openai'] },
      { model_name: 'unknown-model' },
    ])

    await expect(listImageModels()).resolves.toEqual([{ name: 'gpt-image-2' }])
  })

  it('deduplicates repeated models and sorts them by name', async () => {
    mockPricing([
      {
        model_name: 'zeta-image',
        supported_endpoint_types: ['image-generation'],
      },
      {
        model_name: 'alpha-image',
        supported_endpoint_types: ['image-generation'],
      },
      {
        model_name: 'zeta-image',
        supported_endpoint_types: ['image-generation'],
      },
    ])

    await expect(listImageModels()).resolves.toEqual([
      { name: 'alpha-image' },
      { name: 'zeta-image' },
    ])
  })

  it('returns an empty list when the site publishes no pricing rows', async () => {
    mockPricing([])

    await expect(listImageModels()).resolves.toEqual([])
  })
})

describe('generateImages', () => {
  it('turns returned base64 payloads into data URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ b64_json: 'AAA' }, { b64_json: 'BBB' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      generateImages({
        apiKey: 'secret',
        model: 'gpt-image-2',
        prompt: 'a red cube',
        size: '1024x1024',
        count: 2,
      })
    ).resolves.toEqual([
      'data:image/png;base64,AAA',
      'data:image/png;base64,BBB',
    ])

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/v1/images/generations')
    expect(init.headers.Authorization).toBe('Bearer secret')
    expect(JSON.parse(init.body)).toEqual({
      model: 'gpt-image-2',
      prompt: 'a red cube',
      n: 2,
      size: '1024x1024',
    })
  })

  it('falls back to returned links when the relay sends no base64', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ url: 'https://example.test/a.png' }] }),
      })
    )

    await expect(
      generateImages({
        apiKey: 'secret',
        model: 'gpt-image-2',
        prompt: 'a red cube',
        size: '1024x1024',
        count: 1,
      })
    ).resolves.toEqual(['https://example.test/a.png'])
  })

  it('surfaces the relay error message when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'upstream exploded' } }),
      })
    )

    await expect(
      generateImages({
        apiKey: 'secret',
        model: 'gpt-image-2',
        prompt: 'a red cube',
        size: '1024x1024',
        count: 1,
      })
    ).rejects.toThrow('upstream exploded')
  })
})

describe('editImage', () => {
  it('uploads the reference as multipart and returns the result', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: async () => new Blob(['raw'], { type: 'image/png' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ b64_json: 'CCC' }] }),
      })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      editImage({
        apiKey: 'secret',
        model: 'gpt-image-2',
        prompt: 'make it blue',
        size: '1024x1024',
        count: 1,
        reference: 'data:image/png;base64,AAA',
      })
    ).resolves.toEqual(['data:image/png;base64,CCC'])

    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('/v1/images/edits')
    expect(init.headers.Authorization).toBe('Bearer secret')
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.body.get('prompt')).toBe('make it blue')
    expect(init.body.get('model')).toBe('gpt-image-2')
    expect(init.body.get('image')).toBeInstanceOf(Blob)
  })
})
