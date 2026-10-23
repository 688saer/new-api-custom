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
  appendTo: (target: HTMLElement | string) => unknown
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
 * `appendTo` is what makes this work: GeeTest renders its own 260x50 "click to
 * verify" button into the given container, and clicking that button is what
 * opens the puzzle. Without `appendTo` the widget builds its DOM but shows
 * nothing at all, which is why an earlier version that called `showCaptcha()`
 * from a custom button appeared completely dead.
 *
 * `bind` is not an option: for this captcha id it leaves a hidden 0x0 element
 * behind and never renders a trigger. `popup` and `float` both render the
 * inline trigger, and `popup` is used so the puzzle opens in a dialog instead
 * of GeeTest's own floating panel.
 *
 * Failure handling matters more than the happy path. GeeTest's loader throws an
 * uncaught error when the init-level `onError` is missing, and its callback then
 * never runs. So: always pass `onError`, watchdog a stall, and let the user
 * retry instead of leaving a dead widget on screen.
 */
export function GeeTestCaptcha(props: GeeTestCaptchaProps) {
  const { t, i18n } = useTranslation()
  const instance = useRef<GeeTestInstance | null>(null)
  const host = useRef<HTMLDivElement | null>(null)
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

  useEffect(() => {
    if (!captchaId || props.verified) return
    const container = host.current
    if (!container) return

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
            // Renders the trigger button into the container.
            captcha.appendTo(container)
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

  return (
    <div className={cn('space-y-1', props.className)}>
      {phase === 'loading' ? (
        <span className='text-muted-foreground flex items-center justify-center gap-2 text-sm'>
          <ShieldCheck className='size-4 shrink-0' />
          {t('Loading human verification...')}
        </span>
      ) : null}
      {/* GeeTest owns this node's children, so React renders nothing inside it.
          It sizes the trigger itself and stays centred at every breakpoint. */}
      <div
        ref={host}
        className='flex min-h-10 w-full items-center justify-center [&>div]:max-w-full'
        aria-busy={phase === 'loading'}
      />
      {phase === 'error' ? (
        <div className='space-y-1'>
          <p className='text-destructive text-xs'>
            {t(
              'Human verification could not load. Check your network and try again.'
            )}
          </p>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='w-full justify-center gap-2'
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw className='size-4' />
            {t('Retry human verification')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
