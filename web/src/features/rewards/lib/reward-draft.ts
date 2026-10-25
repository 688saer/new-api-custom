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
import type { RewardCampaignDraft, RewardTicketCopy } from '../types'

/** 默认券面文案，与后端 `reward_setting.default_copy` 保持一致。 */
export const DEFAULT_REWARD_COPY: RewardTicketCopy = {
  label: 'New API',
  title: '感谢你的支持',
  subtitle: '每一次创造，都值得被支持。',
  footer: '奖励金可用于本站模型调用',
  stub_text: '专属奖励',
  stub_font_size: 28,
  button_text: '领取奖励金',
}

/** 一张空白草稿：固定额度、发给全体用户、长期有效。 */
export function createEmptyDraft(): RewardCampaignDraft {
  return {
    name: '',
    style: 'aurora',
    copy: { ...DEFAULT_REWARD_COPY },
    audience: {
      scope: 'all',
      active_days: 30,
      spend_min_usd: 0,
      spend_max_usd: 0,
      user_ids: [],
    },
    reward_mode: 'fixed',
    fixed_quota: 250000,
    percent: 5,
    cap_quota: 500000,
    random_min_quota: 100000,
    random_max_quota: 500000,
    expires_at: 0,
  }
}

/**
 * 券面预览用的代表额度。
 *
 * 固定模式用设定值，比例模式用封顶值，随机模式取区间中值——预览要能看出
 * 最长的那串数字在券面上是否撑得下。
 */
export function rewardPreviewQuota(draft: RewardCampaignDraft): number {
  if (draft.reward_mode === 'percentage') return draft.cap_quota
  if (draft.reward_mode === 'random') {
    return Math.round((draft.random_min_quota + draft.random_max_quota) / 2)
  }
  return draft.fixed_quota
}
