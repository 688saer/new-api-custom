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
import { describe, expect, it, vi } from 'vitest'

import { formatCurrencyUSD } from '@/lib/format'

import { WelfareChestCard } from '../components/welfare-chest-card'
import type { WelfareChestBoxStatus } from '../types'

const eligibleBox: WelfareChestBoxStatus = {
  key: 'xiaoshuai_ge',
  eligible: true,
  threshold_usd: 20,
  reward_min_usd: 1,
  reward_max_usd: 5,
  median_usd: 3,
}

const lockedBox: WelfareChestBoxStatus = {
  key: 'xiaoshuai_ge',
  eligible: false,
  code: 'NOT_ELIGIBLE',
  reason: 'weekly consumption is below the threshold',
  threshold_usd: 20,
  reward_min_usd: 1,
  reward_max_usd: 5,
  median_usd: 3,
}

type CardProps = Parameters<typeof WelfareChestCard>[0]

function renderCard(overrides: Partial<CardProps>) {
  return render(
    <WelfareChestCard
      chestKey='xiaoshuai_ge'
      box={eligibleBox}
      isOpened={false}
      canOpen
      blockedByOther={false}
      unlimited={false}
      opening={false}
      imageFailed
      weeklyConsumptionUsd={25}
      claimedRewardUsd={0}
      onOpen={vi.fn()}
      onImageError={vi.fn()}
      {...overrides}
    />
  )
}

describe('WelfareChestCard', () => {
  it('fills the unlock progress bar once weekly consumption passes the threshold', () => {
    renderCard({ weeklyConsumptionUsd: 30 })

    const bar = document.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-valuenow')).toBe('100')
  })

  it('shows partial progress while the threshold is still out of reach', () => {
    renderCard({ box: lockedBox, weeklyConsumptionUsd: 5, canOpen: false })

    const bar = document.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-valuenow')).toBe('25')
  })

  it('spells out the shortfall instead of a bare locked label', () => {
    renderCard({ box: lockedBox, weeklyConsumptionUsd: 5, canOpen: false })

    expect(
      screen.getByText(
        `Weekly consumption must reach ${formatCurrencyUSD(20)}`
      )
    ).toBeInTheDocument()
  })

  it('disables the open button once the chest has been claimed for the week', () => {
    renderCard({ isOpened: true, canOpen: false, claimedRewardUsd: 3 })

    const button = screen.getByRole('button', { name: 'Claimed This Week' })
    expect(button).toBeDisabled()
    expect(
      screen.getByText(`+${formatCurrencyUSD(3)}`)
    ).toBeInTheDocument()
  })

  it('names the chest it will open so screen readers can tell the two apart', () => {
    renderCard({})

    expect(
      screen.getByRole('button', { name: 'Open Xiaoshuai Ge chest' })
    ).toBeEnabled()
  })

  it('marks the button busy while the request is in flight', () => {
    renderCard({ opening: true, canOpen: false })

    const button = screen.getByRole('button', { name: 'Cannot open chest' })
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
  })
})
