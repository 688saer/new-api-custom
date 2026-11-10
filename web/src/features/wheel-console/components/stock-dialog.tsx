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
import { Label } from '@/components/ui/label'

import { stockLabel } from '../lib/prizes'
import type { WheelAdminPrize } from '../types'

const PRESET_DELTAS = [10, 50, 100, -10]

interface StockDialogProps {
  prize: WheelAdminPrize | null
  submitting: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (delta: number) => void
}

/** 奖品库存增减弹窗，正数为补货，负数为核减。 */
export function StockDialog(props: StockDialogProps) {
  const { t } = useTranslation()
  const [delta, setDelta] = useState(0)

  useEffect(() => {
    setDelta(0)
  }, [props.prize?.id])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (delta === 0) return
    props.onSubmit(delta)
  }

  return (
    <Dialog
      open={props.prize != null}
      onOpenChange={props.onOpenChange}
      title={t('Adjust stock')}
      description={
        props.prize
          ? t('{{name}} · current stock {{stock}}', {
              name: props.prize.name,
              stock: t(stockLabel(props.prize.stock)),
            })
          : undefined
      }
      contentClassName='sm:max-w-sm'
      contentHeight='auto'
    >
      <form className='space-y-3' onSubmit={handleSubmit}>
        <div className='grid gap-1.5'>
          <Label htmlFor='wheel-stock-delta'>{t('Stock change')}</Label>
          <Input
            id='wheel-stock-delta'
            type='number'
            step={1}
            value={delta}
            onChange={(event) => setDelta(Number(event.target.value) || 0)}
          />
          <p className='text-muted-foreground text-xs'>
            {t('Positive numbers add stock, negative numbers remove it.')}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          {PRESET_DELTAS.map((preset) => (
            <Button
              key={preset}
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setDelta(preset)}
            >
              {preset > 0 ? `+${preset}` : String(preset)}
            </Button>
          ))}
        </div>
        {props.error != null && (
          <p role='alert' className='text-destructive text-sm'>
            {props.error}
          </p>
        )}
        <Button
          type='submit'
          className='w-full'
          disabled={props.submitting || delta === 0}
        >
          {props.submitting ? t('Saving…') : t('Apply change')}
        </Button>
      </form>
    </Dialog>
  )
}
