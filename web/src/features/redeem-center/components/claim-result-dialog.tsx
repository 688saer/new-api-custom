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

import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import {
  ShippingAddressForm,
  type ShippingAddressValues,
} from '@/components/shipping-address-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { claimTypeLabelKey } from '../lib/claim-codes'
import type { ClaimCodeClaim } from '../types'

interface ClaimResultDialogProps {
  claim: ClaimCodeClaim | null
  addressSubmitting: boolean
  addressError: string | null
  onOpenChange: (open: boolean) => void
  onSubmitAddress: (values: ShippingAddressValues) => void
}

/** 兑换结果弹窗：展示到账内容，实物则同时收集收货信息。 */
export function ClaimResultDialog(props: ClaimResultDialogProps) {
  const { t } = useTranslation()
  const claim = props.claim

  const renderReward = () => {
    if (claim == null) {
      return null
    }
    if (claim.type === 'quota') {
      return (
        <div className='rounded-lg border border-dashed p-3'>
          <p className='text-muted-foreground text-xs'>
            {t('Balance credited')}
          </p>
          <p className='mt-1 text-lg font-semibold'>+ {claim.quota_display}</p>
        </div>
      )
    }
    if (claim.type === 'subscription') {
      return (
        <div className='rounded-lg border border-dashed p-3'>
          <p className='text-muted-foreground text-xs'>
            {t('Subscription activated')}
          </p>
          <p className='mt-1 text-lg font-semibold'>{claim.plan_title}</p>
        </div>
      )
    }
    if (claim.type === 'card_key') {
      return (
        <div className='rounded-lg border border-dashed p-3'>
          <p className='text-muted-foreground text-xs'>{t('Your code')}</p>
          <div className='mt-1 flex items-center gap-2'>
            <code className='min-w-0 flex-1 truncate font-mono text-sm'>
              {claim.card_content}
            </code>
            <CopyButton
              value={claim.card_content}
              tooltip={t('Copy to clipboard')}
              aria-label={t('Copy to clipboard')}
            />
          </div>
        </div>
      )
    }
    return (
      <div className='space-y-3'>
        <p className='text-sm'>
          {t(
            'Physical prize claimed. Fill in the shipping address so we can send it.'
          )}
        </p>
        <ShippingAddressForm
          idPrefix='claim-code-result'
          initial={{
            receiver_name: claim.receiver_name,
            receiver_phone: claim.receiver_phone,
            receiver_address: claim.receiver_address,
          }}
          submitting={props.addressSubmitting}
          error={props.addressError}
          submitLabel={t('Save shipping address')}
          onSubmit={props.onSubmitAddress}
        />
      </div>
    )
  }

  return (
    <Dialog
      open={claim != null}
      onOpenChange={props.onOpenChange}
      title={t('Redeemed successfully')}
      description={claim?.name}
      contentClassName='sm:max-w-md'
      footer={
        <Button variant='outline' onClick={() => props.onOpenChange(false)}>
          {t('Close')}
        </Button>
      }
    >
      {claim != null && (
        <div className='space-y-3'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='secondary'>
              {t(claimTypeLabelKey(claim.type))}
            </Badge>
            <span className='text-muted-foreground font-mono text-xs'>
              {claim.code}
            </span>
          </div>
          {renderReward()}
          {claim.description !== '' && (
            <p className='text-muted-foreground text-xs whitespace-pre-line'>
              {claim.description}
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}
