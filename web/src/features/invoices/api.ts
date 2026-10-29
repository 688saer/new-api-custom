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
import { api } from '@/lib/api'

import type {
  AgreementSignature,
  Invoice,
  InvoiceAdminSettingPayload,
  InvoiceApplicantForm,
  InvoiceListResponse,
} from './types'

// ============================================================================
// 用户侧
// ============================================================================

/** 我的发票申请列表 */
export async function getMyInvoices(
  page = 1,
  pageSize = 20
): Promise<InvoiceListResponse> {
  const res = await api.get('/api/user/invoices', {
    params: { page, page_size: pageSize },
  })
  return res.data
}

/** 提交开票申请 */
export async function createInvoice(form: InvoiceApplicantForm) {
  const res = await api.post('/api/user/invoices', form)
  return res.data as { success: boolean; message?: string; data?: Invoice }
}

/** 下载已开具的发票 PDF */
export async function downloadMyInvoice(invoice: Invoice): Promise<void> {
  const res = await api.get(`/api/user/invoices/${invoice.id}/file`, {
    responseType: 'blob',
  })
  saveBlob(res.data as Blob, invoiceFileName(invoice))
}

// ============================================================================
// 后台
// ============================================================================

export interface InvoiceAdminListQuery {
  status?: string
  keyword?: string
  page?: number
  pageSize?: number
}

/** 后台发票列表 */
export async function listInvoicesAdmin(query: InvoiceAdminListQuery = {}) {
  const res = await api.get('/api/invoice/', {
    params: {
      status: query.status || undefined,
      keyword: query.keyword || undefined,
      page: query.page ?? 1,
      page_size: query.pageSize ?? 20,
    },
  })
  return res.data as {
    success: boolean
    message?: string
    data?: { items: Invoice[]; total: number; page: number; page_size: number }
  }
}

/** 审核通过或驳回 */
export async function reviewInvoiceAdmin(
  id: number,
  approve: boolean,
  reason = ''
) {
  const res = await api.put(`/api/invoice/${id}/review`, { approve, reason })
  return res.data as { success: boolean; message?: string; code?: string }
}

/** 开具：写发票号并上传 PDF */
export async function issueInvoiceAdmin(
  id: number,
  invoiceNo: string,
  file: File
) {
  const body = new FormData()
  body.append('invoice_no', invoiceNo)
  body.append('file', file)
  const res = await api.post(`/api/invoice/${id}/issue`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data as { success: boolean; message?: string; code?: string }
}

/** 后台下载发票 PDF */
export async function downloadInvoiceAdmin(invoice: Invoice): Promise<void> {
  const res = await api.get(`/api/invoice/${invoice.id}/file`, {
    responseType: 'blob',
  })
  saveBlob(res.data as Blob, invoiceFileName(invoice))
}

/** 读取发票与购买协议设置 */
export async function getInvoiceSettingsAdmin() {
  const res = await api.get('/api/invoice/setting')
  return res.data as {
    success: boolean
    message?: string
    data?: InvoiceAdminSettingPayload
  }
}

/** 保存发票与购买协议设置 */
export async function updateInvoiceSettingsAdmin(
  payload: InvoiceAdminSettingPayload
) {
  const res = await api.put('/api/invoice/setting', payload)
  return res.data as {
    success: boolean
    message?: string
    data?: InvoiceAdminSettingPayload
  }
}

/** 后台查看协议签署记录 */
export async function listAgreementSignaturesAdmin(
  keyword = '',
  page = 1,
  pageSize = 20
) {
  const res = await api.get('/api/invoice/signatures', {
    params: { keyword: keyword || undefined, page, page_size: pageSize },
  })
  return res.data as {
    success: boolean
    message?: string
    data?: {
      items: AgreementSignature[]
      total: number
      page: number
      page_size: number
    }
  }
}

function invoiceFileName(invoice: Invoice): string {
  return invoice.file_name || `invoice-${invoice.id}.pdf`
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
