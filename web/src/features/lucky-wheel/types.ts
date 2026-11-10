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

/** 奖品发放方式，与后端 wheel_prizes.type 一一对应。 */
export type WheelPrizeType =
  | 'none'
  | 'quota'
  | 'card_key'
  | 'redemption_code'
  | 'physical'
  | 'subscription'

/** 中奖记录状态。 */
export type WheelWinStatus = 'pending' | 'delivered' | 'shipped' | 'cancelled'

/** 转盘上的一个奖品。 */
export interface WheelPrize {
  id: number
  name: string
  icon: string
  label: string
  description: string
  type: WheelPrizeType
  color: string
  quota: number
  quota_display: string
  plan_id: number
  plan_title: string
  /** -1 表示不限量。 */
  stock: number
  available: boolean
}

/** 大转盘页面状态。 */
export interface WheelStatus {
  enabled: boolean
  title: string
  subtitle: string
  rules_text: string
  quota: number
  quota_per_unit: number
  daily_free_draws: number
  daily_draw_limit: number
  remaining_draws: number
  draws_used_today: number
  draw_date: string
  single_cost: number
  single_cost_display: string
  can_spin: boolean
  prizes: WheelPrize[]
  today_win_count: number
  today_prize_quota: number
  today_prize_display: string
  total_win_count: number
  show_public_wins: boolean
  redemption_expire_days: number
}

/** 抽奖结果。 */
export interface WheelSpinResult {
  win_id: number
  prize_index: number
  prize_id: number
  prize_name: string
  prize_icon: string
  prize_type: WheelPrizeType
  prize_label: string
  status: WheelWinStatus
  quota_value: number
  quota_display: string
  code: string
  plan_title: string
  need_address: boolean
  is_free: boolean
  cost_quota: number
  cost_display: string
  remaining_draws: number
  draws_used_today: number
  quota: number
  draw_date: string
}

/** 中奖记录。 */
export interface WheelWin {
  id: number
  user_id: number
  username: string
  prize_id: number
  prize_name: string
  prize_icon: string
  prize_type: WheelPrizeType
  status: WheelWinStatus
  quota_value: number
  quota_display: string
  plan_title: string
  code: string
  tracking_no: string
  note: string
  draw_date: string
  created_at: number
  shipped_at: number
  receiver_name: string
  receiver_phone: string
  receiver_address: string
  has_address: boolean
}

/** 中奖记录分页。 */
export interface WheelWinPage {
  items: WheelWin[]
  total: number
  page: number
  page_size: number
}
