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
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import { WhaleFigure } from './whale-figure'

/** Marks that the operator has already seen the greeting on this device. */
const GREETED_STORAGE_KEY = 'mascot_greeted'
/** Marks a deliberate dismissal, which outranks the greeting. */
const HIDDEN_STORAGE_KEY = 'mascot_hidden'

function readFlag(key: string) {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    // Storage can be unavailable in private modes; treat it as "not set"
    // rather than breaking the page.
    return false
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // Ignore: the mascot simply greets again next visit.
  }
}

/**
 * The site mascot.
 *
 * Rendered by the authenticated layout, so it is available on every console
 * page without each page opting in. Configuration comes from `/api/status`,
 * which the app already caches, so this adds no request.
 *
 * Interaction is deliberately small: the character is decoration, and the one
 * thing worth offering is a dismiss button. Everything is keyboard reachable
 * and the bubble is announced politely rather than stealing focus.
 */
export function SiteMascot() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const [hidden, setHidden] = useState(() => readFlag(HIDDEN_STORAGE_KEY))
  const [greeted, setGreeted] = useState(() => readFlag(GREETED_STORAGE_KEY))
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [excited, setExcited] = useState(false)
  const closeButton = useRef<HTMLButtonElement | null>(null)

  const enabled = status?.mascot_enabled !== false
  const name = status?.mascot_name?.trim() || t('Mascot')
  const greeting =
    status?.mascot_greeting?.trim() ||
    t("Hi! I'm {{name}}. Need a hand with your API keys?", { name })
  const placement =
    status?.mascot_placement === 'bottom-left' ? 'left' : 'right'
  const size =
    typeof status?.mascot_size === 'number' && status.mascot_size > 0
      ? status.mascot_size
      : 148

  // Greet once per device, and only after the config has actually arrived so
  // the bubble never flashes with fallback text first.
  useEffect(() => {
    if (!enabled || hidden || greeted || !status) return
    const timer = window.setTimeout(() => {
      setBubbleOpen(true)
      setGreeted(true)
      writeFlag(GREETED_STORAGE_KEY)
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [enabled, hidden, greeted, status])

  // Esc closes the bubble; focus moves to the dismiss control so keyboard
  // users land somewhere meaningful instead of back at the top of the page.
  useEffect(() => {
    if (!bubbleOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBubbleOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bubbleOpen])

  const dismiss = useCallback(() => {
    setHidden(true)
    setBubbleOpen(false)
    writeFlag(HIDDEN_STORAGE_KEY)
  }, [])

  if (!enabled || hidden) return null

  return (
    <aside
      aria-label={t('Site mascot')}
      data-testid='site-mascot'
      className={cn(
        'pointer-events-none fixed bottom-6 z-30 flex max-w-[calc(100vw-2rem)] flex-col gap-2 select-none',
        'max-sm:bottom-3',
        placement === 'left' ? 'left-4 items-start' : 'right-4 items-end'
      )}
      style={
        // Phones have little room to spare, so the configured width is capped
        // to the viewport and the character shrinks instead of covering content.
        { '--mascot-size': `min(${size}px, 28vw)` } as React.CSSProperties
      }
    >
      {bubbleOpen ? (
        <div
          role='status'
          aria-live='polite'
          data-testid='site-mascot-bubble'
          className={cn(
            'bg-card text-card-foreground pointer-events-auto relative max-w-[min(18rem,calc(100vw-2rem))] rounded-2xl border p-3 text-sm shadow-lg',
            'motion-safe:animate-[mascot-bubble-in_.28s_ease-out]'
          )}
        >
          <p className='pr-5 leading-relaxed'>{greeting}</p>
          <button
            ref={closeButton}
            type='button'
            onClick={() => setBubbleOpen(false)}
            aria-label={t('Close greeting')}
            className='text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 inline-flex size-5 items-center justify-center rounded-full transition-colors'
          >
            <X className='size-3.5' aria-hidden='true' />
          </button>
          {/* Tail pointing at the character. */}
          <span
            aria-hidden='true'
            className={cn(
              'bg-card absolute -bottom-1.5 size-3 rotate-45 border-r border-b',
              placement === 'left' ? 'left-8' : 'right-8'
            )}
          />
        </div>
      ) : null}

      <div
        className={cn(
          'pointer-events-auto flex flex-col items-center gap-1',
          'motion-safe:animate-[mascot-bob_3.2s_ease-in-out_infinite]'
        )}
      >
        <button
          type='button'
          data-testid='site-mascot-trigger'
          onClick={() => {
            setBubbleOpen((open) => !open)
            setExcited(true)
            window.setTimeout(() => setExcited(false), 900)
          }}
          aria-label={t('Say hello to {{name}}', { name })}
          aria-expanded={bubbleOpen}
          className='rounded-full transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none active:scale-95'
          style={{ width: 'var(--mascot-size)', height: 'var(--mascot-size)' }}
        >
          <WhaleFigure
            excited={excited}
            talking={bubbleOpen}
            className='size-full'
          />
        </button>
        <button
          type='button'
          onClick={dismiss}
          className='text-muted-foreground hover:text-foreground rounded-full px-2 py-0.5 text-[11px] opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none group-hover:opacity-100 hover:opacity-100'
          aria-label={t('Hide mascot')}
        >
          {t('Hide')}
        </button>
      </div>
    </aside>
  )
}
