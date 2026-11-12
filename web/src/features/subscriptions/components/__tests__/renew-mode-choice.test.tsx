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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { SubscriptionRenewMode } from '@/features/subscriptions/types'

import { SubscriptionRenewModeChoice } from '../dialogs/subscription-renew-mode-choice'

function ControlledChoice(props: {
  canRefresh: boolean
  onChange: (mode: SubscriptionRenewMode) => void
}) {
  const [mode, setMode] = useState<SubscriptionRenewMode>('extend')

  return (
    <SubscriptionRenewModeChoice
      value={mode}
      onChange={(next) => {
        props.onChange(next)
        setMode(next)
      }}
      canRefresh={props.canRefresh}
      allowanceExhausted={false}
    />
  )
}

describe('subscription renew mode choice', () => {
  it('keeps both options selectable with extend preselected when a full day of validity remains', () => {
    render(
      <SubscriptionRenewModeChoice
        value='extend'
        onChange={() => undefined}
        canRefresh
        allowanceExhausted={false}
      />
    )

    expect(screen.getByRole('radio', { name: /Extend validity/ })).toBeChecked()
    expect(
      screen.getByRole('radio', { name: /Refresh allowance now/ })
    ).not.toBeChecked()
    expect(
      screen.getByRole('radio', { name: /Refresh allowance now/ })
    ).not.toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.queryByText(
        'The current card has less than one day left, so it can only be extended.'
      )
    ).not.toBeInTheDocument()
  })

  it('disables refreshing with the reason and ignores clicks when less than a day is left', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ControlledChoice canRefresh={false} onChange={onChange} />)

    const refresh = screen.getByRole('radio', { name: /Refresh allowance now/ })
    expect(refresh).toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.getByText(
        'The current card has less than one day left, so it can only be extended.'
      )
    ).toBeInTheDocument()

    await user.click(refresh)

    expect(onChange).not.toHaveBeenCalled()
    expect(refresh).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /Extend validity/ })).toBeChecked()
  })

  it('reports the mode the buyer picked through the callback', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<ControlledChoice canRefresh onChange={onChange} />)

    await user.click(
      screen.getByRole('radio', { name: /Refresh allowance now/ })
    )

    expect(onChange).toHaveBeenLastCalledWith('refresh')
    expect(
      screen.getByRole('radio', { name: /Refresh allowance now/ })
    ).toBeChecked()

    await user.click(screen.getByRole('radio', { name: /Extend validity/ }))

    expect(onChange).toHaveBeenLastCalledWith('extend')
    expect(screen.getByRole('radio', { name: /Extend validity/ })).toBeChecked()
  })
})
