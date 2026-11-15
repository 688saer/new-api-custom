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

import { Dialog } from '@/components/dialog'
import {
  ShippingAddressForm,
  type ShippingAddressValues,
} from '@/components/shipping-address-form'

import type { ClaimCodeClaim } from '../types'

interface ClaimAddressDialogProps {
  /** 需要补填收货信息的记录，null 表示关闭。 */
  claim: ClaimCodeClaim | null
  submitting: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ShippingAddressValues) => void
}

/** 给已经领取的实物奖品补填收货信息。 */
export function ClaimAddressDialog(props: ClaimAddressDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={props.claim != null}
      onOpenChange={props.onOpenChange}
      title={t('Fill in shipping address')}
      description={props.claim?.name}
      contentClassName='sm:max-w-md'
    >
      {props.claim != null && (
        <ShippingAddressForm
          idPrefix='claim-code-address'
          initial={{
            receiver_name: props.claim.receiver_name,
            receiver_phone: props.claim.receiver_phone,
            receiver_address: props.claim.receiver_address,
          }}
          submitting={props.submitting}
          error={props.error}
          submitLabel={t('Save shipping address')}
          onSubmit={props.onSubmit}
        />
      )}
    </Dialog>
  )
}
