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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { handleServerError } from '@/lib/handle-server-error'

import { resetSubscriptionQuotaNow } from '../../api'
import type { UserSubscription } from '../../types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription: UserSubscription | null
  onSuccess?: () => void | Promise<void>
}

/**
 * Confirms spending one day of the card's validity to refill the allowance that
 * ran out, so the user does not have to wait for the next scheduled reset.
 */
export function ResetQuotaNowDialog(props: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  if (!props.open || !props.subscription) return null

  const subscription = props.subscription
  const daysLeft = Math.max(
    0,
    Math.ceil((subscription.end_time - Date.now() / 1000) / 86400)
  )

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await resetSubscriptionQuotaNow(subscription.id)
      if (res.success) {
        toast.success(res.message || t('Allowance refilled'))
        props.onOpenChange(false)
        await props.onSuccess?.()
      } else {
        handleServerError(res, t('Reset failed'))
      }
    } catch (error) {
      handleServerError(error, t('Reset failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={props.onOpenChange}
      title={t('Refill allowance now')}
      desc={t(
        'This spends one day of your card validity ({{days}} days left) and refills this period allowance immediately. Continue?',
        { days: daysLeft }
      )}
      handleConfirm={handleConfirm}
      isLoading={loading}
      confirmText={t('Refill now')}
    />
  )
}
