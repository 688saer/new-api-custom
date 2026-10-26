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
import { describe, expect, it } from 'vitest'

import { AdminRewardForm } from '../components/admin-reward-form'
import { createEmptyDraft } from '../lib/reward-draft'
import type { RewardCampaignDraft } from '../types'

/** 把受控的 draft 状态包起来，模拟管理页的真实用法。 */
function Harness() {
  const [draft, setDraft] = useState<RewardCampaignDraft>(createEmptyDraft())
  return (
    <AdminRewardForm
      draft={draft}
      onDraftChange={setDraft}
      onPreview={() => undefined}
      onIssue={() => undefined}
      previewing={false}
      issuing={false}
      canIssue={false}
    />
  )
}

async function selectMode(label: string) {
  const user = userEvent.setup()
  render(<Harness />)
  await user.selectOptions(screen.getByLabelText('Calculation'), label)
  return user
}

describe('admin reward form random mode', () => {
  it('starts in fixed mode and shows only the fixed amount input', () => {
    render(<Harness />)
    expect(screen.getByLabelText('Amount per user')).toBeInTheDocument()
    expect(screen.queryByLabelText('Minimum amount')).not.toBeInTheDocument()
  })

  it('reveals both range inputs and hides the fixed amount when random is chosen', async () => {
    await selectMode('Random amount per user')
    expect(screen.getByLabelText('Minimum amount')).toBeInTheDocument()
    expect(screen.getByLabelText('Maximum amount')).toBeInTheDocument()
    expect(screen.queryByLabelText('Amount per user')).not.toBeInTheDocument()
  })

  it('keeps the two range inputs editable and independent', async () => {
    const user = await selectMode('Random amount per user')

    const min = screen.getByLabelText('Minimum amount')
    const max = screen.getByLabelText('Maximum amount')
    await user.clear(min)
    await user.type(min, '1234')
    expect(min).toHaveValue(1234)
    expect(max).toHaveValue(500000)

    await user.clear(max)
    await user.type(max, '9876')
    expect(max).toHaveValue(9876)
    expect(min).toHaveValue(1234)
  })

  it('describes the drawn-at-issue-time behaviour next to the range inputs', async () => {
    await selectMode('Random amount per user')
    expect(
      screen.getByText(
        'Each user draws an amount in this range when the rewards are issued, and the drawn amount is fixed from then on'
      )
    ).toBeInTheDocument()
  })

  it('shows the per-user range summary instead of the fixed summary', async () => {
    await selectMode('Random amount per user')
    expect(
      screen.getByText(/\$[\d.,]+ to \$[\d.,]+ per user, drawn at issue time/)
    ).toBeInTheDocument()
  })
})

describe('admin reward form claim window', () => {
  it('defaults to claiming immediately with no deadline', () => {
    render(<Harness />)
    expect(
      screen.getByText('Claimable immediately after issuing')
    ).toBeInTheDocument()
    expect(screen.getByText('Long-term valid')).toBeInTheDocument()
  })

  it('reflects a claim start time typed into the start field', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const start = screen.getByLabelText('Claim start time')
    await user.type(start, '2030-01-02T03:04:05')

    expect(
      screen.getByText(
        'Claimable from {{date}}'.replace('{{date}}', '2030-01-02 03:04:05')
      )
    ).toBeInTheDocument()
  })

  it('flags a window whose start is not before the deadline', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(
      screen.getByLabelText('Claim start time'),
      '2030-01-02T03:04:05'
    )
    await user.type(
      screen.getByLabelText('Claim deadline'),
      '2030-01-02T03:04:05'
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Claim start time must be earlier than the deadline'
    )
  })

  it('clears the deadline hint when the field is emptied', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const deadline = screen.getByLabelText('Claim deadline')
    await user.type(deadline, '2030-01-02T03:04:05')
    expect(screen.queryByText('Long-term valid')).not.toBeInTheDocument()

    await user.clear(deadline)
    expect(screen.getByText('Long-term valid')).toBeInTheDocument()
  })
})
