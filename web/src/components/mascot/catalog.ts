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

/**
 * The animation catalogue for the site mascot.
 *
 * The clips themselves are transparent VP9 videos derived from the MIT-licensed
 * `dsh-pet` project (see `public/mascot/CREDITS.md`). This file only holds the
 * grouping: which clip is the idle loop, which ones answer a click, and how the
 * random chain distributes its weight.
 *
 * Keeping the catalogue here rather than fetching it means the first animation
 * can start before any network round trip beyond the video itself, and the
 * grouping is type checked.
 */

/** How the random chain decided what to play next. */
export type RollKind = 'idle' | 'turn' | 'move' | 'action'

export interface MascotCategory {
  id: string
  weight: number
  /**
   * Clips with on-screen text look wrong mirrored, so they are skipped while
   * the character faces right.
   */
  noMirror: boolean
  actions: readonly string[]
}

export interface MascotCatalog {
  idle: readonly string[]
  turn: readonly string[]
  drag: readonly string[]
  clicks: readonly string[]
  moves: readonly string[]
  categories: readonly MascotCategory[]
  /** Percentage share for the three state-changing branches. */
  weights: { idle: number; turn: number; move: number }
}

export const MASCOT_CATALOG: MascotCatalog = {
  idle: ['待机呼吸休闲'],
  turn: ['东张西望'],
  drag: ['被鼠标拖拽悬空反馈'],
  clicks: [
    '点击回应-开心跃动',
    '点击回应-害羞惊讶',
    '点击回应-傲娇生气',
    '点击回应-挠痒咯咯笑',
    '点击回应-元气挥手',
  ],
  moves: ['螃蟹走路', '原地漂浮踏步', '原地左转奔跑'],
  categories: [
    {
      id: '小动作',
      weight: 20,
      noMirror: false,
      actions: [
        '悠闲哼歌',
        '超大伸懒腰',
        '原地敲击桌面互动',
        '原地重力下蹲压缩',
        '哈欠连天',
        '原地小憩沉眠',
        '女仆屈膝礼仪',
        '被吓一跳',
        '小幅度原地360度旋转展示',
        '偷吃零食被抓住',
        '用鲸鱼尾巴拍打地面',
        '打瞌睡被惊醒',
        '照镜子',
        '整体换装试色',
        '轻快记录',
        '写代码',
        '摇扇纳凉',
        '晨间刷牙',
      ],
    },
    {
      id: '玩耍',
      weight: 20,
      noMirror: false,
      actions: [
        '原地专心玩魔方',
        '原地蹲下玩玩具汽车',
        '鲸鱼吐泡泡特效',
        '原地跳跃抓碎头顶物品',
        '玩游戏气急败坏',
        '玩水枪',
        '小提琴演奏',
        '蓝鲸现世',
        '优雅女仆舞',
        '轻快摇摆舞',
        '可爱宅舞',
        '吹气球',
        '动物环绕',
        '放风筝',
        '拆礼物',
        '变鸽子',
        '扑克魔术',
        '抽陀螺',
        '吹笛子',
        '蝴蝶蜜蜂环绕头顶开花',
        '撸猫',
        '凭空生花',
        '骑木马',
        '三球抛接',
        '踢毽子',
        '下五子棋',
        '荡秋千',
      ],
    },
    {
      id: '吃什么',
      weight: 16,
      noMirror: false,
      actions: [
        '吃白饭',
        '大口吃零食',
        '吃Token',
        '吃早餐',
        '吃午餐',
        '吃晚餐',
        '吃冰淇淋融化',
        '吃大闸蟹',
        '吃糖葫芦',
        '吃长寿面',
        '吃西瓜',
        '涮火锅',
      ],
    },
    {
      id: '时节',
      weight: 14,
      noMirror: false,
      actions: [
        '被落叶淹没',
        '中秋赏月吃月饼',
        '堆雪人',
        '放烟花',
        '吃粽子',
        '吃年糕',
        '吃青团',
        '吃腊八粥',
        '吃重阳糕',
        '收红包',
        '写福字',
        '穿针乞巧',
        '舞狮头',
        '讨糖南瓜灯',
        '插茱萸赏菊',
        '放河灯',
        '萌化小幽灵',
        '装点圣诞树',
        '放孔明灯',
        '吃汤圆',
        '吃饺子',
      ],
    },
    {
      id: '文字',
      weight: 10,
      noMirror: true,
      actions: ['是啊，吃什么', '深度思考碎碎念'],
    },
  ],
  weights: { idle: 10, turn: 5, move: 5 },
}

/** Every distinct clip name the catalogue references. */
export function allClipNames(catalog: MascotCatalog = MASCOT_CATALOG): string[] {
  const names = new Set<string>([
    ...catalog.idle,
    ...catalog.turn,
    ...catalog.drag,
    ...catalog.clicks,
    ...catalog.moves,
  ])
  for (const category of catalog.categories) {
    for (const action of category.actions) names.add(action)
  }
  return [...names]
}

/** Clips the mascot can reach without user interaction, used to warm the cache. */
export function idleChainClipNames(
  catalog: MascotCatalog = MASCOT_CATALOG
): string[] {
  const names = new Set<string>(catalog.idle)
  for (const category of catalog.categories) {
    for (const action of category.actions) names.add(action)
  }
  return [...names]
}
