import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UpstreamStatusAlert } from '../components/upstream-status-banner'
import type { UpstreamHealth } from '../types'

const WINDOW_SECONDS = 300

function healthWith(
  capabilities: UpstreamHealth['capabilities']
): UpstreamHealth {
  const down = capabilities.some((capability) => capability.state === 'down')
  return {
    state: down
      ? 'down'
      : capabilities.some((capability) => capability.state === 'degraded')
        ? 'degraded'
        : 'ok',
    window_seconds: WINDOW_SECONDS,
    capabilities,
  }
}

describe('upstream status banner', () => {
  it('stays silent while every capability is relaying', () => {
    render(
      <UpstreamStatusAlert
        health={healthWith([
          {
            capability: 'image',
            state: 'ok',
            attempts: 12,
            failures: 0,
            consecutive_failures: 0,
          },
        ])}
      />
    )

    expect(screen.queryByTestId('upstream-status-banner')).toBeNull()
  })

  it('stays silent before the first health snapshot arrives', () => {
    render(<UpstreamStatusAlert health={null} />)

    expect(screen.queryByTestId('upstream-status-banner')).toBeNull()
  })

  it('names the failing capability with its failure counts when the upstream is down', () => {
    render(
      <UpstreamStatusAlert
        health={healthWith([
          {
            capability: 'image',
            state: 'down',
            attempts: 4,
            failures: 3,
            consecutive_failures: 3,
          },
        ])}
      />
    )

    expect(screen.getByTestId('upstream-status-banner')).toHaveAttribute(
      'role',
      'alert'
    )
    expect(screen.getByText('Upstream service is unstable')).toBeVisible()
    expect(
      screen.getByText(/requests are failing: 3 of 4 failed in the last 5/)
    ).toBeVisible()
  })

  it('describes a degraded capability without claiming requests fail', () => {
    render(
      <UpstreamStatusAlert
        health={healthWith([
          {
            capability: 'chat',
            state: 'degraded',
            attempts: 5,
            failures: 1,
            consecutive_failures: 0,
          },
        ])}
      />
    )

    expect(
      screen.getByText(
        /requests are slower or failing intermittently: 1 of 5 failed/
      )
    ).toBeVisible()
    expect(screen.queryByText(/requests are failing:/)).toBeNull()
  })
})
