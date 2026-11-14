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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPercent } from '@/lib/format'

import { prizeChancePercents } from '../lib/prizes'
import type { WheelAdminPrize, WheelPrizeChance } from '../types'

interface PrizeChanceDialogProps {
  open: boolean
  prizes: WheelAdminPrize[]
  submitting: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (items: WheelPrizeChance[]) => void
}

/** 输入框里的概率：去掉多余小数位，避免 12.340000000000001 这类展示。 */
function chanceInputValue(weight: number): string {
  return String(Math.round(weight * 100) / 100)
}

/** 中奖概率设置弹窗：一次编辑全部奖品，合计按比例归一化后生效。 */
export function PrizeChanceDialog(props: PrizeChanceDialogProps) {
  const { t } = useTranslation()
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!props.open) return
    const next: Record<number, string> = {}
    for (const prize of props.prizes) {
      next[prize.id] = chanceInputValue(prize.weight)
    }
    setDrafts(next)
    setLocalError(null)
  }, [props.open, props.prizes])

  const entries = props.prizes.map((prize) => {
    const raw = drafts[prize.id] ?? chanceInputValue(prize.weight)
    const value = Number(raw)
    const parsed = raw.trim() === '' || !Number.isFinite(value) ? null : value
    return { prize, raw, parsed, weight: parsed ?? 0 }
  })

  const chances = prizeChancePercents(
    entries.map((entry) => ({
      id: entry.prize.id,
      weight: entry.weight,
      enabled: entry.prize.enabled,
    }))
  )
  const enteredTotal = entries.reduce(
    (sum, entry) => (entry.prize.enabled ? sum + entry.weight : sum),
    0
  )
  const drawnCount = props.prizes.filter((prize) => prize.enabled).length
  const allZero = enteredTotal <= 0 && drawnCount > 0

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const invalid = entries.find(
      (entry) => entry.parsed == null || entry.parsed < 0 || entry.parsed > 100
    )
    if (invalid) {
      setLocalError(t('Prize chance must be between 0 and 100'))
      return
    }
    setLocalError(null)
    props.onSubmit(
      entries.map((entry) => ({
        id: entry.prize.id,
        weight: Math.round(entry.weight * 100) / 100,
      }))
    )
  }

  const handleSplitEvenly = () => {
    if (drawnCount === 0) return
    const even = chanceInputValue(100 / drawnCount)
    setDrafts((prev) => {
      const next = { ...prev }
      for (const prize of props.prizes) {
        if (prize.enabled) next[prize.id] = even
      }
      return next
    })
  }

  const message = localError ?? props.error

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Prize chances')}
      description={t(
        'Set how often each prize wins. The wheel normalizes the numbers, so the total does not have to be 100%.'
      )}
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
    >
      <form className='space-y-3' onSubmit={handleSubmit}>
        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
          <span className='flex-1'>{t('Prize')}</span>
          <span className='w-20 text-center'>{t('Winning chance (%)')}</span>
          <span className='w-20 text-end'>{t('Actual share')}</span>
        </div>

        <div className='space-y-2'>
          {props.prizes.map((prize) => (
            <div key={prize.id} className='flex items-center gap-2'>
              <span className='flex min-w-0 flex-1 items-center gap-1.5'>
                <span aria-hidden='true'>{prize.icon || '🎁'}</span>
                <span className='truncate text-sm'>{prize.name}</span>
                {prize.enabled ? null : (
                  <span className='text-muted-foreground shrink-0 text-xs'>
                    {t('Disabled')}
                  </span>
                )}
              </span>
              <Input
                className='w-20 text-center'
                type='number'
                aria-label={t('Winning chance for {{name}}', {
                  name: prize.name,
                })}
                value={drafts[prize.id] ?? chanceInputValue(prize.weight)}
                onChange={(event) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [prize.id]: event.target.value,
                  }))
                }
              />
              <span className='w-20 text-end text-sm tabular-nums'>
                {prize.enabled
                  ? formatPercent(chances.get(prize.id) ?? 0)
                  : '-'}
              </span>
            </div>
          ))}
        </div>

        <p className='text-muted-foreground text-xs'>
          {allZero
            ? t('All chances are 0, so every enabled prize wins equally.')
            : t('Entered total: {{percent}}', {
                percent: formatPercent(enteredTotal),
              })}
        </p>
        <p className='text-muted-foreground text-xs'>
          {t('Prizes with a 0% chance are never drawn.')}
        </p>

        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={drawnCount === 0}
            onClick={handleSplitEvenly}
          >
            {t('Split evenly')}
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => {
              const next: Record<number, string> = {}
              for (const prize of props.prizes) {
                next[prize.id] = chanceInputValue(prize.weight)
              }
              setDrafts(next)
              setLocalError(null)
            }}
          >
            {t('Restore')}
          </Button>
        </div>

        {message != null && (
          <p role='alert' className='text-destructive text-sm'>
            {message}
          </p>
        )}

        <Button type='submit' className='w-full' disabled={props.submitting}>
          {props.submitting ? t('Saving…') : t('Save changes')}
        </Button>
      </form>
    </Dialog>
  )
}
