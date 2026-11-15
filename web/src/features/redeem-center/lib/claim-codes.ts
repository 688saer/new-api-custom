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
import type { ClaimCodeClaimStatus, ClaimCodeClaimType } from '../types'

export const CLAIM_CODE_MAX_LENGTH = 64

const CLAIM_TYPE_LABEL_KEYS: Record<ClaimCodeClaimType, string> = {
  quota: 'Balance credit',
  subscription: 'Subscription plan',
  card_key: 'Virtual product',
  physical: 'Physical prize',
}

const CLAIM_STATUS_LABEL_KEYS: Record<ClaimCodeClaimStatus, string> = {
  delivered: 'Delivered',
  pending: 'Waiting for shipping address',
  ready: 'Waiting for shipment',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
}

/** 口令只含大写字母、数字与分隔符，输入时统一去掉空白并转大写。 */
export function normalizeClaimCodeInput(value: string): string {
  return value.trim().toUpperCase()
}

/** 校验口令输入，返回 i18n 键；null 表示可以提交。 */
export function validateClaimCodeInput(value: string): string | null {
  const code = normalizeClaimCodeInput(value)
  if (code === '') {
    return 'Enter a claim code'
  }
  if (code.length > CLAIM_CODE_MAX_LENGTH) {
    return 'Claim code is too long'
  }
  return null
}

export function claimTypeLabelKey(type: ClaimCodeClaimType): string {
  return CLAIM_TYPE_LABEL_KEYS[type] ?? type
}

export function claimStatusLabelKey(status: ClaimCodeClaimStatus): string {
  return CLAIM_STATUS_LABEL_KEYS[status] ?? status
}
