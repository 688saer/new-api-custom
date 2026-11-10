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
import { Sparkles } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import {
  WHEEL_TONES,
  getWheelToneStyle,
  resolveWheelTone,
  segmentAngle,
  segmentPath,
  splitPrizeName,
} from '../lib/wheel'
import type { WheelPrize } from '../types'

const CENTER = 200
const DISC_RADIUS = 176
const BULB_RADIUS = 190
const BULB_COUNT = 24

/** 外圈灯珠坐标固定，渲染时不必重复计算三角函数。 */
const BULBS = Array.from({ length: BULB_COUNT }, (_, index) => {
  const angle = (360 / BULB_COUNT) * index
  const rad = ((angle - 90) * Math.PI) / 180
  return {
    index,
    angle,
    x: CENTER + BULB_RADIUS * Math.cos(rad),
    y: CENTER + BULB_RADIUS * Math.sin(rad),
  }
})

interface WheelDiscProps {
  prizes: WheelPrize[]
  /** 当前累计旋转角度（顺时针，度）。 */
  rotation: number
  /** 是否正在旋转；决定是否启用过渡动画。 */
  spinning: boolean
  /** 停下来后高亮的扇区下标。 */
  highlightIndex: number | null
  /** 转动时长（毫秒），转盘停下与后端返回同时发生。 */
  spinDurationMs: number
  /** 是否已关闭动画（系统 prefers-reduced-motion）。 */
  reducedMotion: boolean
  /** 中心按钮主文案。 */
  actionLabel: string
  /** 中心按钮副文案。 */
  hintLabel: string
  disabled: boolean
  onSpin: () => void
}

/**
 * 大转盘盘面。
 *
 * 旋转只作用于 SVG 盘面，中心按钮与指针固定不动，指针指向顶部（0°）。
 * 每个扇区顺时针排列，第 i 个扇区的角度区间为 [i*seg, (i+1)*seg)。
 */
