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
import type { WheelPrizeType, WheelWinStatus } from '../types'

/** 扇区配色标识，后台奖品 color 字段可填其中之一。 */
export const WHEEL_TONES = [
  'gold',
  'rose',
  'mint',
  'violet',
  'sky',
  'amber',
] as const

export type WheelTone = (typeof WHEEL_TONES)[number]

export interface WheelToneStyle {
  /** 扇区渐变起始色 */
  from: string
  /** 扇区渐变结束色 */
  to: string
  /** 扇区内文字颜色 */
  text: string
  /** 图例圆点颜色 */
  dot: string
}

const WHEEL_TONE_STYLES: Record<WheelTone, WheelToneStyle> = {
  gold: { from: '#FEF3C7', to: '#F59E0B', text: '#78350F', dot: '#F59E0B' },
  rose: { from: '#FCE7F3', to: '#EC4899', text: '#831843', dot: '#EC4899' },
  mint: { from: '#D1FAE5', to: '#10B981', text: '#064E3B', dot: '#10B981' },
  violet: { from: '#EDE9FE', to: '#8B5CF6', text: '#4C1D95', dot: '#8B5CF6' },
  sky: { from: '#E0F2FE', to: '#0EA5E9', text: '#0C4A6E', dot: '#0EA5E9' },
  amber: { from: '#FFEDD5', to: '#F97316', text: '#7C2D12', dot: '#F97316' },
}

const FALLBACK_TONE: WheelToneStyle = {
  from: '#E2E8F0',
  to: '#94A3B8',
  text: '#0F172A',
  dot: '#94A3B8',
}

/** 未知 color 时按序号轮换，保证相邻扇区颜色不同。 */
export function resolveWheelTone(color: string, index: number): WheelTone {
  const normalized = color.trim().toLowerCase()
  const matched = WHEEL_TONES.find((tone) => tone === normalized)
  if (matched) return matched
  return WHEEL_TONES[Math.abs(index) % WHEEL_TONES.length]
}

export function getWheelToneStyle(
  color: string,
  index: number
): WheelToneStyle {
  const tone = resolveWheelTone(color, index)
  return WHEEL_TONE_STYLES[tone] ?? FALLBACK_TONE
}

/** 每个扇区占用的角度。 */
export function segmentAngle(count: number): number {
  if (count <= 0) return 360
  return 360 / count
}

/**
 * 让第 index 个扇区的中心停在顶部指针处所需的目标旋转角度。
 *
 * 旋转角度按顺时针累计，currentRotation 是当前已旋转的角度，
 * 返回值保证大于 currentRotation（至少多转 turns 圈），转盘才会一直往前转。
 */
export function targetRotation(
  currentRotation: number,
  index: number,
  count: number,
  turns = 5
): number {
  if (count <= 0) return currentRotation
  const seg = segmentAngle(count)
  const target = (360 - (((index + 0.5) * seg) % 360)) % 360
  const currentMod = ((currentRotation % 360) + 360) % 360
  let delta = target - currentMod
  if (delta < 0) delta += 360
  return currentRotation + Math.max(turns, 1) * 360 + delta
}

/**
 * 用中奖结果的 prize_id 反查扇区下标。
 *
 * 抽奖前后台可能刚改过奖品，后端返回的下标会偏移；
 * 先按 id 匹配，匹配不到再退回后端下标，越界归零。
 */
export function resolvePrizeIndex(
  prizes: { id: number }[],
  prizeId: number,
  fallbackIndex: number
): number {
  const matched = prizes.findIndex((prize) => prize.id === prizeId)
  if (matched >= 0) return matched
  if (fallbackIndex >= 0 && fallbackIndex < prizes.length) return fallbackIndex
  return 0
}

/** 极坐标转直角坐标，角度以顶部为 0、顺时针为正。 */
export function polarPoint(
  angle: number,
  radius: number,
  center: number
): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180
  return {
    x: center + radius * Math.cos(rad),
    y: center + radius * Math.sin(rad),
  }
}

/** 生成一个扇区的 SVG path。 */
export function segmentPath(
  index: number,
  count: number,
  radius: number,
  center: number
): string {
  if (count <= 0) return ''
  if (count === 1) {
    return [
      `M ${center} ${center - radius}`,
      `A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`,
      'Z',
    ].join(' ')
  }
  const seg = segmentAngle(count)
  const start = polarPoint(index * seg, radius, center)
  const end = polarPoint((index + 1) * seg, radius, center)
  const largeArc = seg > 180 ? 1 : 0
  return [
    `M ${center} ${center}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    'Z',
  ].join(' ')
}

/** 奖品类型对应的 i18n 键。 */
export const WHEEL_PRIZE_TYPE_LABEL_KEYS: Record<WheelPrizeType, string> = {
  none: 'Thanks for playing',
  quota: 'Account credit',
  card_key: 'Card key',
  redemption_code: 'Redemption code',
  physical: 'Physical prize',
  subscription: 'Subscription plan',
}

/** 领取方式说明，用于奖品图例。 */
export const WHEEL_PRIZE_TYPE_HINT_KEYS: Record<WheelPrizeType, string> = {
  none: 'Better luck next time',
  quota: 'Credited to your balance right away',
  card_key: 'The card key is shown right after the draw',
  redemption_code: 'A one-time redemption code is issued for you',
  physical: 'Fill in the shipping address and we will deliver it',
  subscription: 'The plan is activated immediately',
}

/** 中奖记录状态对应的 i18n 键。 */
export const WHEEL_WIN_STATUS_LABEL_KEYS: Record<WheelWinStatus, string> = {
  pending: 'Waiting to claim',
  delivered: 'Delivered',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
}

export function getWheelWinStatusVariant(
  status: WheelWinStatus
): 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' {
  if (status === 'pending') return 'warning'
  if (status === 'delivered') return 'default'
  if (status === 'shipped') return 'secondary'
  if (status === 'cancelled') return 'outline'
  return 'outline'
}

/** 未知状态回落到 pending，避免后端新增状态导致渲染崩溃。 */
export function toWheelWinStatus(value: string): WheelWinStatus {
  if (
    value === 'pending' ||
    value === 'delivered' ||
    value === 'shipped' ||
    value === 'cancelled'
  ) {
    return value
  }
  return 'pending'
}

/** 未知奖品类型回落到 none。 */
export function toWheelPrizeType(value: string): WheelPrizeType {
  if (
    value === 'none' ||
    value === 'quota' ||
    value === 'card_key' ||
    value === 'redemption_code' ||
    value === 'physical' ||
    value === 'subscription'
  ) {
    return value
  }
  return 'none'
}

/** 库存文案：-1 表示不限量。 */
export function formatStockLabelKey(stock: number): string {
  return stock < 0 ? 'Unlimited' : String(stock)
}

/** 超过两行的奖品名按字符折行，避免扇区文字溢出。 */
export function splitPrizeName(name: string, maxPerLine = 4): string[] {
  const chars = [...name.trim()]
  if (chars.length <= maxPerLine) return [chars.join('')]
  const lines: string[] = []
  for (let i = 0; i < chars.length; i += maxPerLine) {
    lines.push(chars.slice(i, i + maxPerLine).join(''))
  }
  return lines.slice(0, 2)
}

/** 用户名的脱敏展示（后端已脱敏时保持不变）。 */
export function displayWinnerName(name: string): string {
  const trimmed = name.trim()
  return trimmed === '' ? '***' : trimmed
}
