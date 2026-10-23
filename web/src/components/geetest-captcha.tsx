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
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Everything GeeTest V4 hands back once a challenge is solved. */
export interface GeeTestResult {
  lot_number: string
  captcha_output: string
  pass_token: string
  gen_time: string
}

interface GeeTestInstance {
  onReady: (callback: () => void) => void
  onSuccess: (callback: () => void) => void
  onError: (callback: (error: unknown) => void) => void
  onClose: (callback: () => void) => void
  getValidate: () => GeeTestResult | undefined
  showCaptcha: () => void
  destroy: () => void
}

declare global {
  interface Window {
    initGeetest4?: (
      options: Record<string, unknown>,
      callback: (captcha: GeeTestInstance) => void
    ) => void
  }
}

const SCRIPT_ID = 'geetest-v4'
const SCRIPT_URL = 'https://static.geetest.com/v4/gt4.js'

interface GeeTestCaptchaProps {
  /** Public captcha id from the status payload. */
  captchaId: string
  /** Called with the solved challenge, already serialized for the request. */
  onVerify: (payload: string) => void
  /** Called when a solved challenge is dropped, e.g. after a failed request. */
  onReset?: () => void
  /** Set once the caller has stored a payload, so the state can be shown. */
  verified: boolean
  className?: string
}

/**
 * GeeTest V4 challenge for one form.
 *
 * The widget opens a popup on demand rather than binding inline: a modal-owned
 * challenge can be reset cleanly after a rejected request, which matters
 * because each solved payload is single-use.
 */
export function GeeTestCaptcha(props: GeeTestCaptchaProps) {
  const { t, i18n } = useTranslation()
  const instance = useRef<GeeTestInstance | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const captchaId = props.captchaId

  // The callbacks are recreated on every render, so keep them in a ref and let
  // the instance be created once per captcha id.
  const handlers = useRef({ onVerify: props.onVerify })
  useEffect(() => {
    handlers.current = { onVerify: props.onVerify }
  })

  useEffect(() => {
    if (!captchaId) return
    let cancelled = false

    const create = () => {
      if (cancelled || !window.initGeetest4) return
      window.initGeetest4(
        {
          captchaId,
          product: 'popup',
          language: i18n.resolvedLanguage === 'zh' ? 'zho' : 'eng',
          hideBar: ['close'],
        },
        (captcha) => {
          if (cancelled) {
            captcha.destroy()
            return
          }
          instance.current = captcha
          captcha.onSuccess(() => {
            const result = captcha.getValidate()
            if (!result) {
              setFailed(true)
              return
            }
            setFailed(false)
            handlers.current.onVerify(JSON.stringify(result))
          })
          captcha.onError(() => setFailed(true))
          captcha.onReady(() => setReady(true))
        }
      )
    }

    if (window.initGeetest4) {
      create()
      return () => {
        cancelled = true
        instance.current?.destroy()
        instance.current = null
      }
    }

    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', create)
      return () => {
        cancelled = true
        existing.removeEventListener('load', create)
        instance.current?.destroy()
        instance.current = null
      }
    }

    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_URL
    script.async = true
    script.onload = create
    script.onerror = () => setFailed(true)
    document.head.appendChild(script)

    return () => {
      cancelled = true
      instance.current?.destroy()
      instance.current = null
    }
  }, [captchaId, i18n.resolvedLanguage])

  if (props.verified) {
    return (
      <div
        className={cn(
          'border-primary/30 bg-primary/5 text-primary flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
          props.className
        )}
      >
        <CheckCircle2 className='size-4 shrink-0' />
        <span className='flex-1'>{t('Human verification passed')}</span>
        {props.onReset ? (
          <Button
            type='button'
            variant='link'
            size='sm'
            className='h-auto p-0 text-xs'
            onClick={props.onReset}
          >
            {t('Reset')}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', props.className)}>
      <Button
        type='button'
        variant='outline'
        className='w-full justify-center gap-2'
        disabled={!ready && !failed}
        onClick={() => instance.current?.showCaptcha()}
      >
        <ShieldCheck className='size-4' />
        {ready ? t('Click to complete human verification') : t('Loading human verification...')}
      </Button>
      {failed ? (
        <p className='text-destructive text-xs'>
          {t('Human verification could not load. Check your network and try again.')}
        </p>
      ) : null}
    </div>
  )
}
