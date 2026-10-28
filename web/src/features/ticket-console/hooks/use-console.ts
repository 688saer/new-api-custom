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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import type { Ticket } from '@/features/tickets/types'

import {
  consoleAgents,
  consoleArchiveTicket,
  consoleAssignTicket,
  consoleChangePassword,
  consoleCounts,
  consoleCreateAgent,
  consoleDeleteAgent,
  consoleLogin,
  consoleLogout,
  consoleReplyTicket,
  consoleResetAgentPassword,
  consoleSaveSettings,
  consoleSelf,
  consoleSetTicketStatus,
  consoleSettings,
  consoleTicket,
  consoleTickets,
  consoleUpdateAgent,
  consoleUploadImage,
  getConsoleToken,
  setConsoleToken,
} from '../api'
import type {
  TicketAgentAccount,
  TicketAgentRole,
  TicketConsoleIdentity,
  TicketConsoleSettings,
  TicketPermission,
} from '../types'

const consoleKeys = {
  self: ['ticket-console', 'self'] as const,
  counts: ['ticket-console', 'counts'] as const,
  queue: (filter: unknown) => ['ticket-console', 'queue', filter] as const,
  detail: (ticketId: number) => ['ticket-console', 'detail', ticketId] as const,
  agents: ['ticket-console', 'agents'] as const,
  settings: ['ticket-console', 'settings'] as const,
}

/** 会话状态：localStorage 里有 token 才去验证，避免登录页无谓请求。 */
export function useConsoleSession() {
  const [hasToken, setHasToken] = useState(() => getConsoleToken() !== '')

  const query = useQuery({
    queryKey: consoleKeys.self,
    queryFn: consoleSelf,
    enabled: hasToken,
    retry: false,
    staleTime: 60 * 1000,
  })

  // token 失效时清掉本地凭据，让界面回到登录页
  useEffect(() => {
    if (!query.isError) return
    setConsoleToken('')
    setHasToken(false)
  }, [query.isError])

  return {
    identity: query.data as TicketConsoleIdentity | undefined,
    loading: hasToken && query.isLoading,
    refresh: query.refetch,
    signedIn: hasToken,
    markSignedIn: () => setHasToken(true),
    markSignedOut: () => setHasToken(false),
  }
}

export function useConsoleLogin(onSuccess: () => void) {
  return useMutation({
    mutationFn: (payload: { username: string; password: string }) =>
      consoleLogin(payload.username, payload.password),
    onSuccess,
  })
}

export async function signOutConsole(): Promise<void> {
  await consoleLogout()
}

export function useConsoleCounts(enabled: boolean) {
  return useQuery({
    queryKey: consoleKeys.counts,
    queryFn: consoleCounts,
    enabled,
    refetchInterval: 30 * 1000,
  })
}

export type ConsoleQueueFilter = {
  status: string
  category: string
  keyword: string
  archived: boolean
  assignment: string
  page: number
}

export function useConsoleQueue(filter: ConsoleQueueFilter, enabled: boolean) {
  return useQuery({
    queryKey: consoleKeys.queue(filter),
    queryFn: () => consoleTickets({ ...filter, page_size: 30 }),
    enabled,
    staleTime: 10 * 1000,
  })
}

export function useConsoleTicket(ticketId: number | null) {
  return useQuery({
    queryKey: consoleKeys.detail(ticketId ?? 0),
    queryFn: () => consoleTicket(ticketId as number),
    enabled: ticketId != null && ticketId > 0,
    staleTime: 5 * 1000,
  })
}

function useInvalidateConsole() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['ticket-console'] })
  }
}

export function useConsoleTicketActions() {
  const invalidate = useInvalidateConsole()

  const reply = useMutation({
    mutationFn: async (payload: {
      ticketId: number
      content: string
      files: { file: File }[]
    }) => {
      const keys: string[] = []
      for (const item of payload.files) {
        const uploaded = await consoleUploadImage(item.file)
        keys.push(String(uploaded.id))
      }
      return consoleReplyTicket(payload.ticketId, {
        content: payload.content,
        image_keys: keys,
      })
    },
    onSuccess: invalidate,
  })

  const assign = useMutation({
    mutationFn: (payload: { ticketId: number; agentId: number }) =>
      consoleAssignTicket(payload.ticketId, payload.agentId),
    onSuccess: invalidate,
  })

  const setStatus = useMutation({
    mutationFn: (payload: { ticketId: number; status: string }) =>
      consoleSetTicketStatus(payload.ticketId, payload.status),
    onSuccess: invalidate,
  })

  const archive = useMutation({
    mutationFn: (payload: { ticketId: number; archived: boolean }) =>
      consoleArchiveTicket(payload.ticketId, payload.archived),
    onSuccess: invalidate,
  })

  return {
    reply,
    assign,
    setStatus,
    archive,
    submitting:
      reply.isPending ||
      assign.isPending ||
      setStatus.isPending ||
      archive.isPending,
  }
}

export function useConsoleAgents(enabled: boolean) {
  return useQuery({
    queryKey: consoleKeys.agents,
    queryFn: consoleAgents,
    enabled,
  })
}

export function useConsoleAgentMutations() {
  const invalidate = useInvalidateConsole()

  const create = useMutation({
    mutationFn: (payload: {
      username: string
      display_name: string
      password: string
      role: TicketAgentRole
      permissions: TicketPermission[]
    }) => consoleCreateAgent(payload),
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: (payload: {
      id: number
      display_name: string
      role: TicketAgentRole
      permissions: TicketPermission[]
      enabled: boolean
    }) =>
      consoleUpdateAgent(payload.id, {
        display_name: payload.display_name,
        role: payload.role,
        permissions: payload.permissions,
        enabled: payload.enabled,
      }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (agentId: number) => consoleDeleteAgent(agentId),
    onSuccess: invalidate,
  })

  const resetPassword = useMutation({
    mutationFn: (payload: { id: number; password: string }) =>
      consoleResetAgentPassword(payload.id, payload.password),
    onSuccess: invalidate,
  })

  return { create, update, remove, resetPassword }
}

export function useConsoleSettings(enabled: boolean) {
  return useQuery({
    queryKey: consoleKeys.settings,
    queryFn: consoleSettings,
    enabled,
  })
}

export function useConsoleSaveSettings() {
  const invalidate = useInvalidateConsole()
  return useMutation({
    mutationFn: (setting: TicketConsoleSettings) =>
      consoleSaveSettings(setting),
    onSuccess: invalidate,
  })
}

export function useConsoleChangePassword() {
  return useMutation({
    mutationFn: (payload: { old_password: string; new_password: string }) =>
      consoleChangePassword(payload),
  })
}

export type { Ticket, TicketAgentAccount }
