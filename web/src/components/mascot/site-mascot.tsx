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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { cn } from '@/lib/utils'

import { MASCOT_CATALOG } from './catalog'
import {
  GREETING_PORTRAIT,
  type MascotPortrait,
  portraitUrl,
  randomReactionPortrait,
} from './portraits'
import { randomClickClip } from './use-mascot-player'
import { useMascotDrag } from './use-mascot-drag'
import { useMascotPlayer } from './use-mascot-player'

/** Marks that the greeting has already been shown on this device. */
const GREETED_STORAGE_KEY = 'mascot_greeted'
/** Marks a deliberate dismissal, which outranks the greeting. */
const HIDDEN_STORAGE_KEY = 'mascot_hidden'

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    // Storage can be unavailable in private modes; treat it as "not set"
    // rather than breaking the page.
    return false
  }
}

function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // Ignore: the mascot simply greets again next visit.
  }
}

/** Respect the OS-level motion preference before loading any video. */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * The site mascot.
 *
 * A transparent animated character that idles in a corner of the console,
 * responds to clicks, and can be dragged and thrown around. Rendered by the
 * authenticated layout, so every page gets it without opting in.
 *
 * Configuration comes from `/api/status`, which the app already caches, so this
 * adds no request. The clips are fetched lazily: the idle loop loads first and
 * everything else arrives on demand, keeping the initial cost to one file.
 */
