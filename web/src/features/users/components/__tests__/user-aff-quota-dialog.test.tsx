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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { adjustUserAffQuota } from '../../api'
import { UserAffQuotaDialog } from '../user-aff-quota-dialog'

vi.mock('../../api', () => ({
  adjustUserAffQuota: vi.fn(),
}))

const mockedAdjust = vi.mocked(adjustUserAffQuota)

describe('UserAffQuotaDialog', () => {
  beforeEach(() => {
    mockedAdjust.mockReset()
    mockedAdjust.mockResolvedValue({ success: true })
  })

  test('shows the current referral balance and blocks subtracting more than it', async () => {
    const user = userEvent.setup()
    render(
      <UserAffQuotaDialog
        open
        onOpenChange={() => {}}
        userId={2}
        username='alice'
        currentAffQuota={500000}
        onSuccess={() => {}}
      />
    )

    expect(screen.getByText('$1.00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Subtract' }))
    await user.type(screen.getByRole('spinbutton'), '5')

    expect(
      screen.getByText('Referral balance cannot be negative')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  })

  test('adds the entered amount to the referral wallet', async () => {
    const user = userEvent.setup()
    const onSuccess = vi.fn()
    render(
      <UserAffQuotaDialog
        open
        onOpenChange={() => {}}
        userId={2}
        username='alice'
        currentAffQuota={500000}
        onSuccess={onSuccess}
      />
    )

    await user.type(screen.getByRole('spinbutton'), '5')
    await user.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() =>
      expect(mockedAdjust).toHaveBeenCalledWith({
        id: 2,
        action: 'add_aff_quota',
        mode: 'add',
        value: 2500000,
      })
    )
    expect(onSuccess).toHaveBeenCalled()
  })
})
