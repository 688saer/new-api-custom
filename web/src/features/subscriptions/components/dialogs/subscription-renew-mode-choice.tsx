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
import { useTranslation } from 'react-i18next'

import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'

import type { SubscriptionRenewMode } from '../../types'

interface Props {
  value: SubscriptionRenewMode
  onChange: (mode: SubscriptionRenewMode) => void
  /** False when the current card has less than a full day of validity left. */
  canRefresh: boolean
  /** True when this period's token allowance is already spent. */
  allowanceExhausted: boolean
}

/**
 * Renewal choice for a buyer who already holds the plan: queue the purchase
 * after the current card, or spend one day of it to refill the allowance now.
 * Mirrors the backend renewal modes so the wording cannot drift from behaviour.
 */
export function SubscriptionRenewModeChoice(props: Props) {
  const { t } = useTranslation()
  // Refreshing spends a full day of the current card, so it needs one left.
  const refreshDisabled = !props.canRefresh

  const options: {
    mode: SubscriptionRenewMode
    title: string
    description: string
    disabled?: boolean
  }[] = [
    {
      mode: 'extend',
      title: t('Extend validity'),
      description: t(
        'The purchase is queued after the current card, so total validity grows and the allowance refills on its normal reset schedule.'
      ),
    },
    {
      mode: 'refresh',
      title: t('Refresh allowance now'),
      description: t(
        'Spends one day of the purchase to refill the allowance immediately, so the card ends up one day shorter.'
      ),
      disabled: refreshDisabled,
    },
  ]

  return (
    <div className='space-y-2 rounded-md border p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-medium'>{t('Renewal option')}</p>
        {props.allowanceExhausted && (
          <span className='text-destructive text-xs'>
            {t("This period's allowance is used up")}
          </span>
        )}
      </div>
      <RadioGroup
        value={props.value}
        onValueChange={(mode) => props.onChange(mode as SubscriptionRenewMode)}
        className='grid gap-2'
      >
        {options.map((option) => (
          <Label
            key={option.mode}
            htmlFor={`renew-mode-${option.mode}`}
            className={cn(
              'has-data-[checked]:border-primary has-data-[checked]:ring-primary/20 group bg-card flex cursor-pointer items-start gap-2 rounded-md border p-2.5 font-normal transition-all has-data-[checked]:ring-2',
              option.disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            <RadioGroupItem
              id={`renew-mode-${option.mode}`}
              value={option.mode}
              disabled={option.disabled}
              className='mt-0.5'
            />
            <div className='min-w-0'>
              <div className='text-sm font-medium'>{option.title}</div>
              <p className='text-muted-foreground mt-0.5 text-xs'>
                {option.description}
              </p>
            </div>
          </Label>
        ))}
      </RadioGroup>
      {refreshDisabled && (
        <p className='text-muted-foreground text-xs'>
          {t(
            'The current card has less than one day left, so it can only be extended.'
          )}
        </p>
      )}
    </div>
  )
}
