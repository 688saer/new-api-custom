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

import type { Ticket, TicketListResult, UploadedTicketImage } from './types'

type ApiEnvelope<T> = {
  success: boolean
  message?: string
  code?: string
  reason?: string
  data?: T
}

// 业务失败由页面自己展示原因，因此关闭全局拦截器提示
const silentOptions = {
  skipBusinessError: true,
  skipErrorHandler: true,
}

export async function getMyTickets(
  archived: boolean,
  page: number,
  pageSize: number
): Promise<ApiEnvelope<TicketListResult>> {
  const res = await api.get(
    `/api/user/tickets?archived=${archived}&page=${page}&page_size=${pageSize}`,
    silentOptions
  )
  return res.data
}

export async function getMyTicket(
  ticketId: number
): Promise<ApiEnvelope<Ticket>> {
  const res = await api.get(`/api/user/tickets/${ticketId}`, silentOptions)
  return res.data
}

export async function createMyTicket(payload: {
  title: string
  category: string
  content: string
  image_keys: string[]
}): Promise<ApiEnvelope<Ticket>> {
  const res = await api.post('/api/user/tickets', payload, silentOptions)
  return res.data
}

export async function replyMyTicket(
  ticketId: number,
  payload: { content: string; image_keys: string[] }
): Promise<ApiEnvelope<Ticket>> {
  const res = await api.post(
    `/api/user/tickets/${ticketId}/messages`,
    payload,
    silentOptions
  )
  return res.data
}

export async function resolveMyTicket(
  ticketId: number
): Promise<ApiEnvelope<Ticket>> {
  const res = await api.put(
    `/api/user/tickets/${ticketId}/resolve`,
    {},
    silentOptions
  )
  return res.data
}

export async function archiveMyTicket(
  ticketId: number,
  archived: boolean
): Promise<ApiEnvelope<Ticket>> {
  const res = await api.put(
    `/api/user/tickets/${ticketId}/archive`,
    { archived },
    silentOptions
  )
  return res.data
}

export async function uploadTicketImage(
  file: File
): Promise<ApiEnvelope<UploadedTicketImage>> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post('/api/user/ticket-uploads', form, silentOptions)
  return res.data
}

/** 工单图片需要带会话凭据读取，因此走 blob 再用 objectURL 渲染。 */
export function ticketImageUrl(attachmentId: number): string {
  return `/api/user/ticket-uploads/${attachmentId}`
}
