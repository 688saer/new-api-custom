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
  WheelSpinResult,
  WheelStatus,
  WheelWin,
  WheelWinPage,
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

export async function getWheelStatus(): Promise<ApiEnvelope<WheelStatus>> {
  const res = await api.get('/api/user/wheel/status', silentOptions)
  return res.data
}

export async function spinWheel(): Promise<ApiEnvelope<WheelSpinResult>> {
  const res = await api.post('/api/user/wheel/spin', {}, silentOptions)
  return res.data
}

export async function getMyWheelWins(
  page: number,
  pageSize: number
): Promise<ApiEnvelope<WheelWinPage>> {
  const res = await api.get(
    `/api/user/wheel/records?page=${page}&page_size=${pageSize}`,
    silentOptions
  )
  return res.data
}

export async function submitWheelAddress(
  winId: number,
  address: {
    receiver_name: string
    receiver_phone: string
    receiver_address: string
  }
): Promise<ApiEnvelope<WheelWin>> {
  const res = await api.put(
    `/api/user/wheel/records/${winId}/address`,
    address,
    silentOptions
  )
  return res.data
}

export async function getWheelPublicWins(): Promise<
  ApiEnvelope<{ items: WheelWin[] }>
> {
  const res = await api.get('/api/user/wheel/public-wins', silentOptions)
  return res.data
}