export function SiteMascot() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const [hidden, setHidden] = useState(() => readFlag(HIDDEN_STORAGE_KEY))
  const [greeted, setGreeted] = useState(() => readFlag(GREETED_STORAGE_KEY))
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [portrait, setPortrait] = useState<MascotPortrait>(GREETING_PORTRAIT)
  const [motionAllowed, setMotionAllowed] = useState(() => !prefersReducedMotion())

  const stageRef = useRef<HTMLDivElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const enabled = status?.mascot_enabled !== false
  const name = status?.mascot_name?.trim() || t('Mascot')
  const greeting =
    status?.mascot_greeting?.trim() ||
    t("Hi! I'm {{name}}. Need a hand with your API keys?", { name })
  const placement = status?.mascot_placement === 'bottom-left' ? 'left' : 'right'
  const size =
    typeof status?.mascot_size === 'number' && status.mascot_size > 0
      ? status.mascot_size
      : 148

  // Re-read the media query when it changes, so toggling the OS setting does not
  // require a reload.
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const onChange = () => setMotionAllowed(!query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const active = enabled && !hidden

  const player = useMascotPlayer({
    paused: !active || !motionAllowed,
    catalog: MASCOT_CATALOG,
  })

  const handleClick = useCallback(() => {
    setBubbleOpen((open) => {
      // Only swap the picture when opening, so the bubble the user just read
      // does not flicker to a different face as it closes.
      if (!open) setPortrait(randomReactionPortrait())
      return !open
    })
    player.playOnce(randomClickClip())
  }, [player])

  const drag = useMascotDrag({
    elementRef: wrapperRef,
    dock: placement === 'left' ? 'left' : 'right',
    onDragStart: () => player.playLoop(MASCOT_CATALOG.drag[0]),
    onDragEnd: () => player.resumeChain(),
    onClick: handleClick,
  })

  // Greet once per device, and only after the config has arrived so the bubble
  // never flashes fallback text first.
  useEffect(() => {
    if (!active || greeted || !status) return
    const timer = window.setTimeout(() => {
      setBubbleOpen(true)
      setGreeted(true)
      writeFlag(GREETED_STORAGE_KEY)
    }, 1400)
    return () => window.clearTimeout(timer)
  }, [active, greeted, status])

  // Esc closes the bubble.
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

  // The stage is a full-viewport, click-through layer; only the character itself
  // accepts pointer events. That lets a thrown mascot fly anywhere without the
  // layer swallowing clicks meant for the page.
  const stageStyle = useMemo(
    () =>
      ({
        '--mascot-size': `min(${size}px, 26vw)`,
      }) as React.CSSProperties,
    [size]
  )

  if (!active) return null

  const mirror = player.facingRight ? -1 : 1

  return (
    <div
      ref={stageRef}
      data-testid='site-mascot'
      className='pointer-events-none fixed inset-0 z-30 overflow-hidden'
      style={stageStyle}
    >
      <div
        ref={wrapperRef}
        data-testid='site-mascot-character'
        className={cn(
          'pointer-events-auto fixed cursor-grab touch-none select-none active:cursor-grabbing',
          // Laid out at the viewport origin and placed entirely by its transform,
          // so a dragged position and the translate offset are the same number.
          'top-0 left-0'
        )}
        style={{
          width: 'var(--mascot-size)',
          transformOrigin: 'center bottom',
          // The squash animation writes these; keeping them on the wrapper means
          // the videos never need to be re-laid-out.
          ['--mascot-squash-x' as string]: '1',
          ['--mascot-squash-y' as string]: '1',
        }}
        onPointerDown={drag.onPointerDown}
      >
        <div
          className='relative'
          style={{
            transform: `scaleX(${mirror}) scale(var(--mascot-squash-x), var(--mascot-squash-y))`,
            transition: 'transform 60ms linear',
          }}
        >
          <video
            ref={player.frontRef}
            data-testid='site-mascot-video'
            className='block w-full transition-opacity duration-150'
            style={{ opacity: player.frontIsA ? 1 : 0 }}
            muted
            playsInline
            aria-hidden='true'
          />
          <video
            ref={player.backRef}
            className='absolute inset-0 block w-full transition-opacity duration-150'
            style={{ opacity: player.frontIsA ? 0 : 1 }}
            muted
            playsInline
            aria-hidden='true'
          />
        </div>

        {/*
          The character is a drag surface, so it cannot also be a <button>:
          a button would fire click on pointerup even after a long drag. The
          accessible affordance is this invisible overlay button instead, which
          keyboard users reach with Tab and screen readers announce.
        */}
        <button
          type='button'
          data-testid='site-mascot-trigger'
          aria-label={t('Say hello to {{name}}', { name })}
          aria-expanded={bubbleOpen}
          onClick={(event) => {
            // Pointer presses are already handled by the drag hook's release
            // path; letting the click through as well would toggle twice and
            // leave the bubble closed. Keyboard activation reports detail 0,
            // so this only fires for Tab-and-Enter users.
            if (event.detail === 0) handleClick()
          }}
          className='absolute inset-0 rounded-full focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none'
        />

        {/*
          The bubble lives inside the character wrapper so it rides along when the
          mascot is dragged or thrown. Left-aligned when docked left, so it always
          grows away from the nearest screen edge.
        */}
        {bubbleOpen ? (
          <div
            role='status'
            aria-live='polite'
            data-testid='site-mascot-bubble'
            onPointerDown={(event) => event.stopPropagation()}
            className={cn(
              'bg-card text-card-foreground pointer-events-auto absolute bottom-full mb-2 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-2xl border p-3 text-sm shadow-lg',
              'motion-safe:animate-[mascot-bubble-in_.28s_ease-out]',
              placement === 'left' ? 'left-0' : 'right-0'
            )}
          >
            <div className='flex items-start gap-2.5'>
              <img
                src={portraitUrl(portrait.id)}
                alt=''
                data-testid='site-mascot-portrait'
                className='size-12 shrink-0 rounded-full border bg-white object-cover'
                width={48}
                height={48}
                loading='lazy'
                aria-hidden='true'
              />
              <p className='pt-1 pr-5 leading-relaxed'>{greeting}</p>
            </div>
            <button
              type='button'
              onClick={() => setBubbleOpen(false)}
              aria-label={t('Close greeting')}
              className='text-muted-foreground hover:text-foreground absolute top-1.5 right-1.5 inline-flex size-5 items-center justify-center rounded-full transition-colors'
            >
              <X className='size-3.5' aria-hidden='true' />
            </button>
          </div>
        ) : null}

        <button
          type='button'
          onClick={dismiss}
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={t('Hide mascot')}
          className='text-muted-foreground hover:text-foreground pointer-events-auto absolute top-full left-1/2 mt-0.5 -translate-x-1/2 rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none'
        >
          {t('Hide')}
        </button>
      </div>
    </div>
  )
}
