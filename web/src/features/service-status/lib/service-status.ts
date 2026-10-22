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
  ServiceStatusCell,
  ServiceStatusColor,
  ServiceStatusRange,
} from '../types'

/** Time windows offered by the range switcher, in display order. */
export const SERVICE_STATUS_RANGES: ServiceStatusRange[] = [
  '60m',
  '24h',
  '7d',
  '30d',
]

/** i18n key for each range label. */
export const SERVICE_STATUS_RANGE_LABELS: Record<ServiceStatusRange, string> = {
  '60m': 'Last 60 minutes',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

/** Tailwind background class for a bucket colour. */
export function serviceStatusBarClass(color: ServiceStatusColor): string {
  switch (color) {
    case 'green':
      return 'bg-emerald-500'
    case 'yellow':
      return 'bg-amber-500'
    case 'red':
      return 'bg-rose-500'
    default:
      return 'bg-muted-foreground/25'
  }
}

/** Tailwind text class for a bucket colour. */
export function serviceStatusTextClass(color: ServiceStatusColor): string {
  switch (color) {
    case 'green':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'yellow':
      return 'text-amber-600 dark:text-amber-400'
    case 'red':
      return 'text-rose-600 dark:text-rose-400'
    default:
      return 'text-muted-foreground'
  }
}

/** Tailwind dot class for a bucket colour. */
export function serviceStatusDotClass(color: ServiceStatusColor): string {
  switch (color) {
    case 'green':
      return 'bg-emerald-500'
    case 'yellow':
      return 'bg-amber-500'
    case 'red':
      return 'bg-rose-500'
    default:
      return 'bg-muted-foreground/40'
  }
}

/** i18n key describing a bucket colour. */
export function serviceStatusColorLabel(color: ServiceStatusColor): string {
  switch (color) {
    case 'green':
      return 'Operational'
    case 'yellow':
      return 'Degraded'
    case 'red':
      return 'Outage'
    default:
      return 'No data'
  }
}

/** i18n key for a billing mode. */
export function serviceStatusBillingLabel(mode: string): string {
  switch (mode) {
    case 'per_call':
      return 'Per call'
    case 'per_image':
      return 'Per image'
    case 'per_second':
      return 'Per second'
    default:
      return 'Token based'
  }
}

/** i18n key for a probe endpoint kind. */
export function serviceStatusEndpointLabel(endpoint: string): string {
  switch (endpoint) {
    case 'anthropic':
      return 'Messages (/v1/messages)'
    case 'openai-response':
      return 'Responses (/v1/responses)'
    default:
      return 'Chat Completions (/v1/chat/completions)'
  }
}

/** Format a millisecond latency for display, or an em dash when unknown. */
export function formatServiceStatusLatency(value: number): string {
  if (!value || value <= 0) {
    return '—'
  }
  if (value < 1000) {
    return `${Math.round(value)} ms`
  }
  return `${(value / 1000).toFixed(2)} s`
}

/** Format a percentage with one decimal place. */
export function formatServiceStatusPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return '—'
  }
  return `${value.toFixed(1)}%`
}

/**
 * Collapse a bucket list into at most `maxBlocks` blocks so the uptime bar
 * keeps a readable width on narrow screens. Adjacent buckets are merged by
 * summing probe counts, which preserves the overall success ratio.
 */
export function collapseServiceStatusCells(
  cells: ServiceStatusCell[],
  maxBlocks: number
): ServiceStatusCell[] {
  if (cells.length <= maxBlocks || maxBlocks < 1) {
    return cells
  }

  const groupSize = Math.ceil(cells.length / maxBlocks)
  const collapsed: ServiceStatusCell[] = []

  for (let start = 0; start < cells.length; start += groupSize) {
    const slice = cells.slice(start, start + groupSize)
    const probeCount = slice.reduce((sum, cell) => sum + cell.probe_count, 0)
    const successCount = slice.reduce((sum, cell) => sum + cell.success_count, 0)

    let status: ServiceStatusColor = 'gray'
    if (probeCount > 0) {
      if (successCount === probeCount) {
        status = 'green'
      } else if (successCount === 0) {
        status = 'red'
      } else {
        status = 'yellow'
      }
    }

    const successRate = probeCount > 0 ? (successCount / probeCount) * 100 : 0
    collapsed.push({
      timestamp: slice[0].timestamp,
      status,
      probe_count: probeCount,
      success_count: successCount,
      success_rate: successRate,
      error_rate: probeCount > 0 ? 100 - successRate : 0,
      avg_latency: 0,
      p50_latency: 0,
      p90_latency: 0,
      first_token_latency: 0,
    })
  }

  return collapsed
}
