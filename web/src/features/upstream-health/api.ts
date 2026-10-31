import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type { UpstreamHealth } from './types'

/**
 * Read the health the relay derives from recent real traffic. The endpoint is
 * excluded from caching server-side, so answering from the response here keeps
 * the banner honest about the last few minutes.
 */
export async function getUpstreamHealth(): Promise<UpstreamHealth> {
  const res = await api.get<{
    success: boolean
    message: string
    data: UpstreamHealth
  }>('/api/upstream-status')
  return requireServerSuccess(res.data).data
}
