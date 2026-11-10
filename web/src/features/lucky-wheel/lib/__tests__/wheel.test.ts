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
import { describe, expect, test } from 'vitest'

import {
  formatStockLabelKey,
  getWheelToneStyle,
  resolvePrizeIndex,
  resolveWheelTone,
  segmentAngle,
  segmentPath,
  splitPrizeName,
  targetRotation,
  toWheelPrizeType,
  toWheelWinStatus,
} from '../wheel'

describe('targetRotation', () => {
  test('让中奖扇区的中心停在顶部指针处', () => {
    const count = 12
    const seg = segmentAngle(count)
    for (let index = 0; index < count; index += 1) {
      const rotation = targetRotation(0, index, count)
      const center = ((index + 0.5) * seg + rotation) % 360
      // 指针位于顶部，扇区中心加上旋转后应回到 0°（360°）
      expect(Math.min(center, 360 - center)).toBeLessThan(0.001)
    }
  })

  test('始终向前多转数圈而不是回退', () => {
    const rotation = targetRotation(2385, 3, 8)
    expect(rotation).toBeGreaterThan(2385)
    expect(rotation - 2385).toBeGreaterThanOrEqual(5 * 360)
  })

  test('连续多次抽奖的旋转角度单调递增', () => {
    let rotation = 0
    for (const index of [2, 5, 1, 7]) {
      const next = targetRotation(rotation, index, 8)
      expect(next).toBeGreaterThan(rotation)
      rotation = next
    }
  })

  test('奖品数量为 0 时保持当前角度', () => {
    expect(targetRotation(120, 0, 0)).toBe(120)
  })
})

describe('segmentPath', () => {
  test('单个奖品时绘制整圆', () => {
    expect(segmentPath(0, 1, 100, 200)).toContain('A 100 100 0 1 1')
  })

  test('多个奖品时从圆心绘制扇形', () => {
    const path = segmentPath(0, 8, 100, 200)
    expect(path.startsWith('M 200 200 L')).toBe(true)
    expect(path.endsWith('Z')).toBe(true)
  })
})

describe('resolveWheelTone', () => {
  test('识别后台配置的颜色', () => {
    expect(resolveWheelTone('rose', 0)).toBe('rose')
    expect(resolveWheelTone(' Mint ', 1)).toBe('mint')
  })

  test('未知颜色按序号轮换，保证相邻扇区不同', () => {
    expect(resolveWheelTone('', 0)).not.toBe(resolveWheelTone('', 1))
  })

  test('已知颜色返回对应色板', () => {
    expect(getWheelToneStyle('sky', 0).dot).toBe('#0EA5E9')
  })
})

describe('splitPrizeName', () => {
  test('短名称保持单行', () => {
    expect(splitPrizeName('1 美元')).toEqual(['1 美元'])
  })

  test('超长名称折成最多两行', () => {
    const lines = splitPrizeName('超级豪华大奖礼包套装', 3)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toHaveLength(3)
  })
})

describe('枚举兜底', () => {
  test('未知中奖状态回落到待领取', () => {
    expect(toWheelWinStatus('unknown')).toBe('pending')
    expect(toWheelWinStatus('shipped')).toBe('shipped')
  })

  test('未知奖品类型回落到谢谢参与', () => {
    expect(toWheelPrizeType('mystery')).toBe('none')
    expect(toWheelPrizeType('card_key')).toBe('card_key')
  })

  test('不限量库存显示为 Unlimited', () => {
    expect(formatStockLabelKey(-1)).toBe('Unlimited')
    expect(formatStockLabelKey(3)).toBe('3')
  })
})

describe('resolvePrizeIndex', () => {
  const prizes = [{ id: 7 }, { id: 9 }, { id: 11 }]

  test('按 prize_id 命中时忽略后端下标', () => {
    expect(resolvePrizeIndex(prizes, 11, 0)).toBe(2)
  })

  test('奖品被删掉后回落到后端下标', () => {
    expect(resolvePrizeIndex(prizes, 42, 1)).toBe(1)
  })

  test('下标越界时归零', () => {
    expect(resolvePrizeIndex(prizes, 42, 5)).toBe(0)
    expect(resolvePrizeIndex([], 42, 3)).toBe(0)
  })
})
