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
import type { WelfareApiItem } from '../types'

/**
 * Card accent palettes. Picked by a stable hash of the entry so a card keeps
 * the same colour across reloads without the operator configuring it.
 */
const ACCENTS = [
  'from-sky-500/20 to-cyan-500/5 text-sky-600 dark:text-sky-400',
  'from-violet-500/20 to-fuchsia-500/5 text-violet-600 dark:text-violet-400',
  'from-emerald-500/20 to-teal-500/5 text-emerald-600 dark:text-emerald-400',
  'from-amber-500/20 to-orange-500/5 text-amber-600 dark:text-amber-400',
  'from-rose-500/20 to-pink-500/5 text-rose-600 dark:text-rose-400',
]

export function welfareAccentFor(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000
  }
  return ACCENTS[hash % ACCENTS.length]
}

/**
 * Split the comma separated model field into displayable names.
 */
export function splitWelfareModels(model: string): string[] {
  return model
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function maskWelfareKey(value: string): string {
  if (value.length <= 10) {
    return `${value.slice(0, 3)}••••`
  }
  return `${value.slice(0, 6)}••••••••${value.slice(-4)}`
}

/**
 * Build a ready-to-run curl sample for one welfare API entry.
 */
export function buildCurlSample(item: WelfareApiItem): string {
  const endpoint = `${item.base_url.replace(/\/+$/, '')}/chat/completions`
  const model = splitWelfareModels(item.model)[0] ?? 'your-model'
  const key = item.api_key || '$WELFARE_API_KEY'
  return [
    `curl ${endpoint} \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Authorization: Bearer ${key}" \\`,
    `  -d '{"model":"${model}","messages":[{"role":"user","content":"Hello"}]}'`,
  ].join('\n')
}
