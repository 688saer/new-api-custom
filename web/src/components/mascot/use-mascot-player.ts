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

import { useCallback, useEffect, useRef, useState } from 'react'

import { MASCOT_CATALOG, type MascotCatalog } from './catalog'
import { MASCOT_CLIP_FILES } from './clip-files'
import { nextChainStep, pickOne } from './pickers'

/** Where the clip files live, relative to the site root. */
export const MASCOT_ASSET_BASE = '/mascot/clips'

/**
 * Resolve a catalogue name to its file URL.
 *
 * Names are Chinese upstream; the files are numbered slugs (see `clip-files.ts`
 * for why). An unknown name still produces a URL so a stale catalogue entry
 * fails as a 404 rather than throwing.
 */
export function clipUrl(name: string): string {
  const file = MASCOT_CLIP_FILES[name] ?? name
  return `${MASCOT_ASSET_BASE}/${file}.webm`
}

interface PlayerOptions {
  /** Pause the chain entirely (mascot hidden, page hidden, reduced motion). */
  paused: boolean
  catalog?: MascotCatalog
  /** Called whenever the facing direction changes, so the wrapper can mirror. */
  onFacingChange?: (facingRight: boolean) => void
}

export interface MascotPlayer {
  /** The element that should be visible right now. */
  frontRef: React.RefObject<HTMLVideoElement | null>
  /** The element being preloaded behind the visible one. */
  backRef: React.RefObject<HTMLVideoElement | null>
  /** Which of the two is currently visible. */
  frontIsA: boolean
  facingRight: boolean
  /** Play a specific clip once (click responses, drag, menu picks). */
  playOnce: (name: string) => void
  /** Play a specific clip on a loop until replaced. */
  playLoop: (name: string) => void
  /** Resume the idle random chain. */
  resumeChain: () => void
  /** Report whether the current clip is a one-shot that is still playing. */
  busy: boolean
}

/**
 * Double-buffered clip player.
 *
 * Two `<video>` elements are stacked; the incoming clip loads into the hidden
 * one and only swaps in once it has data, so there is never a blank frame
 * between animations. The idle chain advances when a one-shot clip ends.
 *
 * Playback is intentionally not `await`-ed end to end: a slow or failed load
 * must never wedge the chain, so a failure falls back to the idle loop.
 */
