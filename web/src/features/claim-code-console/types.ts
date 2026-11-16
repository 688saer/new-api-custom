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
export type ClaimCodeType = 'quota' | 'subscription' | 'card_key' | 'physical'

export type ClaimCodeCardStatus = 'available' | 'used'

export interface ClaimCodeRow {
  id: number
  code: string
  name: string
  type: ClaimCodeType
  status: number
  quota: number
  quota_display: string
  plan_id: number
  plan_title: string
  description: string
  total_count: number
  used_count: number
  per_user_limit: number
  group_limit: string
  expired_time: number
  remaining_count: number
  available_cards: number
  claimed_users: number
  expired: boolean
  created_at: number
  updated_at: number
}

export interface ClaimCodeListPage {
  items: ClaimCodeRow[]
  total: number
  page: number
  page_size: number
}

export interface ClaimCodeCard {
  id: number
  claim_code_id: number
  content: string
  status: ClaimCodeCardStatus
  user_id: number
  used_at: number
  created_at: number
}

export interface ClaimCodeCardPage {
  items: ClaimCodeCard[]
  total: number
  page: number
  page_size: number
}

export interface ClaimCodeOverview {
  total_codes: number
  active_codes: number
  total_claims: number
  pending_shipment: number
  quota_distributed: number
  card_issued: number
  subscription_issued: number
  physical_issued: number
}

export interface ClaimCodeDraft {
  /** 后台自定义的口令值，留空则由服务端随机生成。 */
  code: string
  name: string
  type: ClaimCodeType
  quota: number
  plan_id: number
  description: string
  total_count: number
  per_user_limit: number
  group_limit: string
  expired_time: number
  status: number
  /** 一次生成多少条独立口令，仅新建时生效。 */
  count: number
}

export interface ClaimCodeListFilter {
  keyword: string
  type: string
  status: number
  page: number
  pageSize: number
}

export interface ClaimCodeClaimFilter {
  keyword: string
  type: string
  status: string
  page: number
  pageSize: number
}

export type ClaimRecordAction = 'ship' | 'deliver' | 'cancel'
