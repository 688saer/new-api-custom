import type { UpstreamCapability, UpstreamHealth } from '../types'

/** One capability the banner has something to say about. */
export type UpstreamWarning = {
  capability: UpstreamCapability
  state: 'degraded' | 'down'
  failures: number
  attempts: number
}

/**
 * Reduce a health snapshot to the lines worth showing. Silence is the default:
 * only capabilities the relay itself marked as failing reach the user.
 */
export function describeUpstreamWarnings(
  health: UpstreamHealth | null
): UpstreamWarning[] {
  if (!health) {
    return []
  }
  const warnings: UpstreamWarning[] = []
  for (const capability of health.capabilities) {
    if (capability.state === 'ok') {
      continue
    }
    warnings.push({
      capability: capability.capability,
      state: capability.state,
      failures: capability.failures,
      attempts: capability.attempts,
    })
  }
  return warnings
}

/** The window is reported in seconds; the banner speaks in whole minutes. */
export function describeWindowMinutes(health: UpstreamHealth | null): number {
  if (!health) {
    return 1
  }
  return Math.max(1, Math.round(health.window_seconds / 60))
}
