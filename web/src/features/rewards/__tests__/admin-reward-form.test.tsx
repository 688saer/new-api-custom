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
