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
import { describe, expect, it } from 'vitest'

import { formatCurrencyUSD } from '@/lib/format'

import { LotteryHero } from '../components/lottery-hero'
import { LotteryPrizeOdds } from '../components/lottery-prize-odds'
import { LotteryReel } from '../components/lottery-reel'
import type { LotteryPrizeTier, LotteryStatus } from '../types'

const tiers: LotteryPrizeTier[] = [
  { index: 0, quota: 0, weight: 55, display: '$0.00' },
  { index: 1, quota: 1000000, weight: 25, display: '$2.00' },
  { index: 2, quota: 5000000, weight: 20, display: '$10.00' },
]

const status: LotteryStatus = {
  enabled: true,
  quota: 1200000,
  daily_draw_limit: 4,
  remaining_draws: 1,
  draws_used_today: 3,
  draw_date: '2026-10-22',
  prizes: tiers,
  slot_indexes_today: [],
  total_prize_today: 2000000,
  total_prize_display: '$4.00',
  single_cost: 500000,
  single_cost_display: '$1.00',
  multi_draws: 10,
  multi_cost: 4500000,
  multi_cost_display: '$9.00',
  enable_multi: true,
  require_no_draw_today_for_multi: true,
  can_single: true,
  can_multi: false,
  min_win_for_public: 1000000,
  timezone: 'Asia/Shanghai',
}

describe('LotteryHero', () => {
  it('shows the free draws left next to the daily limit', () => {
    render(<LotteryHero status={status} />)

    expect(screen.getByText('Free draws left today')).toBeInTheDocument()
    // Both numbers must be visible: a bare denominator would mislead.
    expect(screen.getByText('1', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('/ 4')).toBeInTheDocument()
  })

  it('reports a fully spent daily allowance as a complete progress bar', () => {
    render(<LotteryHero status={{ ...status, remaining_draws: 0 }} />)

    const bar = document.querySelector('[role="progressbar"]')
    expect(bar).not.toBeNull()
    expect(bar?.getAttribute('aria-valuenow')).toBe('100')
  })

  it('leaves the progress bar empty before any draw today', () => {
    render(
      <LotteryHero
        status={{ ...status, remaining_draws: 4, draws_used_today: 0 }}
      />
    )

    const bar = document.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('aria-valuenow')).toBe('0')
  })
})

describe('LotteryReel', () => {
  it('keeps the settled cell highlighted while the spin is not running', () => {
    render(
      <LotteryReel
        slots={tiers}
        activeSlot={0}
        highlightSlot={1}
        running={false}
        drawing={false}
        lastPrizes={null}
      />
    )

    // A stopped reel must not be drawn as still rolling.
    expect(screen.queryByText('Rolling...')).not.toBeInTheDocument()
    expect(screen.getByText(formatCurrencyUSD(1000000))).toBeInTheDocument()
  })

  it('shows the rolling indicator only while the spin runs', () => {
    render(
      <LotteryReel
        slots={tiers}
        activeSlot={2}
        highlightSlot={null}
        running
        drawing
        lastPrizes={null}
      />
    )

    expect(screen.getByText('Rolling...')).toBeInTheDocument()
  })

  it('totals a multi-draw round and labels empty tiers', () => {
    render(
      <LotteryReel
        slots={tiers}
        activeSlot={0}
        highlightSlot={null}
        running={false}
        drawing={false}
        lastPrizes={[0, 1000000, 5000000]}
      />
    )

    expect(screen.getByText('This round')).toBeInTheDocument()
    // One empty tier is in the slots and another in the round result, so the
    // label is expected more than once rather than exactly once.
    expect(screen.getAllByText('No prize').length).toBeGreaterThan(1)
    // The round total is the sum of its tiers; the amount wording comes from
    // the shared formatter, so only the arithmetic is asserted here.
    expect(
      screen.getByText(formatCurrencyUSD(1000000 + 5000000))
    ).toBeInTheDocument()
  })
})

describe('LotteryPrizeOdds', () => {
  it('normalises weights that do not sum to one into percentages', () => {
    render(<LotteryPrizeOdds prizes={tiers} />)

    // Weights total 100, so each chance equals its weight.
    expect(screen.getByText('55.00%')).toBeInTheDocument()
    expect(screen.getByText('25.00%')).toBeInTheDocument()
    expect(screen.getByText('20.00%')).toBeInTheDocument()
  })

  it('normalises arbitrary weights rather than assuming percentages', () => {
    render(
      <LotteryPrizeOdds
        prizes={[
          { index: 0, quota: 0, weight: 1, display: '$0.00' },
          { index: 1, quota: 1000000, weight: 3, display: '$2.00' },
        ]}
      />
    )

    expect(screen.getByText('75.00%')).toBeInTheDocument()
    expect(screen.getByText('25.00%')).toBeInTheDocument()
  })

  it('renders nothing when the deployment has no prize tiers', () => {
    const { container } = render(<LotteryPrizeOdds prizes={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
