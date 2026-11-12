import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
import type { Row } from '@tanstack/react-table'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlanRecord } from '@/features/subscriptions/types'

import { deletePlan } from '../../api'
import { DataTableRowActions } from '../data-table-row-actions'
import { DeletePlanDialog } from '../dialogs/delete-plan-dialog'
import {
  SubscriptionsProvider,
  useSubscriptions,
} from '../subscriptions-provider'

vi.mock('../../api', () => ({
  deletePlan: vi.fn(),
}))

vi.mock('@/features/system-settings/hooks/use-system-options', () => ({
  useSystemOptions: () => ({
    data: {
      data: {
        'payment_setting.compliance_confirmed': true,
        'payment_setting.compliance_terms_version': 'v1',
      },
    },
  }),
  getOptionValue: (
    options: Record<string, unknown>,
    defaults: Record<string, unknown>
  ) => ({ ...defaults, ...options }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const planRecord: PlanRecord = {
  plan: {
    id: 7,
    title: 'Token Pack',
    subtitle: '',
    price_amount: 2,
    currency: 'USD',
    duration_unit: 'day',
    duration_value: 1,
    quota_reset_period: 'daily',
    token_limit: 100,
    allowed_models: ['gpt-4o-mini'],
    enabled: true,
    sort_order: 0,
    allow_balance_pay: true,
    allow_wallet_overflow: true,
    max_purchase_per_user: 0,
    total_amount: 0,
  },
}

// Row actions only read row.original, so a stub row keeps this test on the
// delete affordance instead of table internals.
const stubRow = { original: planRecord } as unknown as Row<PlanRecord>

function DialogStateProbe(props: { onChange: (state: string) => void }) {
  const { open } = useSubscriptions()
  props.onChange(open ?? '')
  return null
}

function renderPlanRow() {
  let dialogState = ''
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <SubscriptionsProvider>
        <DataTableRowActions row={stubRow} />
        <DeletePlanDialog />
        <DialogStateProbe
          onChange={(state) => {
            dialogState = state
          }}
        />
      </SubscriptionsProvider>
    </QueryClientProvider>
  )

  return { getDialogState: () => dialogState }
}

async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Delete' }))
  return screen.findByRole('alertdialog')
}

describe('subscription plan deletion', () => {
  beforeEach(() => {
    vi.mocked(deletePlan).mockReset()
  })

  it('opens the delete confirmation from the plan row actions', async () => {
    const user = userEvent.setup()
    const view = renderPlanRow()

    const dialog = await openDeleteDialog(user)

    expect(view.getDialogState()).toBe('delete')
    expect(
      within(dialog).getByText(/Plan "Token Pack" will be removed permanently/)
    ).toBeInTheDocument()
  })

  it('deletes the plan and closes the dialog on success', async () => {
    const user = userEvent.setup()
    vi.mocked(deletePlan).mockResolvedValue({ success: true })
    const view = renderPlanRow()

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(deletePlan).toHaveBeenCalledWith(7)
    })
    await waitFor(() => {
      expect(view.getDialogState()).toBe('')
    })
  })

  it('keeps the dialog open when the server refuses because the plan is in use', async () => {
    const user = userEvent.setup()
    vi.mocked(deletePlan).mockResolvedValue({
      success: false,
      message: 'This plan still has 2 active subscriptions.',
    })
    const view = renderPlanRow()

    const dialog = await openDeleteDialog(user)
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(deletePlan).toHaveBeenCalledWith(7)
    })
    expect(view.getDialogState()).toBe('delete')
    expect(
      screen.getByRole('alertdialog', { name: 'Confirm delete plan' })
    ).toBeInTheDocument()
  })
})