export const WheelDisc = memo(function WheelDisc(props: WheelDiscProps) {
  const { t } = useTranslation()
  const count = props.prizes.length
  const seg = segmentAngle(count)
  const transition = props.spinning && !props.reducedMotion
  const highlight = props.highlightIndex

  if (count === 0) {
    return (
      <div className='border-muted text-muted-foreground mx-auto grid aspect-square w-full max-w-[420px] place-items-center rounded-full border-2 border-dashed text-sm'>
        {t('No prize configured yet')}
      </div>
    )
  }

  return (
    <div className='relative mx-auto aspect-square w-full max-w-[420px] select-none'>
      {/* 外圈光晕 */}
      <div
        aria-hidden='true'
        className={cn(
          'pointer-events-none absolute -inset-8 rounded-full blur-2xl transition-opacity duration-700',
          'bg-[radial-gradient(circle,rgba(251,191,36,0.45),rgba(244,114,182,0.22)_45%,transparent_70%)]',
          highlight === null && !props.spinning ? 'opacity-60' : 'opacity-100'
        )}
      />

      {/* 金色外环 */}
      <div className='relative h-full w-full rounded-full bg-gradient-to-br from-amber-200 via-amber-500 to-orange-700 p-[9px] shadow-[0_24px_60px_-18px_rgba(217,119,6,0.75)]'>
        <div className='relative h-full w-full overflow-hidden rounded-full bg-[#2b1607] p-[6px] ring-1 ring-amber-200/40 ring-inset'>
          <svg
            viewBox='0 0 400 400'
            role='img'
            aria-label={t('Prize wheel with {{count}} segments', {
              count,
            })}
            className='h-full w-full'
            style={{
              transform: `rotate(${props.rotation}deg)`,
              transition: transition
                ? `transform ${props.spinDurationMs}ms cubic-bezier(0.12, 0.68, 0.06, 1)`
                : 'none',
              willChange: 'transform',
            }}
          >
            <defs>
              {WHEEL_TONES.map((tone) => {
                const style = getWheelToneStyle(tone, 0)
                return (
                  <linearGradient
                    key={tone}
                    id={`wheel-tone-${tone}`}
                    x1='0%'
                    y1='0%'
                    x2='0%'
                    y2='100%'
                  >
                    <stop offset='0%' stopColor={style.from} />
                    <stop offset='100%' stopColor={style.to} />
                  </linearGradient>
                )
              })}
              <radialGradient id='wheel-shine' cx='50%' cy='18%' r='70%'>
                <stop offset='0%' stopColor='#ffffff' stopOpacity='0.55' />
                <stop offset='55%' stopColor='#ffffff' stopOpacity='0.06' />
                <stop offset='100%' stopColor='#ffffff' stopOpacity='0' />
              </radialGradient>
            </defs>

            {props.prizes.map((prize, index) => {
              const tone = resolveWheelTone(prize.color, index)
              const style = getWheelToneStyle(prize.color, index)
              const mid = (index + 0.5) * seg
              const lines = splitPrizeName(prize.name, count > 10 ? 3 : 4)
              const isHighlight = highlight === index
              const soldOut = !prize.available
              return (
                <g key={prize.id}>
                  <path
                    d={segmentPath(index, count, DISC_RADIUS, CENTER)}
                    fill={`url(#wheel-tone-${tone})`}
                    stroke='rgba(255,255,255,0.65)'
                    strokeWidth={1.6}
                  />
                  {soldOut ? (
                    <path
                      d={segmentPath(index, count, DISC_RADIUS, CENTER)}
                      fill='#0f172a'
                      fillOpacity={0.55}
                    />
                  ) : null}
                  <g transform={`rotate(${mid} ${CENTER} ${CENTER})`}>
                    {prize.icon ? (
                      <text
                        x={CENTER}
                        y={CENTER - 132}
                        textAnchor='middle'
                        dominantBaseline='middle'
                        fontSize={24}
                        aria-hidden='true'
                      >
                        {prize.icon}
                      </text>
                    ) : null}
                    {lines.map((line, lineIndex) => (
                      <text
                        key={line}
                        x={CENTER}
                        y={CENTER - 104 + lineIndex * 16}
                        textAnchor='middle'
                        dominantBaseline='middle'
                        fontSize={count > 10 ? 12 : 13}
                        fontWeight={600}
                        fill={style.text}
                      >
                        {line}
                      </text>
                    ))}
                  </g>
                  {isHighlight ? (
                    <path
                      d={segmentPath(index, count, DISC_RADIUS, CENTER)}
                      fill='#ffffff'
                      fillOpacity={0.34}
                      className={cn(!props.reducedMotion && 'animate-pulse')}
                    />
                  ) : null}
                </g>
              )
            })}

            {/* 高光 */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={DISC_RADIUS}
              fill='url(#wheel-shine)'
              pointerEvents='none'
            />

            {/* 外圈灯泡 */}
            {BULBS.map((bulb) => (
              <circle
                key={`bulb-${bulb.angle}`}
                cx={bulb.x}
                cy={bulb.y}
                r={3.6}
                fill={bulb.index % 2 === 0 ? '#FFFBEB' : '#FCD34D'}
                className={cn(
                  !props.reducedMotion && 'animate-pulse',
                  bulb.index % 2 === 0 ? '' : '[animation-delay:600ms]'
                )}
              />
            ))}
          </svg>
        </div>

        {/* 指针 */}
        <div
          aria-hidden='true'
          className='absolute top-0 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2'
        >
          <div className='drop-shadow-[0_6px_10px_rgba(120,53,15,0.55)]'>
            <svg width='46' height='62' viewBox='0 0 46 62'>
              <defs>
                <linearGradient
                  id='wheel-pointer'
                  x1='0%'
                  y1='0%'
                  x2='0%'
                  y2='100%'
                >
                  <stop offset='0%' stopColor='#FDE68A' />
                  <stop offset='45%' stopColor='#F59E0B' />
                  <stop offset='100%' stopColor='#DC2626' />
                </linearGradient>
              </defs>
              <path
                d='M23 60 L4 20 A19 19 0 1 1 42 20 Z'
                fill='url(#wheel-pointer)'
                stroke='#FFFBEB'
                strokeWidth='2.5'
                strokeLinejoin='round'
              />
              <circle cx='23' cy='19' r='6.5' fill='#FFFBEB' />
            </svg>
          </div>
        </div>

        {/* 中心按钮 */}
        <div className='absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2'>
          <button
            type='button'
            onClick={props.onSpin}
            disabled={props.disabled}
            aria-label={props.actionLabel}
            className={cn(
              'group relative grid h-[104px] w-[104px] place-items-center rounded-full',
              'bg-gradient-to-br from-amber-50 via-amber-200 to-amber-400',
              'shadow-[0_10px_30px_-6px_rgba(180,83,9,0.9),inset_0_-4px_10px_rgba(146,64,14,0.35)]',
              'ring-4 ring-amber-100/70 transition-transform duration-200',
              'focus-visible:ring-4 focus-visible:ring-amber-100 focus-visible:outline-none',
              props.disabled
                ? 'cursor-not-allowed opacity-80'
                : 'hover:scale-[1.04] active:scale-95'
            )}
          >
            <span
              aria-hidden='true'
              className={cn(
                'absolute inset-1 rounded-full border border-dashed border-amber-600/40',
                !props.disabled &&
                  !props.reducedMotion &&
                  'group-hover:animate-spin [animation-duration:6s]'
              )}
            />
            <span className='relative z-10 flex flex-col items-center gap-0.5 px-2 text-center'>
              <Sparkles aria-hidden='true' className='size-4 text-amber-700' />
              <span className='text-[15px] leading-tight font-black tracking-tight text-amber-900'>
                {props.actionLabel}
              </span>
              <span className='text-[11px] leading-tight font-medium text-amber-800/90'>
                {props.hintLabel}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
})
