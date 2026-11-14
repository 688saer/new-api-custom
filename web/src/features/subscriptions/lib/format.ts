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
import type { TFunction } from 'i18next'

import dayjs from '@/lib/dayjs'
import { formatCompactNumber } from '@/lib/format'

import type { SubscriptionPlan } from '../types'

export function formatDuration(
  plan: Partial<SubscriptionPlan>,
  t: TFunction
): string {
  const unit = plan?.duration_unit || 'month'
  const value = plan?.duration_value || 1
  const unitLabels: Record<string, string> = {
    year: t('years'),
    month: t('months'),
    day: t('days'),
    hour: t('hours'),
    custom: t('Custom (seconds)'),
  }
  if (unit === 'custom') {
    const seconds = plan?.custom_seconds || 0
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('days')}`
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('hours')}`
    return `${seconds} ${t('seconds')}`
  }
  return `${value} ${unitLabels[unit] || unit}`
}

export function formatResetPeriod(
  plan: Partial<SubscriptionPlan>,
  t: TFunction
): string {
  const period = plan?.quota_reset_period || 'never'
  if (period === 'daily') return t('Daily')
  if (period === 'weekly') return t('Weekly')
  if (period === 'monthly') return t('Monthly')
  if (period === 'custom') {
    const seconds = Number(plan?.quota_reset_custom_seconds || 0)
    if (seconds >= 86400) return `${Math.floor(seconds / 86400)} ${t('days')}`
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} ${t('hours')}`
    if (seconds >= 60) return `${Math.floor(seconds / 60)} ${t('minutes')}`
    return `${seconds} ${t('seconds')}`
  }
  return t('No Reset')
}

/**
 * Validity one on-demand allowance refill costs, in seconds: the plan's own
 * reset period, so a daily plan spends a day and a weekly plan spends a week.
 * Zero means the plan never resets and has nothing to refill.
 */
export function getResetPeriodSeconds(
  plan: Partial<SubscriptionPlan> | undefined
): number {
  const period = plan?.quota_reset_period || 'never'
  if (period === 'daily') return 86400
  if (period === 'weekly') return 7 * 86400
  if (period === 'monthly') return 30 * 86400
  if (period === 'custom') {
    return Math.max(0, Number(plan?.quota_reset_custom_seconds || 0))
  }
  return 0
}

/** Whole days one refill costs, e.g. 604800 seconds -> 7 days. */
export function getResetPeriodDays(
  plan: Partial<SubscriptionPlan> | undefined
): number {
  const seconds = getResetPeriodSeconds(plan)
  return seconds > 0 ? Math.max(1, Math.ceil(seconds / 86400)) : 0
}

export function formatTimestamp(ts: number): string {
  if (!ts) return '-'
  return dayjs(ts * 1000).format('YYYY-MM-DD HH:mm:ss')
}

/** Whole days a card still runs, rounded up, and zero once it has ended. */
export function getDaysRemaining(endTime: number, nowSeconds: number): number {
  if (!endTime || endTime <= nowSeconds) return 0
  return Math.ceil((endTime - nowSeconds) / 86400)
}

/**
 * Renders a token allowance, e.g. 200000000 → "200M tokens" (or "2亿 tokens" in
 * Chinese). An empty string means the plan does not cap tokens.
 */
export function formatTokenAllowance(
  tokens: number,
  t: TFunction,
  locale?: Intl.LocalesArgument
): string {
  if (!tokens || tokens <= 0) return ''
  return t('{{value}} tokens', {
    value: formatCompactNumber(tokens, locale),
  })
}

/** Share of the token allowance already spent, clamped to 0-100. */
export function getTokenUsagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)))
}

/** True when the plan caps tokens and the current period's allowance is gone. */
export function isTokenAllowanceExhausted(
  used: number,
  limit: number
): boolean {
  return limit > 0 && used >= limit
}

/** Remaining tokens for the current period, or 0 when the plan is uncapped. */
export function getRemainingTokens(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.max(0, limit - used)
}
