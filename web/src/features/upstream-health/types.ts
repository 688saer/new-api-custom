/** Upstream health states, mirroring the relay's own vocabulary. */
export type UpstreamState = 'ok' | 'degraded' | 'down'

/** One capability the console can warn about. */
export type UpstreamCapability = 'image' | 'chat'

export type UpstreamCapabilityHealth = {
  capability: UpstreamCapability
  state: UpstreamState
  attempts: number
  failures: number
  consecutive_failures: number
}

export type UpstreamHealth = {
  state: UpstreamState
  window_seconds: number
  capabilities: UpstreamCapabilityHealth[]
}
