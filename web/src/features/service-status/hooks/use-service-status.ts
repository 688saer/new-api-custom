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
import { useQuery } from '@tanstack/react-query'

import { getServiceStatus } from '../api'
import type { ServiceStatusRange, ServiceStatusStatus } from '../types'

export const SERVICE_STATUS_QUERY_KEY = 'service-status'

/** Load the public channel availability payload for one time window. */
export function useServiceStatus(range: ServiceStatusRange) {
  const query = useQuery({
    queryKey: [SERVICE_STATUS_QUERY_KEY, range],
    queryFn: () => getServiceStatus(range),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  })

  const payload = query.data?.data
  const failed = query.isError || query.data?.success === false

  let status: ServiceStatusStatus = 'ready'
  if (failed) {
    status = 'error'
  } else if (payload && !payload.enabled) {
    status = 'disabled'
  } else if (payload?.code === 'LOGIN_REQUIRED') {
    status = 'login-required'
  }

  return {
    status,
    payload,
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}
