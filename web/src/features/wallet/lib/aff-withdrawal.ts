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
// Affiliate Withdrawal Calculations
// ============================================================================

export interface AffWithdrawalEstimate {
  /** Quota the site keeps as the fee (integer floor) */
  feeQuota: number
  /** Quota actually paid out */
  payoutQuota: number
  /** CNY value of the requested quota before the fee */
  grossCNY: number
  /** CNY actually paid to the user, rounded to 2 decimals like the backend */
  payoutCNY: number
}

/**
 * Estimate an Alipay withdrawal. The backend deducts the fee in quota units
 * (integer floor of quota * percent / 100) and converts the remaining quota to
 * CNY with the current quota-per-unit and USD exchange rate.
 */
export function estimateAffWithdrawal(
  quota: number,
  feePercent: number,
  quotaPerUnit: number,
  usdExchangeRate: number
): AffWithdrawalEstimate {
  const safeQuota = Math.max(0, Math.trunc(quota))
  const percent = Math.min(Math.max(feePercent, 0), 100)
  const feeQuota = Math.floor((safeQuota * percent) / 100)
  const payoutQuota = safeQuota - feeQuota
  const unit = quotaPerUnit > 0 ? quotaPerUnit : 1
  const grossCNY = (safeQuota / unit) * usdExchangeRate
  const payoutCNY =
    Math.round((payoutQuota / unit) * usdExchangeRate * 100) / 100
  return { feeQuota, payoutQuota, grossCNY, payoutCNY }
}

/**
 * Format a CNY amount for Alipay payouts. Alipay settles in CNY regardless of
 * the site's display currency, so the symbol is fixed.
 */
export function formatCNY(amount: number): string {
  if (!Number.isFinite(amount)) return '-'
  return `¥${amount.toFixed(2)}`
}
