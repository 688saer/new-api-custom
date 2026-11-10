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
import type { WheelPrizeType, WheelWin } from '@/features/lucky-wheel'

/** 后台奖品配置。 */
export interface WheelAdminPrize {
  id: number
  name: string
  icon: string
  type: WheelPrizeType
  label: string
  description: string
  color: string
  weight: number
  /** -1 表示不限量；卡密奖品由卡密池维护。 */
  stock: number
  issued_count: number
  quota_value: number
  plan_id: number
  enabled: boolean
  sort_order: number
  created_at: number
  updated_at: number
}

/** 新建 / 编辑奖品时提交的字段。 */
export interface WheelPrizeDraft {
  name: string
  icon: string
  type: WheelPrizeType
  label: string
  description: string
  color: string
  weight: number
  stock: number
  quota_value: number
  plan_id: number
  enabled: boolean
  sort_order: number
}

/** 概览里的单个奖品统计。 */
export interface WheelPrizeStat {
  id: number
  name: string
  icon: string
  type: WheelPrizeType
  enabled: boolean
  stock: number
  issued_count: number
  today_issued: number
  quota_value: number
  quota_display: string
}

export interface WheelDayStat {
  date: string
  count: number
}

/** 后台概览。 */
export interface WheelOverview {
  total_wins: number
  today_wins: number
  unique_users: number
  pending_shipments: number
  quota_distributed: number
  quota_distributed_display: string
  code_issued: number
  subscription_issued: number
  prizes: WheelPrizeStat[]
  trend: WheelDayStat[]
  stock_alerts: number
}

/** 卡密池条目。 */
export interface WheelPrizeCode {
  id: number
  prize_id: number
  code: string
  status: 'available' | 'used'
  win_id: number
  user_id: number
  used_at: number
  created_at: number
}

/** 卡密池分页。 */
export interface WheelPrizeCodePage {
  items: WheelPrizeCode[]
  total: number
  page: number
  page_size: number
}

/** 中奖记录分页。 */
export interface WheelRecordPage {
  items: WheelWin[]
  total: number
  page: number
  page_size: number
}

/** 活动规则配置，字段与后端 wheel_setting 一致。 */
export interface WheelSettings {
  enabled: boolean
  title: string
  subtitle: string
  rules_text: string
  daily_free_draws: number
  daily_draw_limit: number
  single_cost_quota: number
  show_public_wins: boolean
  public_wins_limit: number
  redemption_expire_days: number
}

/** 中奖记录筛选条件。 */
export interface WheelRecordFilter {
  keyword: string
  status: string
  prize_type: string
  prize_id: number
  page: number
  pageSize: number
}
