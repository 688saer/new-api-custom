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
export type ClaimCodeClaimType =
  | 'quota'
  | 'subscription'
  | 'card_key'
  | 'physical'

export type ClaimCodeClaimStatus =
  | 'delivered'
  | 'pending'
  | 'ready'
  | 'shipped'
  | 'cancelled'

export interface ClaimCodeClaim {
  id: number
  claim_code_id: number
  code: string
  name: string
  type: ClaimCodeClaimType
  status: ClaimCodeClaimStatus
  description: string
  user_id: number
  username: string
  quota: number
  quota_display: string
  plan_id: number
  plan_title: string
  card_content: string
  subscription_id: number
  receiver_name: string
  receiver_phone: string
  receiver_address: string
  tracking_no: string
  note: string
  need_address: boolean
  created_at: number
  updated_at: number
  shipped_at: number
  delivered_at: number
}

export interface ClaimCodeClaimPage {
  items: ClaimCodeClaim[]
  total: number
  page: number
  page_size: number
}
