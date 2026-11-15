import type {
  ClaimCodeClaim,
  ClaimCodeClaimPage,
} from '@/features/redeem-center'
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
  ClaimCodeCardPage,
  ClaimCodeCardStatus,
  ClaimCodeClaimFilter,
  ClaimCodeDraft,
  ClaimCodeListFilter,
  ClaimCodeListPage,
  ClaimCodeOverview,
  ClaimCodeRow,
} from './types'

type ApiEnvelope<T> = {
  success: boolean
  message?: string
  code?: string
  reason?: string
  data?: T
}

// 业务失败由页面自行处理，因此关闭全局拦截器提示
const silentOptions = {
  skipBusinessError: true,
  skipErrorHandler: true,
}

export async function listClaimCodes(
  filter: ClaimCodeListFilter
): Promise<ApiEnvelope<ClaimCodeListPage>> {
  const params = new URLSearchParams({
    page: String(filter.page),
    page_size: String(filter.pageSize),
  })
  if (filter.keyword.trim() !== '') {
    params.set('keyword', filter.keyword.trim())
  }
  if (filter.type !== '') {
    params.set('type', filter.type)
  }
  if (filter.status > 0) {
    params.set('status', String(filter.status))
  }
  const res = await api.get(
    `/api/claim-codes?${params.toString()}`,
    silentOptions
  )
  return res.data
}

export async function getClaimCodeOverview(): Promise<
  ApiEnvelope<ClaimCodeOverview>
> {
  const res = await api.get('/api/claim-codes/overview', silentOptions)
  return res.data
}

export async function getClaimCodeGroups(): Promise<
  ApiEnvelope<{ groups: string[] }>
> {
  const res = await api.get('/api/claim-codes/groups', silentOptions)
  return res.data
}

export async function createClaimCodes(
  draft: ClaimCodeDraft
): Promise<ApiEnvelope<{ items: ClaimCodeRow[]; count: number }>> {
  const res = await api.post('/api/claim-codes', draft, silentOptions)
  return res.data
}

export async function updateClaimCode(
  id: number,
  draft: ClaimCodeDraft
): Promise<ApiEnvelope<ClaimCodeRow>> {
  const res = await api.put(`/api/claim-codes/${id}`, draft, silentOptions)
  return res.data
}

export async function deleteClaimCode(id: number): Promise<ApiEnvelope<null>> {
  const res = await api.delete(`/api/claim-codes/${id}`, silentOptions)
  return res.data
}

export async function listClaimCodeCards(
  claimCodeId: number,
  status: ClaimCodeCardStatus | '',
  page: number,
  pageSize: number
): Promise<ApiEnvelope<ClaimCodeCardPage>> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })
  if (status !== '') {
    params.set('status', status)
  }
  const res = await api.get(
    `/api/claim-codes/${claimCodeId}/cards?${params.toString()}`,
    silentOptions
  )
  return res.data
}

export async function addClaimCodeCards(
  claimCodeId: number,
  codes: string
): Promise<ApiEnvelope<{ added: number }>> {
  const res = await api.post(
    `/api/claim-codes/${claimCodeId}/cards`,
    { codes },
    silentOptions
  )
  return res.data
}

export async function deleteClaimCodeCard(
  claimCodeId: number,
  cardId: number
): Promise<ApiEnvelope<null>> {
  const res = await api.delete(
    `/api/claim-codes/${claimCodeId}/cards/${cardId}`,
    silentOptions
  )
  return res.data
}

export async function listClaimCodeClaims(
  filter: ClaimCodeClaimFilter
): Promise<ApiEnvelope<ClaimCodeClaimPage>> {
  const params = new URLSearchParams({
    page: String(filter.page),
    page_size: String(filter.pageSize),
  })
  if (filter.keyword.trim() !== '') {
    params.set('keyword', filter.keyword.trim())
  }
  if (filter.type !== '') {
    params.set('type', filter.type)
  }
  if (filter.status !== '') {
    params.set('status', filter.status)
  }
  const res = await api.get(
    `/api/claim-codes/claims?${params.toString()}`,
    silentOptions
  )
  return res.data
}

export async function shipClaimRecord(
  id: number,
  trackingNo: string,
  note: string
): Promise<ApiEnvelope<null>> {
  const res = await api.post(
    `/api/claim-codes/claims/${id}/ship`,
    { tracking_no: trackingNo, note },
    silentOptions
  )
  return res.data
}

export async function deliverClaimRecord(
  id: number,
  note: string
): Promise<ApiEnvelope<null>> {
  const res = await api.post(
    `/api/claim-codes/claims/${id}/deliver`,
    { note },
    silentOptions
  )
  return res.data
}

export async function cancelClaimRecord(
  id: number,
  note: string
): Promise<ApiEnvelope<null>> {
  const res = await api.post(
    `/api/claim-codes/claims/${id}/cancel`,
    { note },
    silentOptions
  )
  return res.data
}

export type { ClaimCodeClaim }
