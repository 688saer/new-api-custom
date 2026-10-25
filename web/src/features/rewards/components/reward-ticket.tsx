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

/**
 * 券面固定长宽比 741/425、正文与票根按 76% : 24% 分栏、撕口半径 11px。
 *
 * 这几个数值必须写成 Tailwind 字面量，扫描器才会生成对应 CSS；改动时
 * 三处（aspect、grid-cols、撕口的 end/size）要一起改，否则撕口会错位。
 */
const TICKET_LAYOUT_CLASS =
  'grid aspect-[741/425] grid-cols-[minmax(0,1fr)_24%]'

/**
 * 每种券面样式的配色：底色渐变、文字色、撕口与票根的点缀色。
 *
 * 全部写成 Tailwind 任意值而不是内联样式，方便跟随主题与暗色模式。
 */
export const REWARD_TICKET_STYLES: Record<
  RewardStyle,
  { card: string; ink: string; sheen: string; edge: string }
> = {
  aurora: {
    card: 'from-[#0e3944] via-[#0b2b34] to-[#071a20]',
    ink: 'text-[#effcff]',
    sheen:
      '[background:radial-gradient(circle_at_16%_22%,rgba(123,225,255,0.42),transparent_34%),radial-gradient(circle_at_82%_76%,rgba(244,113,255,0.36),transparent_38%)]',
    edge: 'border-white/35',
  },
  citrus: {
    card: 'from-[#f0b23a] via-[#d2941f] to-[#9c6a12]',
    ink: 'text-[#2b2110]',
    sheen:
      '[background:radial-gradient(circle_at_20%_18%,rgba(255,244,205,0.55),transparent_38%),radial-gradient(circle_at_84%_80%,rgba(120,60,0,0.28),transparent_42%)]',
    edge: 'border-black/25',
  },
  sunrise: {
    card: 'from-[#f4741f] via-[#dd5a13] to-[#a83f0b]',
    ink: 'text-[#3a1e11]',
    sheen:
      '[background:radial-gradient(circle_at_22%_20%,rgba(255,222,170,0.5),transparent_36%),radial-gradient(circle_at_80%_78%,rgba(110,20,0,0.3),transparent_44%)]',
    edge: 'border-black/25',
  },
  nocturne: {
    card: 'from-[#141f2c] via-[#0b1219] to-[#05080c]',
    ink: 'text-[#eef4ff]',
    sheen:
      '[background:radial-gradient(circle_at_18%_24%,rgba(141,175,255,0.34),transparent_34%),radial-gradient(circle_at_84%_76%,rgba(96,240,214,0.26),transparent_38%)]',
    edge: 'border-white/30',
  },
}

interface RewardTicketProps {
  style: RewardStyle
  copy: RewardTicketCopy
  /** 已格式化的金额文案，例如 `$5.00`。 */
  amount: string
  className?: string
}

/** 沿撕口线排布的齿孔，让票根和正文的分界更像真实打孔券。 */
function TicketPerforation(props: { edge: string }) {
  return (
    <span
      aria-hidden='true'
      data-testid='reward-ticket-perforation'
      className={cn(
        'pointer-events-none absolute inset-y-3 start-0 flex w-px flex-col',
        'items-center justify-between border-s border-dashed',
        props.edge
      )}
    >
      {Array.from({ length: 9 }, (_, index) => (
        <i key={index} className='block size-[3px] rounded-full bg-current' />
      ))}
    </span>
  )
}

/**
 * 奖励券面：左侧正文 + 右侧竖排票根，中间用打孔线分开。
 *
 * 券面尺寸完全由长宽比和栅格比例决定，四种配色只改颜色不改布局，
 * 因此同一张券在列表、弹窗和发放预览里的比例始终一致。
 */
export function RewardTicket(props: RewardTicketProps) {
  const { t } = useTranslation()
  const copy = resolveTicketCopy(props.copy)
  const style = REWARD_TICKET_STYLES[props.style] ?? REWARD_TICKET_STYLES.aurora
  const stubCharacters = splitStubText(copy.stub_text)

  return (
    <article
      data-style={props.style}
      data-testid='reward-ticket'
      className={cn(
        'group relative isolate w-full max-w-[600px] overflow-hidden rounded-xl',
        'bg-gradient-to-br shadow-xl ring-1 ring-inset',
        TICKET_LAYOUT_CLASS,
        style.card,
        style.ink,
        style.edge,
        props.className
      )}
    >
      {/* 网点底纹 */}
      <span
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 z-0 [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:13px_13px] opacity-[0.16]'
      />

      {/* 光效层 */}
      <span
        aria-hidden='true'
        className={cn(
          'pointer-events-none absolute inset-0 z-0 opacity-80',
          style.sheen
        )}
      />

      {/* 掠过券面的高光，仅在悬停时出现 */}
      <span
        aria-hidden='true'
        className='pointer-events-none absolute inset-y-0 -start-1/3 z-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-all duration-700 group-hover:start-full group-hover:opacity-100'
      />

      {/* 撕口：上下各挖一个半圆 */}
      <span
        aria-hidden='true'
        data-testid='reward-ticket-notch'
        className='bg-background absolute end-[calc(24%-11px)] -top-[11px] z-20 size-[22px] rounded-full'
      />
      <span
        aria-hidden='true'
        data-testid='reward-ticket-notch'
        className='bg-background absolute end-[calc(24%-11px)] -bottom-[11px] z-20 size-[22px] rounded-full'
      />

      <div className='relative z-10 flex min-h-0 min-w-0 flex-col justify-between gap-2 overflow-hidden p-5 sm:p-6'>
        <p className='flex items-center gap-2 text-[10px] leading-none font-semibold tracking-[0.22em] uppercase'>
          <span className='inline-block size-1.5 rounded-full bg-current opacity-70' />
          <span className='truncate'>{copy.label}</span>
        </p>

        <div className='grid min-h-0 min-w-0 gap-2 overflow-hidden'>
          <h3 className='line-clamp-2 text-lg leading-snug font-semibold wrap-anywhere sm:text-xl'>
            {copy.title}
          </h3>
          <div className='flex items-baseline gap-2'>
            <span
              data-testid='reward-ticket-amount'
              className='text-3xl leading-none font-bold tracking-tight tabular-nums sm:text-4xl'
            >
              {props.amount}
            </span>
          </div>
          <p className='line-clamp-2 text-[11px] leading-relaxed wrap-anywhere opacity-85'>
            {copy.subtitle}
          </p>
        </div>

        <p className='line-clamp-1 text-[10px] leading-snug wrap-anywhere opacity-75'>
          {copy.footer}
        </p>
      </div>

      <div className='relative z-10 flex min-h-0 min-w-0 flex-col items-center justify-center gap-3 overflow-hidden px-2 py-4 text-center'>
        <TicketPerforation edge={style.edge} />
        <div
          aria-hidden='true'
          data-testid='reward-ticket-stub'
          className='flex shrink-0 flex-col leading-tight font-bold'
          style={{ fontSize: `${copy.stub_font_size}px` }}
        >
          {stubCharacters.map((character, index) => (
            <span key={`${character}-${index}`} className='block h-[1.2em]'>
              {character}
            </span>
          ))}
        </div>
        <small className='text-[10px] leading-tight opacity-75'>
          {t('Reward credit')}
        </small>
      </div>
    </article>
  )
}
