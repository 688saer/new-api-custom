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

/** 购买场景，与后端 purchase_scene 常量一致 */
export type PurchaseScene = 'redemption' | 'topup' | 'subscription'

export interface PurchaseAgreement {
  enabled: boolean
  title: string
  version: string
  content: string
  signed: boolean
  require_topup: boolean
  require_redemption: boolean
  require_subscription: boolean
}

/** 购买前确认接口的响应：成功即放行，AGREEMENT_REQUIRED 时带出协议正文 */
export interface PurchaseAgreementConfirmResult {
  allowed: boolean
  agreement: PurchaseAgreement | null
}

export interface PurchaseAgreementSignResponse {
  success: boolean
  message?: string
  data?: PurchaseAgreement
}