export function useMascotPlayer(options: PlayerOptions): MascotPlayer {
  const catalog = options.catalog ?? MASCOT_CATALOG
  const frontRef = useRef<HTMLVideoElement | null>(null)
  const backRef = useRef<HTMLVideoElement | null>(null)

  const [frontIsA, setFrontIsA] = useState(true)
  const [facingRight, setFacingRight] = useState(false)
  const [busy, setBusy] = useState(false)

  // Refs mirror state so the event handlers, which are installed once per clip,
  // always read the current value instead of a stale closure.
  const frontIsARef = useRef(true)
  const facingRightRef = useRef(false)
  const pausedRef = useRef(options.paused)
  const currentRef = useRef<string | null>(null)
  const generationRef = useRef(0)
  const mountedRef = useRef(true)
  const blobUrlsRef = useRef<Record<'a' | 'b', string | null>>({ a: null, b: null })
  const chainTimerRef = useRef<number | null>(null)

  const onFacingChangeRef = useRef(options.onFacingChange)
  onFacingChangeRef.current = options.onFacingChange

  useEffect(() => {
    pausedRef.current = options.paused
  }, [options.paused])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (chainTimerRef.current !== null) window.clearTimeout(chainTimerRef.current)
      for (const slot of ['a', 'b'] as const) {
        const url = blobUrlsRef.current[slot]
        if (url) URL.revokeObjectURL(url)
      }
    }
  }, [])

  const advanceChain = useCallback(() => {
    if (pausedRef.current) return
    const step = nextChainStep(catalog, {
      facingRight: facingRightRef.current,
      current: currentRef.current ?? undefined,
    })
    if (step.flips) {
      const next = !facingRightRef.current
      facingRightRef.current = next
      setFacingRight(next)
      onFacingChangeRef.current?.(next)
    }
    playRef.current?.(step.name, step.once)
  }, [catalog])

  // `playRef` breaks the circular dependency: advanceChain needs play, play
  // needs advanceChain for the ended handler.
  const playRef = useRef<((name: string, once: boolean) => void) | null>(null)

  const play = useCallback(
    (name: string, once: boolean) => {
      const targetIsB = frontIsARef.current
      const target = targetIsB ? backRef.current : frontRef.current
      if (!target) return

      const generation = ++generationRef.current
      currentRef.current = name

      const commit = () => {
        if (!mountedRef.current || generationRef.current !== generation) return
        frontIsARef.current = targetIsB
        setFrontIsA(targetIsB)
        setBusy(once)
        target.style.opacity = '1'
        const other = targetIsB ? frontRef.current : backRef.current
        if (other) other.style.opacity = '0'
        if (once) {
          // Safety net: if `ended` never fires (decode hiccup, tab suspended),
          // fall back to the chain instead of freezing on one frame.
          if (chainTimerRef.current !== null) window.clearTimeout(chainTimerRef.current)
          chainTimerRef.current = window.setTimeout(
            () => {
              if (currentRef.current === name) advanceChain()
            },
            Math.max(target.duration || 0, 1) * 1000 + 2000
          )
        }
      }

      target.loop = !once
      target.muted = true
      target.playsInline = true
      target.onended = once
        ? () => {
            if (!mountedRef.current || generationRef.current !== generation) return
            setBusy(false)
            advanceChain()
          }
        : null
      target.onerror = () => {
        if (!mountedRef.current || generationRef.current !== generation) return
        // A missing or broken clip must not wedge the chain; drop back to idle.
        setBusy(false)
        window.setTimeout(() => {
          if (mountedRef.current && currentRef.current === name) advanceChain()
        }, 400)
      }

      const onReady = () => {
        target.removeEventListener('loadeddata', onReady)
        if (!mountedRef.current || generationRef.current !== generation) return
        commit()
        void target.play().catch(() => {
          // Autoplay can be refused (battery saver, strict policies). The poster
          // frame still shows, so the character is visible rather than blank.
          if (mountedRef.current && generationRef.current === generation) setBusy(false)
        })
      }
      target.addEventListener('loadeddata', onReady)

      // Fetch then blob: a plain `src` on a slow link occasionally stalls with no
      // error at all, leaving the mascot frozen. One whole-file request is more
      // predictable, and the browser cache still serves repeat clips.
      const slot = targetIsB ? 'b' : 'a'
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 15000)
      fetch(clipUrl(name), { cache: 'default', signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`clip ${response.status}`)
          return response.blob()
        })
        .then((blob) => {
          window.clearTimeout(timer)
          if (!mountedRef.current || generationRef.current !== generation) return
          const previous = blobUrlsRef.current[slot]
          if (previous) URL.revokeObjectURL(previous)
          const url = URL.createObjectURL(blob)
          blobUrlsRef.current[slot] = url
          target.src = url
          target.load()
        })
        .catch(() => {
          window.clearTimeout(timer)
          target.removeEventListener('loadeddata', onReady)
          if (!mountedRef.current || generationRef.current !== generation) return
          setBusy(false)
          window.setTimeout(() => {
            if (mountedRef.current && currentRef.current === name) advanceChain()
          }, 400)
        })
    },
    [advanceChain]
  )

  playRef.current = play

  const playOnce = useCallback(
    (name: string) => {
      play(name, true)
    },
    [play]
  )

  const playLoop = useCallback(
    (name: string) => {
      play(name, false)
    },
    [play]
  )

  const resumeChain = useCallback(() => {
    setBusy(false)
    advanceChain()
  }, [advanceChain])

  // Kick off the idle loop once, and restart it when playback is unpaused.
  useEffect(() => {
    if (options.paused) return
    if (currentRef.current !== null) return
    advanceChain()
  }, [advanceChain, options.paused])

  return { frontRef, backRef, frontIsA, facingRight, playOnce, playLoop, resumeChain, busy }
}

/** A random click response, exposed for the interaction layer. */
export function randomClickClip(catalog: MascotCatalog = MASCOT_CATALOG): string {
  return pickOne(catalog.clicks)
}
