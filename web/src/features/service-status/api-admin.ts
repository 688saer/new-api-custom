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

const silentOptions = {
  skipBusinessError: true,
  skipErrorHandler: true,
}

/** Latest probe outcome for one configured target. */
export type ServiceStatusTargetStatus = {
  target_id: string
  probed: boolean
  success: boolean
  timestamp: number
  latency_ms: number
  first_token_ms: number
  error_message: string
}

type AdminSettingsEnvelope = {
  success: boolean
  data?: {
    target_statuses?: ServiceStatusTargetStatus[]
  }
}

/** Read the latest probe outcome for every configured target. */
export async function getTargetStatuses(): Promise<
  ServiceStatusTargetStatus[]
> {
  const res = await api.get('/api/service-status/admin/settings', {
    ...silentOptions,
  })
  const body = res.data as AdminSettingsEnvelope
  return body?.data?.target_statuses ?? []
}

/** Probe one target immediately and wait for the result. */
export async function probeTarget(targetId: string): Promise<void> {
  await api.post(`/api/service-status/admin/probe/${targetId}`, null, {
    ...silentOptions,
  })
}

/** Probe every enabled target immediately. */
export async function probeAllTargets(): Promise<void> {
  await api.post('/api/service-status/admin/probe', null, {
    ...silentOptions,
  })
}
