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

export type WelfareApiItem = {
  id: string
  name: string
  provider: string
  description: string
  base_url: string
  model: string
  api_key: string
  docs_url: string
  badge: string
}

export type WelfareApiStatus = {
  enabled: boolean
  title: string
  subtitle: string
  notice: string
  require_login: boolean
  code?: string
  reason?: string
  apis: WelfareApiItem[]
}
