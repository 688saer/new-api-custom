import { useQuery } from '@tanstack/react-query'

import { getUpstreamHealth } from '../api'

/** A minute is finer than the five-minute window the relay reports on. */
const UPSTREAM_POLL_INTERVAL_MS = 60_000

/**
 * Poll the relay's own health view. A failure here only means the banner cannot
 * speak; it must never surface as an error toast, because the console still works.
 */
export function useUpstreamHealth() {
  const { data } = useQuery({
    queryKey: ['upstream-health'],
    queryFn: getUpstreamHealth,
    refetchInterval: UPSTREAM_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 30_000,
    meta: { errorToast: false },
  })

  return { health: data ?? null }
}
