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
import type { RewardGrantStatus, RewardMode, RewardTicketCopy } from '../types'

/** 计算方式的展示文案键。 */
export const REWARD_MODE_LABEL_KEYS: Record<RewardMode, string> = {
  fixed: 'Fixed amount per user',
  percentage: 'Percentage of spend',
  random: 'Random amount per user',
}

/** 计算方式未知时回落到 fixed，避免后端新增模式时渲染崩溃。 */
export function toRewardMode(value: string): RewardMode {
  if (value === 'percentage' || value === 'random') return value
  return 'fixed'
}

/** 领取状态徽章的展示配置。
 *
 * 待领取特意不用通用的 `Pending`（该键在订单等其他场景译作「待确认」），
 * 否则领取记录里会显示成与业务无关的措辞。
 */
export const REWARD_STATUS_LABEL_KEYS: Record<RewardGrantStatus, string> = {
  pending: 'Waiting to claim',
  claimed: 'Claimed',
  cancelled: 'Withdrawn',
  expired: 'Expired',
}

const REWARD_STATUS_VARIANTS: Record<
  RewardGrantStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'default',
  claimed: 'secondary',
  cancelled: 'outline',
  expired: 'outline',
}

export function getRewardStatusVariant(
  status: RewardGrantStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  return REWARD_STATUS_VARIANTS[status] ?? 'outline'
}

/** 未知状态回落到 pending，避免后端新增状态时渲染崩溃。 */
export function toRewardGrantStatus(value: string): RewardGrantStatus {
  if (
    value === 'pending' ||
    value === 'claimed' ||
    value === 'cancelled' ||
    value === 'expired'
  ) {
    return value
  }
  return 'pending'
}

/** 竖排票根文字的字号收敛在 14–56px，与后端校验一致。 */
export function clampStubFontSize(size: number | undefined): number {
  if (!Number.isFinite(size)) return 28
  return Math.min(56, Math.max(14, Math.round(size as number)))
}

/**
 * 拼出券面最终文案。
 *
 * 后端返回的 copy 已用默认值补齐；这里再兜一层，避免历史数据缺字段时
 * 券面出现空白。
 */
export function resolveTicketCopy(copy: RewardTicketCopy): RewardTicketCopy {
  return {
    label: copy.label ?? '',
    title: copy.title ?? '',
    subtitle: copy.subtitle ?? '',
    footer: copy.footer ?? '',
    stub_text: copy.stub_text ?? '',
    stub_font_size: clampStubFontSize(copy.stub_font_size),
    button_text: copy.button_text ?? '',
  }
}

/** 票根文字按字符竖排，空白字符不占位。 */
export function splitStubText(text: string): string[] {
  return Array.from(text).filter((character) => character.trim() !== '')
}

/** 券的领取状态：可领、未到开始时间、已过期、已失效。 */
export type RewardClaimState =
  | 'claimable'
  | 'scheduled'
  | 'expired'
  | 'unavailable'

/**
 * 奖励当前的领取状态。
 *
 * 后端在领取时才做最终判定，这里只用于提前置灰按钮并给出对应文案。
 * 开始时间为 0 表示发放后立即可领，截止时间为 0 表示长期有效。
 */
export function getRewardClaimState(
  status: RewardGrantStatus,
  claimStartAt: number,
  expiresAt: number,
  now: number = Date.now()
): RewardClaimState {
  if (status !== 'pending') return 'unavailable'
  const nowSeconds = Math.floor(now / 1000)
  if (claimStartAt > nowSeconds) return 'scheduled'
  if (expiresAt > 0 && expiresAt <= nowSeconds) return 'expired'
  return 'claimable'
}

/** 奖励是否还能领取（可领状态即为 true）。 */
export function isRewardClaimable(
  status: RewardGrantStatus,
  expiresAt: number,
  now: number = Date.now()
): boolean {
  return getRewardClaimState(status, 0, expiresAt, now) === 'claimable'
}
