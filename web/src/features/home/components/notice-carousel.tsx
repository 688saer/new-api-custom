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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

const NOTICE_KEYS = [
  'Manage models, keys, usage and subscriptions in one place',
  'Compatible with OpenAI, Anthropic and Gemini API protocols',
  'Create a separate API key for each tool and project',
] as const

const ROTATE_INTERVAL_MS = 5200

/**
 * Rotating notice strip pinned above the hero, mirroring the reference layout:
 * centred message, dot indicators, and previous/next controls on the right.
 */
export function NoticeCarousel() {
  const { t } = useTranslation()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (reduceMotion || paused) return
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % NOTICE_KEYS.length)
    }, ROTATE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [paused, reduceMotion])

  const go = (delta: number) => {
    setActive(
      (current) => (current + delta + NOTICE_KEYS.length) % NOTICE_KEYS.length
    )
  }

  return (
    <aside
      className='relative mt-16 bg-[#171717] text-white md:mt-20'
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-label={t('Site notices')}
    >
      <div className='mx-auto grid min-h-10 max-w-6xl items-center px-20 py-1 sm:px-24'>
        <p
          className='col-start-1 row-start-1 m-0 truncate text-center text-[13px] leading-5 font-medium'
          aria-live='polite'
        >
          {t(NOTICE_KEYS[active])}
        </p>
      </div>

      <div className='absolute bottom-0 left-1/2 flex -translate-x-1/2'>
        {NOTICE_KEYS.map((key, index) => (
          <button
            key={key}
            type='button'
            onClick={() => setActive(index)}
            aria-label={t('Show notice {{index}}', { index: index + 1 })}
            aria-current={index === active}
            className='flex size-6 items-center justify-center'
          >
            <span
              className={cn(
                'h-[5px] w-[5px] translate-y-1 rounded-full bg-[#737373] transition-all duration-200',
                index === active && 'w-4 rounded-[3px] bg-white'
              )}
            />
          </button>
        ))}
      </div>

      <div className='absolute top-1 right-1 flex'>
        <button
          type='button'
          onClick={() => go(-1)}
          aria-label={t('Previous notice')}
          className='flex size-8 items-center justify-center rounded-lg text-[#d4d4d4] transition-colors hover:bg-white/10 hover:text-white'
        >
          <ChevronLeft className='size-3.5' aria-hidden='true' />
        </button>
        <button
          type='button'
          onClick={() => go(1)}
          aria-label={t('Next notice')}
          className='flex size-8 items-center justify-center rounded-lg text-[#d4d4d4] transition-colors hover:bg-white/10 hover:text-white'
        >
          <ChevronRight className='size-3.5' aria-hidden='true' />
        </button>
      </div>
    </aside>
  )
}
