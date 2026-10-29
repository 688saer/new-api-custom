import { Loader2 } from 'lucide-react'
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
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { handleServerError } from '@/lib/handle-server-error'

import { signPurchaseAgreement } from '../api'
import { useAgreementGate } from '../lib/gate'

/**
 * 购买协议弹窗：展示后台维护的协议正文，勾选后才能继续购买。
 * 同意时把签署记录写到服务端，失败则不放行。
 */
export function PurchaseAgreementGate() {
  const { t } = useTranslation()
  const request = useAgreementGate((state) => state.request)
  const settle = useAgreementGate((state) => state.settle)
  const [accepted, setAccepted] = useState(false)
  const [signing, setSigning] = useState(false)

  const agreementId = request?.agreement.version ?? null
  const scene = request?.scene ?? null

  useEffect(() => {
    setAccepted(false)
    setSigning(false)
  }, [agreementId, scene])

  if (!request) {
    return null
  }

  const handleAccept = async () => {
    setSigning(true)
    try {
      const response = await signPurchaseAgreement(request.scene)
      if (response.success) {
        toast.success(t('Purchase agreement accepted'))
        settle(true)
        return
      }
      handleServerError(response, t('Failed to record your agreement'))
    } catch (error) {
      handleServerError(error, t('Failed to record your agreement'))
    } finally {
      setSigning(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          settle(false)
        }
      }}
      title={request.agreement.title}
      description={t('Version {{version}} · Please read before purchasing', {
        version: request.agreement.version,
      })}
      contentClassName='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-2xl'
      footerClassName='grid grid-cols-2 gap-2 sm:flex'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            variant='outline'
            onClick={() => settle(false)}
            disabled={signing}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleAccept} disabled={!accepted || signing}>
            {signing && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {t('Agree and continue')}
          </Button>
        </>
      }
    >
      <div className='bg-muted/40 max-h-[46vh] overflow-y-auto rounded-lg border p-4 text-sm leading-relaxed whitespace-pre-wrap'>
        {request.agreement.content}
      </div>
      <label className='flex cursor-pointer items-start gap-3 text-sm'>
        <Checkbox
          checked={accepted}
          onCheckedChange={(checked) => setAccepted(checked === true)}
          className='mt-0.5'
          aria-label={t('I have read and agree to the purchase agreement')}
        />
        <span>
          {t('I have read and agree to the purchase agreement')}
          <span className='text-muted-foreground'>
            {` (${request.agreement.title} v${request.agreement.version})`}
          </span>
        </span>
      </label>
    </Dialog>
  )
}
