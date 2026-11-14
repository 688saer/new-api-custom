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
  WheelAdminPrize,
  WheelOverview,
  WheelPrizeChance,
  WheelPrizeCodePage,
  WheelPrizeDraft,
  WheelRecordFilter,
  WheelRecordPage,
  WheelSettings,
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

export async function getWheelOverview(): Promise<ApiEnvelope<WheelOverview>> {
  const res = await api.get('/api/wheel/overview', silentOptions)
  return res.data
}

export async function listWheelPrizes(): Promise<
  ApiEnvelope<{ items: WheelAdminPrize[] }>
> {
  const res = await api.get('/api/wheel/prizes', silentOptions)
  return res.data
}

export async function createWheelPrize(
  draft: WheelPrizeDraft
): Promise<ApiEnvelope<WheelAdminPrize>> {
  const res = await api.post('/api/wheel/prizes', draft, silentOptions)
  return res.data
}

export async function updateWheelPrize(
  id: number,
  draft: WheelPrizeDraft
): Promise<ApiEnvelope<WheelAdminPrize>> {
  const res = await api.put(`/api/wheel/prizes/${id}`, draft, silentOptions)
  return res.data
}

export async function deleteWheelPrize(id: number): Promise<ApiEnvelope<null>> {
  const res = await api.delete(`/api/wheel/prizes/${id}`, silentOptions)
  return res.data
}

export async function updateWheelPrizeChances(
  items: WheelPrizeChance[]
): Promise<ApiEnvelope<{ items: WheelAdminPrize[] }>> {
  const res = await api.put(
    '/api/wheel/prizes/chances',
    { items },
    silentOptions
  )
  return res.data
}

export async function adjustWheelPrizeStock(
  id: number,
  delta: number
): Promise<ApiEnvelope<WheelAdminPrize>> {
  const res = await api.post(
    `/api/wheel/prizes/${id}/stock`,
    { delta },
    silentOptions
  )
  return res.data
}

export async function listWheelPrizeCodes(
  prizeId: number,
  status: string,
  page: number,
  pageSize: number
): Promise<ApiEnvelope<WheelPrizeCodePage>> {
  const res = await api.get(
    `/api/wheel/prizes/${prizeId}/codes?status=${status}&page=${page}&page_size=${pageSize}`,
    silentOptions
  )
  return res.data
}

export async function addWheelPrizeCodes(
  prizeId: number,
  codes: string
): Promise<ApiEnvelope<{ added: number }>> {
  const res = await api.post(
    `/api/wheel/prizes/${prizeId}/codes`,
    { codes },
    silentOptions
  )
  return res.data
}

export async function deleteWheelPrizeCode(
  prizeId: number,
  codeId: number
): Promise<ApiEnvelope<null>> {
  const res = await api.delete(
    `/api/wheel/prizes/${prizeId}/codes/${codeId}`,
    silentOptions
  )
  return res.data
}

export async function listWheelRecords(
  filter: WheelRecordFilter
): Promise<ApiEnvelope<WheelRecordPage>> {
  const params = new URLSearchParams({
    page: String(filter.page),
    page_size: String(filter.pageSize),
  })
  if (filter.keyword.trim() !== '') {
    params.set('keyword', filter.keyword.trim())
  }
  if (filter.status !== '') {
    params.set('status', filter.status)
  }
  if (filter.prize_type !== '') {
    params.set('prize_type', filter.prize_type)
  }
  if (filter.prize_id > 0) {
    params.set('prize_id', String(filter.prize_id))
  }
  const res = await api.get(
    `/api/wheel/records?${params.toString()}`,
    silentOptions
  )
  return res.data
}

export async function shipWheelRecord(
  id: number,
  trackingNo: string,
  note: string
): Promise<ApiEnvelope<null>> {
  const res = await api.post(
    `/api/wheel/records/${id}/ship`,
    { tracking_no: trackingNo, note },
    silentOptions
  )
  return res.data
}

export async function deliverWheelRecord(
  id: number,
  note: string,
  code: string
): Promise<ApiEnvelope<null>> {
  const res = await api.post(
    `/api/wheel/records/${id}/deliver`,
    { note, code },
    silentOptions
  )
  return res.data
}

export async function cancelWheelRecord(
  id: number,
  note: string
): Promise<ApiEnvelope<null>> {
  const res = await api.post(
    `/api/wheel/records/${id}/cancel`,
    { note },
    silentOptions
  )
  return res.data
}

export async function getWheelSettings(): Promise<ApiEnvelope<WheelSettings>> {
  const res = await api.get('/api/wheel/setting', silentOptions)
  return res.data
}

export async function updateWheelSettings(
  settings: WheelSettings
): Promise<ApiEnvelope<WheelSettings>> {
  const res = await api.put('/api/wheel/setting', settings, silentOptions)
  return res.data
}
