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
import { Loader2, RefreshCw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import { handleServerError } from '@/lib/handle-server-error'

import { requestAlipayOrderStatus } from '../../api'

// 支付宝的异步通知通常一两秒就到，但会抖动；这里轮询兜底：用户付完款余额
// 自己跳上去，不用刷新页面，也不用再点任何按钮。
const POLL_INTERVAL_MS = 4000
const POLL_ATTEMPTS = 45

interface AlipayQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qrCode: string
  tradeNo: string
  /** Called once the order stops being pending, so the wallet can refresh. */
  onPaid: () => void
}

/**
 * Renders a 当面付 (precreate) order.
 *
 * The QR is drawn locally instead of being sent to an image service, so the
 * payment link never leaves the browser. The order is checked against the
 * gateway every few seconds, which is also what the manual button does.
 */
export function AlipayQrDialog({
  open,
  onOpenChange,
  qrCode,
  tradeNo,
  onPaid,
}: AlipayQrDialogProps) {
  const { t } = useTranslation()
  const [checking, setChecking] = useState(false)
  const settledRef = useRef(false)

  const settle = useCallback(() => {
    settledRef.current = true
    toast.success(t('Payment received, balance updated'))
    onPaid()
    onOpenChange(false)
  }, [onPaid, onOpenChange, t])

  const checkStatus = useCallback(
    async (silent: boolean) => {
      if (!tradeNo || settledRef.current) {
        return
      }
      setChecking(true)
      try {
        const response = await requestAlipayOrderStatus({ trade_no: tradeNo })
        if (response.status === 'success') {
          settle()
          return
        }
        if (response.status === 'closed') {
          settledRef.current = true
          toast.error(
            t('This order has been closed. Please start a new payment.')
          )
          onPaid()
          return
        }
        if (!silent) {
          toast.info(t('No payment received yet'))
        }
      } catch (error) {
        if (!silent) {
          handleServerError(error, t('Failed to check the payment'))
        }
      } finally {
        setChecking(false)
      }
    },
    [onPaid, settle, t, tradeNo]
  )

  // 定时器只认最新的检查函数，避免回调身份变化把轮询重置掉。
  const checkRef = useRef(checkStatus)
  useEffect(() => {
    checkRef.current = checkStatus
  }, [checkStatus])

  useEffect(() => {
    if (!open || !tradeNo) {
      return
    }
    settledRef.current = false
    let attempts = 0
    const timer = window.setInterval(() => {
      attempts += 1
      if (settledRef.current || attempts > POLL_ATTEMPTS) {
        window.clearInterval(timer)
        return
      }
      void checkRef.current(true)
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [open, tradeNo])

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
          <p className='text-muted-foreground text-center text-xs'>
            {t('Payment status is checked automatically every few seconds.')}
          </p>
        </div>

        <AlertDialogFooter>
          <Button
            variant='outline'
            disabled={checking || !tradeNo}
            onClick={() => void checkStatus(false)}
          >
            {checking ? (
              <Loader2 className='mr-1.5 size-4 animate-spin' />
            ) : (
              <RefreshCw className='mr-1.5 size-4' />
            )}
            {t('Check payment status')}
          </Button>
          <AlertDialogCancel>{t('Close')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
