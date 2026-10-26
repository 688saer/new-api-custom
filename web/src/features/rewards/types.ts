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

/** 券面样式；后端会收敛未知值到 aurora。 */
export type RewardStyle = 'aurora' | 'citrus' | 'sunrise' | 'nocturne'

export const REWARD_STYLES: readonly RewardStyle[] = [
  'aurora',
  'citrus',
  'sunrise',
  'nocturne',
]

/** 领取状态。 */
export type RewardGrantStatus = 'pending' | 'claimed' | 'cancelled' | 'expired'

/** 发放活动状态。 */
export type RewardCampaignStatus = 'active' | 'revoked'

/** 券面文案，缺省字段由后端用默认值补齐。 */
export interface RewardTicketCopy {
  label: string
  title: string
  subtitle: string
  footer: string
  stub_text: string
  stub_font_size: number
  button_text: string
}

/** 用户侧一条奖励。 */
export interface RewardItem {
  id: number
  status: RewardGrantStatus
  campaign_name: string
  style: RewardStyle
  copy: RewardTicketCopy
  amount_quota: number
  /** 领取开始时间（Unix 秒），0 表示发放后立即可领。 */
  claim_start_at: number
  /** 领取截止时间（Unix 秒），0 表示长期有效。 */
  expires_at: number
  created_at: number
  claimed_at: number
}

/** 待领取奖励汇总。 */
export interface RewardPendingResult {
  enabled: boolean
  count: number
  total_quota: number
  /** 当前就能领取的张数与金额，不含还没到开始时间的券。 */
  claimable_count: number
  claimable_quota: number
  items: RewardItem[]
  quota_per_unit: number
}

/** 领取记录分页。 */
export interface RewardHistoryResult {
  items: RewardItem[]
  total: number
  page: number
  page_size: number
}

/** 领取结果。 */
export interface RewardClaimResult {
  already_claimed: boolean
  amount_quota: number
  balance: number
  quota_per_unit: number
}

/** 发放范围。 */
export type RewardAudienceScope = 'all' | 'active' | 'spend' | 'specific'

/** 计算方式。random 表示每位用户在自己区间内抽取一个额度。 */
export type RewardMode = 'fixed' | 'percentage' | 'random'

/** 发放范围草稿。 */
export interface RewardAudienceDraft {
  scope: RewardAudienceScope
  active_days: number
  spend_min_usd: number
  spend_max_usd: number
  user_ids: number[]
}

/** 发放活动草稿（预览与正式发放共用）。 */
export interface RewardCampaignDraft {
  name: string
  style: RewardStyle
  copy: RewardTicketCopy
  audience: RewardAudienceDraft
  reward_mode: RewardMode
  fixed_quota: number
  percent: number
  cap_quota: number
  /** 随机模式的每人额度区间（含端点）。 */
  random_min_quota: number
  random_max_quota: number
  /** 领取开始时间（Unix 秒），0 表示发放后立即可领。 */
  claim_start_at: number
  /** 领取截止时间（Unix 秒），0 表示长期有效。 */
  expires_at: number
}

/** 预览里的单个接收人。 */
export interface RewardRecipient {
  user_id: number
  username: string
  email: string
  amount_quota: number
}

/** 发放预览。 */
export interface RewardPreview {
  count: number
  total_quota: number
  quota_per_unit: number
  sample: RewardRecipient[]
  truncated: boolean
  /** 随机模式下的每人额度区间。 */
  min_quota: number
  max_quota: number
  /** 总额只是按区间中值估算时为 true。 */
  estimated: boolean
}

/** 发放记录条目。 */
export interface RewardCampaignSummary {
  id: number
  name: string
  style: RewardStyle
  audience_scope: RewardAudienceScope
  reward_mode: RewardMode
  fixed_quota: number
  percent: number
  cap_quota: number
  random_min_quota: number
  random_max_quota: number
  target_count: number
  claimed_count: number
  total_quota: number
  claimed_quota: number
  /** 领取开始时间（Unix 秒），0 表示发放后立即可领。 */
  claim_start_at: number
  /** 领取截止时间（Unix 秒），0 表示长期有效。 */
  expires_at: number
  created_at: number
  status: RewardCampaignStatus
  quota_per_unit: number
}

/** 发放记录分页。 */
export interface RewardCampaignList {
  items: RewardCampaignSummary[]
  total: number
  page: number
  page_size: number
}

/** 领取明细条目。 */
export interface RewardGrantRow {
  id: number
  user_id: number
  username: string
  email: string
  amount_quota: number
  status: RewardGrantStatus
  claimed_at: number
  claim_start_at: number
  expires_at: number
}

/** 领取明细分页。 */
export interface RewardGrantList {
  items: RewardGrantRow[]
  total: number
  page: number
  page_size: number
}

/** 指定用户选择器候选项。 */
export interface RewardUserOption {
  id: number
  username: string
  email: string
  quota: number
}
