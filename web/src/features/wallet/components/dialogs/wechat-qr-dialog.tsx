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
import { Loader2, RefreshCw, SquareArrowOutUpRight } from 'lucide-react'
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

import { requestWechatOrderStatus } from '../../api'

// 微信的异步通知一般几秒内就到，轮询只是兜底：付完款余额会自己跳上去。
const POLL_INTERVAL_MS = 4000
const POLL_ATTEMPTS = 45

// 手机浏览器没法扫自己屏幕上的二维码，所以移动端额外给一个 weixin:// 唤起入口。
function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }
  return /Android|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(navigator.userAgent)
}

interface WechatQrDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  codeUrl: string
  tradeNo: string
  /** Called once the order stops being pending, so the wallet can refresh. */
  onPaid: () => void
}

/**
 * Renders a WeChat Pay (Native) order.
 *
 * Native only hands back a `weixin://` link, which this dialog draws as a QR for
 * desktop users and turns into a one-tap "open in WeChat" button on phones.
 */
export function WechatQrDialog({
  open,
  onOpenChange,
  codeUrl,
  tradeNo,
  onPaid,
}: WechatQrDialogProps) {
  const { t } = useTranslation()
  const [checking, setChecking] = useState(false)
  const settledRef = useRef(false)
  const mobile = isMobileBrowser()

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
        const response = await requestWechatOrderStatus({ trade_no: tradeNo })
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
            {t('Scan to pay with WeChat')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {mobile
              ? t(
                  'Tap "Open in WeChat" to finish the payment, or scan the code with another device.'
                )
              : t(
                  'Open WeChat and scan the code. The balance arrives automatically once payment succeeds.'
                )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='flex flex-col items-center gap-3 py-4'>
          <div className='rounded-lg bg-white p-3'>
            <QRCodeSVG value={codeUrl} size={196} level='M' />
          </div>
          {mobile && codeUrl ? (
            <Button
              className='w-full'
              render={<a href={codeUrl} rel='noreferrer' />}
            >
              <SquareArrowOutUpRight className='mr-1.5 size-4' />
              {t('Open in WeChat')}
            </Button>
          ) : null}
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
