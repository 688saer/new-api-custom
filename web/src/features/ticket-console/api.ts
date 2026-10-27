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
import axios from 'axios'

import type { Ticket } from '@/features/tickets/types'

import type {
  TicketAgentAccount,
  TicketAgentListResult,
  TicketAgentRole,
  TicketConsoleCounts,
  TicketConsoleIdentity,
  TicketConsoleSettings,
  TicketConsoleTicketPage,
  TicketPermission,
} from './types'

const TOKEN_STORAGE_KEY = 'ticket-console-token'

/**
 * 工单后台有自己的账号体系与 Bearer token，
 * 不复用站点的 `api` 实例：那个实例带会话刷新与 /sign-in 跳转逻辑，
 * 用在这里会把客服踢到用户登录页。
 */
export const consoleApi = axios.create({
  baseURL: '',
  withCredentials: false,
  headers: { 'Cache-Control': 'no-cache, no-store' },
})

export function getConsoleToken(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || ''
}

export function setConsoleToken(token: string): void {
  if (typeof window === 'undefined') return
  if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  else window.localStorage.removeItem(TOKEN_STORAGE_KEY)
}

consoleApi.interceptors.request.use((config) => {
  const token = getConsoleToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

type ApiEnvelope<T> = {
  success: boolean
  message?: string
  code?: string
  reason?: string
  data?: T
}

/** 后台接口统一返回 {success, message, code, reason, data}，失败时抛出带原因的错。 */
async function unwrap<T>(
  promise: Promise<{ data: ApiEnvelope<T> }>
): Promise<T> {
  const response = await promise
  const body = response.data
  if (!body || body.success !== true) {
    const error = new Error(body?.reason || body?.message || 'Request failed')
    error.cause = body
    throw error
  }
  return body.data as T
}

export async function consoleLogin(
  username: string,
  password: string
): Promise<{ token: string; agent: TicketAgentAccount }> {
  const data = await unwrap(
    consoleApi.post<ApiEnvelope<{ token: string; agent: TicketAgentAccount }>>(
      '/api/ticket-console/auth/login',
      { username, password }
    )
  )
  setConsoleToken(data.token)
  return data
}

export async function consoleBootstrap(payload: {
  username: string
  display_name: string
  password: string
}): Promise<TicketAgentAccount> {
  return unwrap(
    consoleApi.post<ApiEnvelope<TicketAgentAccount>>(
      '/api/ticket-console/auth/bootstrap',
      payload
    )
  )
}

export async function consoleLogout(): Promise<void> {
  try {
    await consoleApi.post('/api/ticket-console/auth/logout')
  } finally {
    setConsoleToken('')
  }
}

export async function consoleSelf(): Promise<TicketConsoleIdentity> {
  return unwrap(
    consoleApi.get<ApiEnvelope<TicketConsoleIdentity>>(
      '/api/ticket-console/auth/self'
    )
  )
}

export async function consoleChangePassword(payload: {
  old_password: string
  new_password: string
}): Promise<void> {
  await unwrap(
    consoleApi.put<ApiEnvelope<null>>(
      '/api/ticket-console/auth/password',
      payload
    )
  )
}

export async function consoleCounts(): Promise<TicketConsoleCounts> {
  return unwrap(
    consoleApi.get<ApiEnvelope<TicketConsoleCounts>>(
      '/api/ticket-console/counts'
    )
  )
}

export async function consoleTickets(params: {
  status?: string
  category?: string
  keyword?: string
  archived?: boolean
  assignment?: string
  page?: number
  page_size?: number
}): Promise<TicketConsoleTicketPage> {
  return unwrap(
    consoleApi.get<ApiEnvelope<TicketConsoleTicketPage>>(
      '/api/ticket-console/tickets',
      { params }
    )
  )
}

export async function consoleTicket(ticketId: number): Promise<Ticket> {
  return unwrap(
    consoleApi.get<ApiEnvelope<Ticket>>(
      `/api/ticket-console/tickets/${ticketId}`
    )
  )
}

export async function consoleReplyTicket(
  ticketId: number,
  payload: { content: string; image_keys: string[] }
): Promise<Ticket> {
  return unwrap(
    consoleApi.post<ApiEnvelope<Ticket>>(
      `/api/ticket-console/tickets/${ticketId}/messages`,
      payload
    )
  )
}

export async function consoleAssignTicket(
  ticketId: number,
  agentId: number
): Promise<Ticket> {
  return unwrap(
    consoleApi.put<ApiEnvelope<Ticket>>(
      `/api/ticket-console/tickets/${ticketId}/assign`,
      { agent_id: agentId }
    )
  )
}

export async function consoleSetTicketStatus(
  ticketId: number,
  status: string
): Promise<Ticket> {
  return unwrap(
    consoleApi.put<ApiEnvelope<Ticket>>(
      `/api/ticket-console/tickets/${ticketId}/status`,
      { status }
    )
  )
}

export async function consoleArchiveTicket(
  ticketId: number,
  archived: boolean
): Promise<Ticket> {
  return unwrap(
    consoleApi.put<ApiEnvelope<Ticket>>(
      `/api/ticket-console/tickets/${ticketId}/archive`,
      { archived }
    )
  )
}

export async function consoleCreateTicket(payload: {
  user_id: number
  title: string
  category: string
  content: string
}): Promise<Ticket> {
  return unwrap(
    consoleApi.post<ApiEnvelope<Ticket>>('/api/ticket-console/tickets', payload)
  )
}

export async function consoleUploadImage(file: File): Promise<{ id: number }> {
  const form = new FormData()
  form.append('file', file)
  return unwrap(
    consoleApi.post<ApiEnvelope<{ id: number }>>(
      '/api/ticket-console/uploads',
      form
    )
  )
}

export async function consoleAgents(): Promise<TicketAgentListResult> {
  return unwrap(
    consoleApi.get<ApiEnvelope<TicketAgentListResult>>(
      '/api/ticket-console/agents'
    )
  )
}

export async function consoleCreateAgent(payload: {
  username: string
  display_name: string
  password: string
  role: TicketAgentRole
  permissions: TicketPermission[]
}): Promise<TicketAgentAccount> {
  return unwrap(
    consoleApi.post<ApiEnvelope<TicketAgentAccount>>(
      '/api/ticket-console/agents',
      payload
    )
  )
}

export async function consoleUpdateAgent(
  agentId: number,
  payload: {
    display_name: string
    role: TicketAgentRole
    permissions: TicketPermission[]
    enabled: boolean
  }
): Promise<TicketAgentAccount> {
  return unwrap(
    consoleApi.put<ApiEnvelope<TicketAgentAccount>>(
      `/api/ticket-console/agents/${agentId}`,
      payload
    )
  )
}

export async function consoleDeleteAgent(agentId: number): Promise<void> {
  await unwrap(
    consoleApi.delete<ApiEnvelope<null>>(
      `/api/ticket-console/agents/${agentId}`
    )
  )
}

export async function consoleResetAgentPassword(
  agentId: number,
  password: string
): Promise<void> {
  await unwrap(
    consoleApi.put<ApiEnvelope<null>>(
      `/api/ticket-console/agents/${agentId}/password`,
      { password }
    )
  )
}

export async function consoleSettings(): Promise<{
  setting: TicketConsoleSettings
}> {
  return unwrap(
    consoleApi.get<ApiEnvelope<{ setting: TicketConsoleSettings }>>(
      '/api/ticket-console/settings'
    )
  )
}

export async function consoleSaveSettings(
  setting: TicketConsoleSettings
): Promise<TicketConsoleSettings> {
  return unwrap(
    consoleApi.put<ApiEnvelope<TicketConsoleSettings>>(
      '/api/ticket-console/settings',
      setting
    )
  )
}

export async function consoleSearchUsers(
  keyword: string
): Promise<{ items: { id: number; username: string; email: string }[] }> {
  return unwrap(
    consoleApi.get<
      ApiEnvelope<{ items: { id: number; username: string; email: string }[] }>
    >('/api/ticket-console/users', { params: { keyword, limit: 20 } })
  )
}

/** 后台读图同样要带 token，因此取 blob 再转 objectURL。 */
export async function consoleImageBlob(attachmentId: number): Promise<Blob> {
  const response = await consoleApi.get(
    `/api/ticket-console/attachments/${attachmentId}`,
    { responseType: 'blob' }
  )
  return response.data as Blob
}
