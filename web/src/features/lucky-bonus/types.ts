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

// ============================================================================
// 幸运抽奖 / 福利宝箱 —— 类型定义
// ============================================================================

export type LotteryMode = 'single' | 'multi'

export type LotteryPrizeTier = {
  index: number
  quota: number
  weight: number
  display: string
}

export type LotteryStatus = {
  enabled: boolean
  quota: number
  daily_draw_limit: number
  remaining_draws: number
  draws_used_today: number
  draw_date: string
  prizes: LotteryPrizeTier[]
  slot_indexes_today: number[]
  total_prize_today: number
  total_prize_display: string
  single_cost: number
  single_cost_display: string
  multi_draws: number
  multi_cost: number
  multi_cost_display: string
  enable_multi: boolean
  require_no_draw_today_for_multi: boolean
  can_single: boolean
  can_multi: boolean
  min_win_for_public: number
  timezone: string
}

export type LotteryDrawResult = {
  draw_id: number
  mode: LotteryMode
  prizes: number[]
  round_ids: number[]
  prize_indexes: number[]
  slot_indexes: number[]
  total_prize: number
  cost_quota: number
  total_prize_display: string
  cost_display: string
  remaining_draws: number
  draws_used_today: number
  quota: number
  draw_date: string
  is_free: boolean
  big_wins: number[] | null
}

export type LotteryRankItem = {
  rank: number
  user_id: number
  username: string
  award: number
  is_me: boolean
}

export type LotteryRankBoard = {
  items: LotteryRankItem[]
  me: LotteryRankItem | null
}

export type LotteryPublicWin = {
  date: string
  username: string
  prize: number
  is_me: boolean
}

// ---------------------------------------------------------------------------
// 福利宝箱
// ---------------------------------------------------------------------------

export type WelfareChestKey = 'xiaoshuai_ge' | 'hei_dashuai'

export type WelfareChestBoxStatus = {
  key: WelfareChestKey
  eligible: boolean
  code?: string
  reason?: string
  threshold_usd: number
  reward_min_usd: number
  reward_max_usd: number
  median_usd: number
  closed_image?: string
  opened_image?: string
}

export type WelfareChestStatus = {
  enabled: boolean
  week_key: string
  week_start: number
  week_end: number
  weekly_consumption_usd: number
  can_open_any: boolean
  unlimited_open: boolean
  opened_chest: string
  opened_reward_usd: number
  opened_reward_quota: number
  boxes: Partial<Record<WelfareChestKey, WelfareChestBoxStatus>>
  code?: string
  reason?: string
}

export type WelfareChestOpenResult = {
  chest: WelfareChestKey
  reward_usd: number
  reward_quota: number
  weekly_consumption_usd: number
  new_quota: number
  week_key: string
}

export type WelfareChestRankItem = {
  rank: number
  user_id: number
  username: string
  award: number
  is_me: boolean
}

export type WelfareChestRankBoard = {
  items: WelfareChestRankItem[]
  me: WelfareChestRankItem | null
}

export type WelfareChestRankings = Partial<
  Record<WelfareChestKey, WelfareChestRankBoard>
>
