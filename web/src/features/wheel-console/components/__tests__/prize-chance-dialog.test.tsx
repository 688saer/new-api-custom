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
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, expect, it, vi } from 'vitest'

import type { WheelAdminPrize, WheelPrizeChance } from '../../types'
import { PrizeChanceDialog } from '../prize-chance-dialog'

const i18n = createInstance()
await i18n.init({
  lng: 'en',
  resources: { en: { translation: {} } },
  initAsync: false,
})

function makePrize(
  id: number,
  name: string,
  weight: number,
  enabled = true
): WheelAdminPrize {
  return {
    id,
    name,
    icon: '🎁',
    type: 'quota',
    label: '',
    description: '',
    color: 'gold',
    weight,
    stock: 10,
    issued_count: 0,
    quota_value: 500000,
    plan_id: 0,
    enabled,
    sort_order: id,
    created_at: 1,
    updated_at: 2,
  }
}

const PRIZES = [
  makePrize(1, '1 USD credit', 30),
  makePrize(2, 'Thanks', 10),
  makePrize(3, 'Poster', 60, false),
]

function renderDialog(onSubmit = vi.fn<(items: WheelPrizeChance[]) => void>()) {
  render(
    <I18nextProvider i18n={i18n}>
      <PrizeChanceDialog
        open
        prizes={PRIZES}
        submitting={false}
        error={null}
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />
    </I18nextProvider>
  )
  return onSubmit
}

function chanceInput(name: string) {
  return screen.getByLabelText(`Winning chance for ${name}`)
}

afterEach(() => {
  cleanup()
})

it('shows the saved chance of every prize next to the share it really gets', () => {
  renderDialog()

  expect(chanceInput('1 USD credit')).toHaveValue(30)
  expect(chanceInput('Thanks')).toHaveValue(10)
  expect(chanceInput('Poster')).toHaveValue(60)
  // 停用的奖品不参与抽奖，所以两个启用奖品吃掉全部概率
  expect(screen.getByText('75%')).toBeVisible()
  expect(screen.getByText('25%')).toBeVisible()
  expect(screen.getByText('Entered total: 40%')).toBeVisible()
})

it('recalculates the total and the real share while typing', async () => {
  const user = userEvent.setup()
  renderDialog()

  await user.clear(chanceInput('1 USD credit'))
  await user.type(chanceInput('1 USD credit'), '5')

  expect(screen.getByText('Entered total: 15%')).toBeVisible()
  expect(screen.getByText('33.33%')).toBeVisible()
  expect(screen.getByText('66.67%')).toBeVisible()
})

it('splits the chances evenly across enabled prizes only', async () => {
  const user = userEvent.setup()
  renderDialog()

  await user.click(screen.getByRole('button', { name: 'Split evenly' }))

  expect(chanceInput('1 USD credit')).toHaveValue(50)
  expect(chanceInput('Thanks')).toHaveValue(50)
  expect(chanceInput('Poster')).toHaveValue(60)
  expect(screen.getByText('Entered total: 100%')).toBeVisible()
})

it('explains that every enabled prize wins equally when all chances are 0', async () => {
  const user = userEvent.setup()
  renderDialog()

  await user.clear(chanceInput('1 USD credit'))
  await user.type(chanceInput('1 USD credit'), '0')
  await user.clear(chanceInput('Thanks'))
  await user.type(chanceInput('Thanks'), '0')

  expect(
    screen.getByText('All chances are 0, so every enabled prize wins equally.')
  ).toBeVisible()
  // 两个启用奖品平分概率，停用的那个不参与
  expect(screen.getAllByText('50%')).toHaveLength(2)
})

it('saves the chance of every prize, including the disabled ones', async () => {
  const user = userEvent.setup()
  const onSubmit = renderDialog()

  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(onSubmit).toHaveBeenCalledTimes(1)
  expect(onSubmit.mock.calls[0]?.[0]).toEqual([
    { id: 1, weight: 30 },
    { id: 2, weight: 10 },
    { id: 3, weight: 60 },
  ])
})

it('refuses to save a chance outside 0 to 100', async () => {
  const user = userEvent.setup()
  const onSubmit = renderDialog()

  await user.clear(chanceInput('Thanks'))
  await user.type(chanceInput('Thanks'), '120')
  expect(chanceInput('Thanks')).toHaveValue(120)
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(onSubmit).not.toHaveBeenCalled()
  expect(
    screen.getByText('Prize chance must be between 0 and 100')
  ).toBeVisible()
})
