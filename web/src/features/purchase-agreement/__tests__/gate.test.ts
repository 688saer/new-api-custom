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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { confirmPurchaseAgreement } from '../api'
import { ensurePurchaseAgreement, useAgreementGate } from '../lib/gate'
import type { PurchaseAgreement } from '../types'

vi.mock('../api', () => ({
  confirmPurchaseAgreement: vi.fn(),
  signPurchaseAgreement: vi.fn(),
}))

const agreement: PurchaseAgreement = {
  enabled: true,
  title: 'Purchase agreement',
  version: '1.0',
  content: 'Terms',
  signed: false,
  require_topup: true,
  require_redemption: true,
  require_subscription: true,
}

describe('ensurePurchaseAgreement', () => {
  beforeEach(() => {
    useAgreementGate.setState({ request: null })
    vi.mocked(confirmPurchaseAgreement).mockReset()
  })

  it('lets the purchase continue when the server does not require a signature', async () => {
    vi.mocked(confirmPurchaseAgreement).mockResolvedValue({
      allowed: true,
      agreement: null,
    })

    await expect(ensurePurchaseAgreement('topup')).resolves.toBe(true)
    expect(useAgreementGate.getState().request).toBeNull()
  })

  it('opens the gate for the requested scene until the user agrees', async () => {
    vi.mocked(confirmPurchaseAgreement).mockResolvedValue({
      allowed: false,
      agreement,
    })

    const pending = ensurePurchaseAgreement('redemption')

    await vi.waitFor(() =>
      expect(useAgreementGate.getState().request?.scene).toBe('redemption')
    )
    useAgreementGate.getState().settle(true)

    await expect(pending).resolves.toBe(true)
    expect(useAgreementGate.getState().request).toBeNull()
  })

  it('reports a cancelled purchase when the user closes the gate', async () => {
    vi.mocked(confirmPurchaseAgreement).mockResolvedValue({
      allowed: false,
      agreement,
    })

    const pending = ensurePurchaseAgreement('subscription')

    await vi.waitFor(() =>
      expect(useAgreementGate.getState().request?.scene).toBe('subscription')
    )
    useAgreementGate.getState().settle(false)

    await expect(pending).resolves.toBe(false)
  })

  it('keeps checkout working when the agreement text cannot be loaded', async () => {
    vi.mocked(confirmPurchaseAgreement).mockResolvedValue({
      allowed: false,
      agreement: null,
    })

    await expect(ensurePurchaseAgreement('topup')).resolves.toBe(true)
    expect(useAgreementGate.getState().request).toBeNull()
  })
})
