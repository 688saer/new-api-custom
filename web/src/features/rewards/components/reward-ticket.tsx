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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { resolveTicketCopy, splitStubText } from '../lib/rewards'
import type { RewardStyle, RewardTicketCopy } from '../types'

/** 每种券面样式的底色、文字色与光效。 */
const STYLE_CLASSES: Record<RewardStyle, { card: string; ink: string }> = {
  aurora: {
    card: 'from-[#0e3944] via-[#0b2b34] to-[#071a20]',
    ink: 'text-[#effcff]',
  },
  citrus: {
    card: 'from-[#d59a2c] via-[#c98b22] to-[#a56f18]',
    ink: 'text-[#2d2414]',
  },
  sunrise: {
    card: 'from-[#ef671c] via-[#dd5a13] to-[#b8460c]',
    ink: 'text-[#3b2013]',
  },
  nocturne: {
    card: 'from-[#101923] via-[#0b1219] to-[#060a0f]',
    ink: 'text-[#f1f5ff]',
  },
}

interface RewardTicketProps {
  style: RewardStyle
  copy: RewardTicketCopy
  /** 已格式化的金额文案，例如 `$5.00`。 */
  amount: string
  className?: string
}

/**
 * 奖励券面：左侧正文 + 右侧竖排票根，中间用虚线撕口分开。
 *
 * 对应参考站 `reward-ticket` 的结构，但改用 Tailwind 实现，并沿用本站主题
 * 变量，因此暗色模式下无需额外配色。
 */
export function RewardTicket(props: RewardTicketProps) {
  const { t } = useTranslation()
  const copy = resolveTicketCopy(props.copy)
  const style = STYLE_CLASSES[props.style] ?? STYLE_CLASSES.aurora
  const stubCharacters = splitStubText(copy.stub_text)

  return (
    <article
      data-style={props.style}
      data-testid='reward-ticket'
      className={cn(
        'relative isolate grid aspect-[741/425] w-full max-w-[600px]',
        'grid-cols-[minmax(0,1fr)_24%] overflow-hidden rounded-lg',
        'bg-gradient-to-br shadow-lg',
        style.card,
        style.ink,
        props.className
      )}
    >
      {/* 撕口：上下各挖一个半圆 */}
      <span
        aria-hidden='true'
        className='bg-background absolute end-[calc(24%-11px)] -top-[11px] size-[22px] rounded-full'
      />
      <span
        aria-hidden='true'
        className='bg-background absolute end-[calc(24%-11px)] -bottom-[11px] size-[22px] rounded-full'
      />

      {/* 光效层 */}
      <span
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 z-0 opacity-60 [background:radial-gradient(circle_at_18%_25%,rgba(123,225,255,0.38),transparent_31%),radial-gradient(circle_at_78%_72%,rgba(244,113,255,0.34),transparent_35%)]'
      />

      <div className='relative z-10 flex min-h-0 min-w-0 flex-col justify-between overflow-hidden p-6 pt-[68px]'>
        <p className='line-clamp-2 text-xs leading-snug font-medium wrap-anywhere'>
          {copy.label}
        </p>

        <div className='my-2 grid min-h-0 min-w-0 gap-1.5 overflow-hidden'>
          <h3 className='line-clamp-2 text-xl leading-tight font-bold wrap-anywhere'>
            {copy.title}
          </h3>
          <div className='truncate text-4xl leading-none font-bold tabular-nums'>
            {props.amount}
          </div>
          <p className='line-clamp-2 text-xs leading-relaxed wrap-anywhere'>
            {copy.subtitle}
          </p>
        </div>

        <p className='line-clamp-2 text-[11px] leading-snug wrap-anywhere'>
          {copy.footer}
        </p>
      </div>

      <div className='relative z-10 flex min-h-0 min-w-0 flex-col items-center justify-center gap-4 overflow-hidden border-s border-dashed border-current px-2 py-4 text-center'>
        <div
          aria-hidden='true'
          className='flex shrink-0 flex-col leading-tight font-bold'
          style={{ fontSize: `${copy.stub_font_size}px` }}
        >
          {stubCharacters.map((character, index) => (
            <span key={`${character}-${index}`} className='block h-[1.2em]'>
              {character}
            </span>
          ))}
        </div>
        <small className='text-[10px] leading-tight'>
          {t('Reward credit')}
        </small>
      </div>
    </article>
  )
}
