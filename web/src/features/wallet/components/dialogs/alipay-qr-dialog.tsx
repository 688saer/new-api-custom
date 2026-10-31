import { RefreshCw } from 'lucide-react'
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
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface AlipayQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrCode: string
  tradeNo: string
  onRefresh: () => void
}

/**
 * Renders a 当面付 (precreate) order.
 *
 * The QR is drawn locally instead of being sent to an image service, so the
 * payment link never leaves the browser.
 */
export function AlipayQrDialog({
  open,
  onOpenChange,
  qrCode,
  tradeNo,
  onRefresh,
}: AlipayQrDialogProps) {
  const { t } = useTranslation()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-sm'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-xl font-semibold'>
            {t('Scan to pay with Alipay')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'Open Alipay and scan the code. The balance arrives automatically once payment succeeds.'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='flex flex-col items-center gap-3 py-4'>
          <div className='rounded-lg bg-white p-3'>
            <QRCodeSVG value={qrCode} size={196} level='M' />
          </div>
          {tradeNo ? (
            <p className='text-muted-foreground text-xs'>
              {t('Order number: {{tradeNo}}', { tradeNo })}
            </p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <Button variant='outline' onClick={onRefresh}>
            <RefreshCw className='mr-1.5 size-4' />
            {t('Refresh balance')}
          </Button>
          <AlertDialogCancel>{t('Close')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
