import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { UpstreamStatusAlert } from '../components/upstream-status-banner'
import type { UpstreamHealth } from '../types'

const WINDOW_SECONDS = 300

function healthWith(
  capabilities: UpstreamHealth['capabilities']
): UpstreamHealth {
  const down = capabilities.some((capability) => capability.state === 'down')
  const degraded = capabilities.some(
    (capability) => capability.state === 'degraded'
  )
  let state: UpstreamHealth['state'] = 'ok'
  if (down) {
    state = 'down'
  } else if (degraded) {
    state = 'degraded'
  }
  return {
    state,
    window_seconds: WINDOW_SECONDS,
    capabilities,
  }
}

describe('upstream status banner', () => {
  afterEach(() => {
    window.sessionStorage.clear()
  })

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

  it('can be put away, so it stops covering the page corner', () => {
    render(
      <UpstreamStatusAlert
        health={healthWith([
          {
            capability: 'chat',
            state: 'down',
            attempts: 4,
            failures: 3,
            consecutive_failures: 3,
          },
        ])}
      />
    )

    expect(screen.getByTestId('upstream-status-banner')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this notice' }))

    expect(screen.queryByTestId('upstream-status-banner')).toBeNull()
  })

  it('stays dismissed while the same capabilities keep failing', () => {
    const health = healthWith([
      {
        capability: 'chat',
        state: 'down',
        attempts: 4,
        failures: 3,
        consecutive_failures: 3,
      },
    ])
    const first = render(<UpstreamStatusAlert health={health} />)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this notice' }))
    first.unmount()

    // The next poll reports a different failure count for the same outage.
    render(
      <UpstreamStatusAlert
        health={healthWith([
          {
            capability: 'chat',
            state: 'down',
            attempts: 9,
            failures: 6,
            consecutive_failures: 6,
          },
        ])}
      />
    )

    expect(screen.queryByTestId('upstream-status-banner')).toBeNull()
  })

  it('comes back when another capability starts failing', () => {
    const first = render(
      <UpstreamStatusAlert
        health={healthWith([
          {
            capability: 'chat',
            state: 'down',
            attempts: 4,
            failures: 3,
            consecutive_failures: 3,
          },
        ])}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this notice' }))
    first.unmount()

    render(
      <UpstreamStatusAlert
        health={healthWith([
          {
            capability: 'chat',
            state: 'down',
            attempts: 4,
            failures: 3,
            consecutive_failures: 3,
          },
          {
            capability: 'image',
            state: 'down',
            attempts: 3,
            failures: 3,
            consecutive_failures: 2,
          },
        ])}
      />
    )

    expect(screen.getByTestId('upstream-status-banner')).toBeVisible()
  })
})
