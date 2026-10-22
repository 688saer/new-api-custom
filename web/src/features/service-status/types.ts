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

/** Availability colour of a single time bucket. */
export type ServiceStatusColor = 'green' | 'yellow' | 'red' | 'gray'

/** Time window supported by the public endpoint. */
export type ServiceStatusRange = '60m' | '24h' | '7d' | '30d'

/** One aggregated time bucket rendered as a block on the uptime bar. */
export interface ServiceStatusCell {
  timestamp: number
  status: ServiceStatusColor
  probe_count: number
  success_count: number
  success_rate: number
  error_rate: number
  avg_latency: number
  p50_latency: number
  p90_latency: number
  first_token_latency: number
}

/** One published channel with its aggregated probe statistics. */
export interface ServiceStatusGroup {
  id: string
  group: string
  display_name: string
  description: string
  category: string
  icon: string
  model: string
  billing_mode: string
  probe_endpoint: string
  status: ServiceStatusColor
  probe_count: number
  success_count: number
  success_rate: number
  error_rate: number
  avg_latency: number
  p50_latency: number
  p90_latency: number
  first_token_latency: number
  best_response_time: number
  updated_at: number
  cells: ServiceStatusCell[]
}

/** Response body of `GET /api/service-status`. */
export interface ServiceStatusPayload {
  enabled: boolean
  title: string
  description: string
  range: ServiceStatusRange
  display_hours: number
  probe_interval_seconds: number
  show_latency: boolean
  server_time: number
  code?: string
  reason?: string
  groups: ServiceStatusGroup[]
}

/** Why the page has no data to show. */
export type ServiceStatusStatus =
  | 'ready'
  | 'disabled'
  | 'login-required'
  | 'error'
