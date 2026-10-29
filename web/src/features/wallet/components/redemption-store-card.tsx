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
import { ArrowRight, Gift, TicketPercent } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'

interface RedemptionStoreCardProps {
  /** 发卡（兑换码）购买地址，来自充值配置 */
  topupLink?: string
}

/**
 * 发卡购买入口。放在钱包页顶部单独占一行，比原来藏在兑换输入框下面的
 * 一行小字更容易被发现，购买后回到下方兑换区输入卡密即可到账。
 */
export function RedemptionStoreCard(props: RedemptionStoreCardProps) {
  const { t } = useTranslation()

  if (!props.topupLink) {
    return null
  }

  const handleFocusRedeem = () => {
    const input = document.querySelector('#redemption-code')
    if (input instanceof HTMLInputElement) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' })
      input.focus({ preventScroll: true })
    }
  }

  return (
    <Card className='from-primary/12 via-primary/4 to-primary/10 border-primary/30 relative overflow-hidden bg-gradient-to-br shadow-none'>
      <CardContent className='flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5'>
        <div className='flex min-w-0 items-start gap-3'>
          <IconBadge tone='warning' size='lg' className='shrink-0'>
            <Gift />
          </IconBadge>
          <div className='min-w-0 space-y-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-base font-semibold sm:text-lg'>
                {t('Buy a redemption code')}
              </span>
              <span className='border-primary/30 text-primary rounded-full border px-2 py-0.5 text-[11px] font-medium'>
                {t('Instant delivery')}
              </span>
            </div>
            <p className='text-muted-foreground text-xs leading-relaxed sm:text-sm'>
              {t(
                'Get a code after checkout, then paste it into the redemption box below to top up your balance.'
              )}
            </p>
          </div>
        </div>

        <div className='flex shrink-0 items-center gap-2 sm:flex-col-reverse sm:items-stretch'>
          <Button
            className='flex-1 gap-2 sm:flex-none'
            onClick={() =>
              window.open(props.topupLink, '_blank', 'noopener,noreferrer')
            }
          >
            <TicketPercent className='h-4 w-4' />
            {t('Buy now')}
            <ArrowRight className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            className='flex-1 sm:flex-none'
            onClick={handleFocusRedeem}
          >
            {t('I have a code')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
