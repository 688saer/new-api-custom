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
import { CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react'
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
  reset?: () => void
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

/** Give the SDK this long to produce an instance before offering a retry. */
const INIT_TIMEOUT_MS = 15000

/**
 * One script tag serves every form on the page, so the load is shared. A
 * rejected load resolves `false`; `discardGeeTestScript` clears the cache so a
 * retry starts over.
 */
let geetestScriptPromise: Promise<boolean> | null = null

function loadGeeTestScript(): Promise<boolean> {
  if (window.initGeetest4) return Promise.resolve(true)
  if (geetestScriptPromise) return geetestScriptPromise

  geetestScriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })

  return geetestScriptPromise
}

function discardGeeTestScript() {
  geetestScriptPromise = null
  document.getElementById(SCRIPT_ID)?.remove()
}

type Phase = 'loading' | 'ready' | 'error'

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

function geetestLanguage(language: string) {
  return language.toLowerCase().startsWith('zh') ? 'zho' : 'eng'
}

/**
 * GeeTest V4 challenge for one form.
 *
 * Uses the popup product: the account behind the configured captcha id only
 * supports the popup challenge, and `bind` silently leaves an empty hidden
 * widget behind instead of an inline one. A popup also keeps the form layout
 * untouched and lets GeeTest lay itself out for phones on its own.
 *
 * Two failure modes matter more than the happy path, because both present to
 * the user as "the button does nothing":
 *
 * 1. GeeTest's loader throws an uncaught error when the init-level `onError` is
 *    missing, and its callback then never runs. So `onError` is always passed,
 *    and a watchdog surfaces a stall instead of waiting forever.
 * 2. The trigger button must never be disabled on a state the widget controls.
 *    While the challenge is still loading a press explains the wait, and after
 *    a failure the same button retries.
 *
 * The overlay is also kept usable inside a modal dialog, which sets
 * `pointer-events: none` on `<body>` where GeeTest appends itself.
 */
export function GeeTestCaptcha(props: GeeTestCaptchaProps) {
  const { t, i18n } = useTranslation()
  const instance = useRef<GeeTestInstance | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [attempt, setAttempt] = useState(0)
  const captchaId = props.captchaId
  const language = geetestLanguage(
    i18n.resolvedLanguage || i18n.language || 'en'
  )

  // Callbacks change on every render; keep them in a ref so the instance is
  // created once per captcha id instead of being torn down each render.
  const handlers = useRef({ onVerify: props.onVerify })
  useEffect(() => {
    handlers.current = { onVerify: props.onVerify }
  })

  // Keep the body-attached overlay interactive even inside a modal dialog.
  useEffect(() => {
    const enableOverlay = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('.geetest_captcha, .geetest_popup_wrap')) return
      const parent = target.parentElement
      if (parent === document.body) parent.style.pointerEvents = 'auto'
    }
    document.addEventListener('pointerdown', enableOverlay, true)
    return () => {
      document.removeEventListener('pointerdown', enableOverlay, true)
    }
  }, [])

  useEffect(() => {
    if (!captchaId || props.verified) return

    let cancelled = false
    let initTimer: ReturnType<typeof setTimeout> | undefined
    setPhase('loading')

    const fail = () => {
      if (cancelled) return
      if (initTimer) clearTimeout(initTimer)
      setPhase('error')
    }

    const create = () => {
      if (cancelled || !window.initGeetest4) {
        fail()
        return
      }
      try {
        window.initGeetest4(
          {
            captchaId,
            product: 'popup',
            language,
            // Without this the loader rethrows and the callback never fires.
            onError: () => fail(),
          },
          (captcha) => {
            if (cancelled) {
              captcha.destroy()
              return
            }
            if (initTimer) clearTimeout(initTimer)
            instance.current = captcha
            captcha.onSuccess(() => {
              const result = captcha.getValidate()
              if (!result) {
                fail()
                return
              }
              handlers.current.onVerify(JSON.stringify(result))
            })
            // A failed challenge is recoverable: the user can slide again, so
            // only the load itself is treated as fatal.
            captcha.onError(() => undefined)
            captcha.onReady(() => setPhase('ready'))
            // `onReady` can lag behind the instance; the button stays usable
            // either way, so a late event must not strand the form.
            setPhase('ready')
          }
        )
      } catch {
        fail()
      }
    }

    if (attempt > 0) discardGeeTestScript()

    void loadGeeTestScript().then((loaded) => {
      if (cancelled) return
      if (!loaded) {
        fail()
        return
      }
      create()
    })

    initTimer = setTimeout(() => {
      if (cancelled || instance.current) return
      fail()
    }, INIT_TIMEOUT_MS)

    return () => {
      cancelled = true
      if (initTimer) clearTimeout(initTimer)
      instance.current?.destroy()
      instance.current = null
    }
  }, [captchaId, language, attempt, props.verified])

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
            onClick={() => {
              instance.current?.reset?.()
              props.onReset?.()
            }}
          >
            {t('Reset')}
          </Button>
        ) : null}
      </div>
    )
  }

  const label = () => {
    if (phase === 'error') return t('Retry human verification')
    if (phase === 'ready') return t('Click to complete human verification')
    return t('Loading human verification...')
  }

  return (
    <div className={cn('space-y-1', props.className)}>
      <Button
        type='button'
        variant='outline'
        className='w-full justify-center gap-2'
        aria-busy={phase === 'loading'}
        onClick={() => {
          if (phase === 'error') {
            setAttempt((value) => value + 1)
            return
          }
          instance.current?.showCaptcha()
        }}
      >
        {phase === 'error' ? (
          <RefreshCw className='size-4' />
        ) : (
          <ShieldCheck className='size-4' />
        )}
        {label()}
      </Button>
      {phase === 'error' ? (
        <p className='text-destructive text-xs'>
          {t(
            'Human verification could not load. Check your network and try again.'
          )}
        </p>
      ) : null}
    </div>
  )
}
