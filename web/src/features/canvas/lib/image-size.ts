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

/** Pixels, in either direction, that a picture request may ask for. */
export const MIN_IMAGE_SIDE = 64
export const MAX_IMAGE_SIDE = 4096

/** A picture size offered in the panel, already in the relay's own unit. */
export interface ImageSizePreset {
  /** What the relay understands: `<width>x<height>`. */
  value: string
  width: number
  height: number
}

/**
 * Sizes the image relays in front of this console commonly accept. A relay that
 * only supports its own list still gets a valid `size`; the panel is not the
 * place to guess what an operator's upstream allows, so anything else is typed
 * by hand into the width/height fields.
 */
export const IMAGE_SIZE_PRESETS: readonly ImageSizePreset[] = [
  { value: '1024x1024', width: 1024, height: 1024 },
  { value: '1536x1024', width: 1536, height: 1024 },
  { value: '1024x1536', width: 1024, height: 1536 },
  { value: '1792x1024', width: 1792, height: 1024 },
  { value: '1024x1792', width: 1024, height: 1792 },
  { value: '512x512', width: 512, height: 512 },
]

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(Math.round(a))
  let right = Math.abs(Math.round(b))
  while (right > 0) {
    const remainder = left % right
    left = right
    right = remainder
  }
  return left || 1
}

/** Read `<width>x<height>`, the form every image relay accepts. */
export function parseImageSize(
  value: string
): { width: number; height: number } | null {
  const match = /^\s*(\d{1,5})\s*[x×*]\s*(\d{1,5})\s*$/i.exec(value ?? '')
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

/** True when both sides sit inside the range an image model will accept. */
export function isImageSideInRange(width: number, height: number): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= MIN_IMAGE_SIDE &&
    width <= MAX_IMAGE_SIDE &&
    height >= MIN_IMAGE_SIDE &&
    height <= MAX_IMAGE_SIDE
  )
}

/** The `size` value for a pair of sides, or an empty string when unusable. */
export function imageSizeValue(width: string, height: string): string {
  const parsed = parseImageSize(`${width}x${height}`)
  if (!parsed || !isImageSideInRange(parsed.width, parsed.height)) return ''
  return `${parsed.width}x${parsed.height}`
}

/** `1024 × 1024`, for anything the operator reads. */
export function formatImageSize(width: number, height: number): string {
  return `${Math.round(width)} × ${Math.round(height)}`
}

/** `3:2`, `1:1`, and so on: the shape people actually recognise. */
export function aspectLabel(width: number, height: number): string {
  if (width <= 0 || height <= 0) return ''
  const divisor = greatestCommonDivisor(width, height)
  const left = Math.round(width / divisor)
  const right = Math.round(height / divisor)
  // A ratio reduced past readability ("1792:1024" would be fine, "1024:683" is
  // not) is easier to grasp as a decimal.
  if (left > 32 || right > 32) {
    return `${(width / height).toFixed(2)}:1`
  }
  return `${left}:${right}`
}

/** One line describing a size for a picker row: `1024 × 1024 · 1:1`. */
export function describeImageSize(width: number, height: number): string {
  return `${formatImageSize(width, height)} · ${aspectLabel(width, height)}`
}

/**
 * The size a request should ask for, given the draft's two side fields. Falls
 * back to the panel's square default only when both fields are untouched, so a
 * half-typed custom size never silently becomes 1024x1024.
 */
export function draftImageSize(width: string, height: string): string {
  const value = imageSizeValue(width, height)
  if (!value) return ''
  return value
}
