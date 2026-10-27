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
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { requireServerSuccess } from '@/lib/server-error-message'

import {
  archiveMyTicket,
  createMyTicket,
  getMyTicket,
  getMyTickets,
  replyMyTicket,
  resolveMyTicket,
  uploadTicketImage,
} from '../api'
import type { Ticket, TicketListResult, UploadedTicketImage } from '../types'

export const ticketQueryKeys = {
  list: (archived: boolean) => ['tickets', 'list', archived] as const,
  detail: (ticketId: number) => ['tickets', 'detail', ticketId] as const,
}

async function loadTickets(archived: boolean): Promise<TicketListResult> {
  const envelope = requireServerSuccess(await getMyTickets(archived, 1, 100))
  if (!envelope.data) {
    throw new Error(envelope.message || 'Ticket list failed')
  }
  return envelope.data
}

async function loadTicket(ticketId: number): Promise<Ticket> {
  const envelope = requireServerSuccess(await getMyTicket(ticketId))
  if (!envelope.data) {
    throw new Error(envelope.message || 'Ticket failed to load')
  }
  return envelope.data
}

export function useMyTickets(archived: boolean) {
  return useQuery({
    queryKey: ticketQueryKeys.list(archived),
    queryFn: () => loadTickets(archived),
    staleTime: 15 * 1000,
  })
}

export function useMyTicket(ticketId: number | null) {
  return useQuery({
    queryKey: ticketQueryKeys.detail(ticketId ?? 0),
    queryFn: () => loadTicket(ticketId as number),
    enabled: ticketId != null && ticketId > 0,
    staleTime: 10 * 1000,
  })
}

function invalidateTickets(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ['tickets'] })
}

/** 上传待发送的图片，返回后端附件 id 列表。 */
async function uploadImages(files: { file: File }[]): Promise<string[]> {
  const keys: string[] = []
  for (const item of files) {
    const envelope = requireServerSuccess(await uploadTicketImage(item.file))
    const uploaded: UploadedTicketImage | undefined = envelope.data
    if (!uploaded) {
      throw new Error(envelope.message || 'Image upload failed')
    }
    keys.push(String(uploaded.id))
  }
  return keys
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      title: string
      category: string
      content: string
      files: { file: File }[]
    }) => {
      const imageKeys = await uploadImages(payload.files)
      return requireServerSuccess(
        await createMyTicket({
          title: payload.title,
          category: payload.category,
          content: payload.content,
          image_keys: imageKeys,
        })
      )
    },
    onSuccess: () => invalidateTickets(queryClient),
  })
}

export function useReplyTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      ticketId: number
      content: string
      files: { file: File }[]
    }) => {
      const imageKeys = await uploadImages(payload.files)
      return requireServerSuccess(
        await replyMyTicket(payload.ticketId, {
          content: payload.content,
          image_keys: imageKeys,
        })
      )
    },
    onSuccess: () => invalidateTickets(queryClient),
  })
}

export function useResolveTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ticketId: number) =>
      requireServerSuccess(await resolveMyTicket(ticketId)),
    onSuccess: () => invalidateTickets(queryClient),
  })
}

export function useArchiveTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { ticketId: number; archived: boolean }) =>
      requireServerSuccess(
        await archiveMyTicket(payload.ticketId, payload.archived)
      ),
    onSuccess: () => invalidateTickets(queryClient),
  })
}
