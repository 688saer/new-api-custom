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

export type InvoiceStatus = 'pending' | 'approved' | 'issued' | 'rejected'
export type InvoiceTitleType = 'personal' | 'company'

export interface Invoice {
  id: number
  user_id: number
  username: string
  title_type: InvoiceTitleType
  title_name: string
  tax_id: string
  email: string
  phone: string
  amount_cents: number
  content: string
  remark: string
  status: InvoiceStatus
  reject_reason: string
  invoice_no: string
  file_name: string
  file_size: number
  reviewer_id: number
  reviewer_name: string
  issuer_id: number
  issuer_name: string
  reviewed_at: number
  issued_at: number
  created_at: number
  updated_at: number
}

export interface InvoiceSettingView {
  enabled: boolean
  seller_name: string
  contact: string
  notice: string
  min_amount: number
  max_amount: number
}

export interface InvoiceListResponse {
  success: boolean
  message?: string
  data?: {
    items: Invoice[]
    total: number
    page: number
    page_size: number
    setting: InvoiceSettingView
  }
}

export interface InvoiceApplicantForm {
  title_type: InvoiceTitleType
  title_name: string
  tax_id: string
  email: string
  phone: string
  amount: number
  content: string
  remark: string
}

export interface InvoiceAdminSettingPayload {
  invoice: {
    enabled: boolean
    seller_name: string
    contact: string
    notice: string
    min_amount: number
    max_amount: number
    max_pending_per_user: number
  }
  agreement: {
    enabled: boolean
    title: string
    version: string
    content: string
    require_for_redemption: boolean
    require_for_topup: boolean
    require_for_subscription: boolean
  }
}

export interface AgreementSignature {
  id: number
  user_id: number
  username: string
  agreement_key: string
  version: string
  scene: string
  ip: string
  user_agent: string
  created_at: number
}
