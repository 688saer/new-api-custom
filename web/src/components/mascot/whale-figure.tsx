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
import { cn } from '@/lib/utils'

interface WhaleFigureProps {
  /** Drives the idle animation and the surprised eyes. */
  excited?: boolean
  /** True while the greeting bubble is open. */
  talking?: boolean
  className?: string
  /** Optional inline sizing, used by the settings preview. */
  style?: React.CSSProperties
}

/**
 * The mascot character: a small blue whale drawn with inline SVG.
 *
 * Inline SVG rather than a bitmap because it stays crisp at every configured
 * size, weighs nothing, and inherits the theme through `currentColor`. The idle
 * motion lives in CSS keyframes so it keeps running without a timer in React.
 */
export function WhaleFigure(props: WhaleFigureProps) {
  return (
    <svg
      viewBox='0 0 120 120'
      role='img'
      aria-hidden='true'
      style={props.style}
      className={cn(
        'text-primary drop-shadow-[0_8px_18px_rgba(14,114,188,0.28)]',
        props.className
      )}
    >
      <defs>
        <linearGradient id='whale-body' x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor='var(--primary)' stopOpacity='0.96' />
          <stop offset='100%' stopColor='var(--primary)' stopOpacity='0.74' />
        </linearGradient>
        <linearGradient id='whale-belly' x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor='#ffffff' stopOpacity='0.95' />
          <stop offset='100%' stopColor='#dceefb' stopOpacity='0.9' />
        </linearGradient>
      </defs>

      {/* Water spout: three droplets that fade in sequence. */}
      <g className='motion-safe:animate-[whale-spout_3.6s_ease-in-out_infinite]'>
        <ellipse cx='60' cy='17' rx='3.2' ry='5' fill='var(--primary)' opacity='0.55' />
        <ellipse cx='51' cy='21' rx='2.4' ry='3.6' fill='var(--primary)' opacity='0.42' />
        <ellipse cx='69' cy='21' rx='2.4' ry='3.6' fill='var(--primary)' opacity='0.42' />
      </g>

      {/* Tail, behind the body. */}
      <path
        d='M18 74c-7-6-12-3-12 4 0 6 5 10 11 8 4-1 6-5 5-9z'
        fill='url(#whale-body)'
        className='origin-[24px_78px] motion-safe:animate-[whale-tail_2.8s_ease-in-out_infinite]'
      />

      {/* Body. */}
      <path
        d='M28 70c0-20 16-34 36-34s36 14 36 34c0 17-14 28-33 28-21 0-39-11-39-28z'
        fill='url(#whale-body)'
      />

      {/* Belly patch, offset so the shape reads as three-quarter view. */}
      <path
        d='M41 82c4 9 13 14 24 14 12 0 21-5 24-13-6 5-15 7-24 7-10 0-18-3-24-8z'
        fill='url(#whale-belly)'
      />

      {/* Side fin. */}
      <path
        d='M44 78c-6 4-8 11-4 15 4 3 10 1 12-4 1-4-1-8-8-11z'
        fill='var(--primary)'
        opacity='0.82'
        className='origin-[44px_84px] motion-safe:animate-[whale-fin_2.8s_ease-in-out_infinite]'
      />

      {/* Eyes. Squash to a happy line while excited. */}
      {props.excited ? (
        <g stroke='#0f2b45' strokeWidth='2.4' strokeLinecap='round' fill='none'>
          <path d='M47 62c2.6-3 5.4-3 8 0' />
          <path d='M69 62c2.6-3 5.4-3 8 0' />
        </g>
      ) : (
        <g>
          <ellipse cx='51' cy='63' rx='3.6' ry='4.4' fill='#0f2b45' />
          <ellipse cx='73' cy='63' rx='3.6' ry='4.4' fill='#0f2b45' />
          <circle cx='52.2' cy='61.4' r='1.3' fill='#ffffff' />
          <circle cx='74.2' cy='61.4' r='1.3' fill='#ffffff' />
        </g>
      )}

      {/* Mouth: opens into a small smile while talking. */}
      <path
        d={props.talking ? 'M56 73q6 6 12 0' : 'M57 72q5 4 10 0'}
        stroke='#0f2b45'
        strokeWidth='2'
        strokeLinecap='round'
        fill='none'
      />

      {/* Cheeks. */}
      <circle cx='43' cy='72' r='3.4' fill='#ff9db1' opacity='0.45' />
      <circle cx='81' cy='72' r='3.4' fill='#ff9db1' opacity='0.45' />
    </svg>
  )
}
