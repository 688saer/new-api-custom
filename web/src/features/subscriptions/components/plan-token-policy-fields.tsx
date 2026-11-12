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
import { Coins } from 'lucide-react'
import type { Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { SideDrawerSection } from '@/components/drawer-layout'
import { MultiSelect, type Option } from '@/components/multi-select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { toIntlLocale } from '@/i18n/languages'

import { formatTokenAllowance, type PlanFormValues } from '../lib'

/** Allowance presets in raw tokens, so an operator can pick 2 亿 in one click. */
const TOKEN_LIMIT_PRESETS = [
  { tokens: 0, labelKey: 'Unlimited' },
  { tokens: 10_000_000, labelKey: '10M' },
  { tokens: 100_000_000, labelKey: '100M' },
  { tokens: 200_000_000, labelKey: '200M' },
  { tokens: 500_000_000, labelKey: '500M' },
  { tokens: 1_000_000_000, labelKey: '1B' },
] as const

interface Props {
  control: Control<PlanFormValues>
  modelOptions: Option[]
  modelOptionsLoading: boolean
  /** Watched `token_limit`, used for the live preview and the hard-stop hint. */
  tokenLimit: number
  /** Watched `allow_wallet_overflow`; keeping it on defeats a token hard stop. */
  allowWalletOverflow: boolean
}

/**
 * Token allowance and model-access policy for a subscription plan. Rendered by
 * the plan drawer; kept separate so the drawer stays readable.
 */
export function PlanTokenPolicyFields(props: Props) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const allowancePreview = formatTokenAllowance(props.tokenLimit, t, locale)

  return (
    <SideDrawerSection>
      <h3 className='flex items-center gap-2 text-sm font-medium'>
        <IconBadge tone='chart-3' size='xs'>
          <Coins />
        </IconBadge>
        {t('Token Allowance & Model Access')}
      </h3>

      <FormField
        control={props.control}
        name='token_limit'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Token Limit')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                type='number'
                min={0}
                step={1}
                placeholder={t('e.g. 200000000')}
                onChange={(e) =>
                  field.onChange(Number.parseInt(e.target.value, 10) || 0)
                }
              />
            </FormControl>
            <FormDescription>
              {t(
                'Prompt and completion tokens added together. The allowance refills on the reset cycle above: with no reset it covers the whole card, with a daily or weekly cycle you get one allowance per cycle. Requests are rejected once this period is spent. 0 means no token cap.'
              )}
            </FormDescription>
            <FormMessage />
            <div className='flex flex-wrap items-center gap-1.5'>
              {TOKEN_LIMIT_PRESETS.map((preset) => (
                <Button
                  key={preset.tokens}
                  type='button'
                  size='sm'
                  variant={
                    Number(field.value || 0) === preset.tokens
                      ? 'default'
                      : 'outline'
                  }
                  className='h-7 px-2 text-xs'
                  onClick={() => field.onChange(preset.tokens)}
                >
                  {preset.tokens === 0 ? t('Unlimited') : preset.labelKey}
                </Button>
              ))}
              {allowancePreview && (
                <span className='text-muted-foreground text-xs'>
                  {allowancePreview}
                </span>
              )}
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={props.control}
        name='allowed_models'
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('Allowed Models')}</FormLabel>
            <FormControl>
              <MultiSelect
                options={props.modelOptions}
                selected={field.value || []}
                onChange={field.onChange}
                allowCreate
                maxVisibleChips={6}
                placeholder={
                  props.modelOptionsLoading
                    ? t('Loading models...')
                    : t('Any model')
                }
                emptyText={t('No matching models')}
                createLabel={t('Add "{{value}}"')}
              />
            </FormControl>
            <FormDescription>
              {t(
                'Leave empty to allow every model. Names outside this list are rejected before any quota is charged.'
              )}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {props.tokenLimit > 0 && props.allowWalletOverflow && (
        <Alert>
          <AlertDescription>
            {t(
              'This plan allows wallet balance after the token allowance is used up, so calls keep working. Turn that switch off to stop the user at the cap.'
            )}
          </AlertDescription>
        </Alert>
      )}
    </SideDrawerSection>
  )
}
