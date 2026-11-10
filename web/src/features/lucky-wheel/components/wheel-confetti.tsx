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
import { motion, useReducedMotion } from 'motion/react'

const PIECE_COLORS = [
  '#F59E0B',
  '#FBBF24',
  '#FDE68A',
  '#EC4899',
  '#8B5CF6',
  '#10B981',
  '#0EA5E9',
  '#FB7185',
]

interface WheelConfettiProps {
  active: boolean
  /** 纸片数量。 */
  pieces?: number
}

/**
 * 中奖时从盘面中心炸开的彩色纸片。
 *
 * 关闭动画（prefers-reduced-motion）时直接不渲染，避免只闪一下。
 */
export function WheelConfetti(props: WheelConfettiProps) {
  const shouldReduce = useReducedMotion()
  if (!props.active || shouldReduce) return null

  const total = props.pieces ?? 26
  const items = Array.from({ length: total }, (_, index) => {
    // 用下标推导固定参数，避免每次渲染位置乱跳
    const angle = (360 / total) * index + (index % 5) * 4
    const distance = 130 + ((index * 17) % 90)
    const rad = (angle * Math.PI) / 180
    return {
      id: index,
      x: Math.cos(rad) * distance,
      y: Math.sin(rad) * distance,
      rotate: 180 + ((index * 53) % 360),
      delay: (index % 7) * 0.04,
      color: PIECE_COLORS[index % PIECE_COLORS.length] as string,
      size: 6 + (index % 4) * 2,
      round: index % 3 === 0,
    }
  })

  return (
    <div
      aria-hidden='true'
      className='pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-full'
    >
      {items.map((item) => (
        <motion.span
          key={item.id}
          className='absolute top-1/2 left-1/2 block'
          style={{
            width: item.size,
            height: item.size * 1.6,
            backgroundColor: item.color,
            borderRadius: item.round ? '9999px' : '2px',
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
          animate={{
            x: item.x,
            y: item.y,
            opacity: [0, 1, 1, 0],
            scale: [0.4, 1, 1, 0.7],
            rotate: item.rotate,
          }}
          transition={{
            duration: 1.5,
            delay: item.delay,
            ease: 'easeOut',
            times: [0, 0.15, 0.7, 1],
          }}
        />
      ))}
    </div>
  )
}
