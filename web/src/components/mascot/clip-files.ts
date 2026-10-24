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
 * Clip name to file name.
 *
 * The upstream project names its animations in Chinese. Serving those names as
 * URLs works, but the file name then depends on how every layer between the
 * repository and the browser handles non-ASCII paths — git, the Go embed, a
 * Windows checkout, a CDN. Numbered slugs remove that entire class of problem
 * while this map keeps the readable name for the catalogue and the tests.
 *
 * Generated from the source asset directory; regenerate with
 * `scripts/build-mascot-clips.sh` if the upstream set ever changes.
 */
export const MASCOT_CLIP_FILES: Readonly<Record<string, string>> = {
  '三球抛接': 'clip-001',
  '下五子棋': 'clip-002',
  '东张西望': 'clip-003',
  '中秋赏月吃月饼': 'clip-004',
  '优雅女仆舞': 'clip-005',
  '余额-分文不剩': 'clip-006',
  '余额-数金皱眉': 'clip-007',
  '余额-袋空如洗': 'clip-008',
  '余额-金袋叮当': 'clip-009',
  '余额-钱袋如常': 'clip-010',
  '余额-钱袋满溢': 'clip-011',
  '偷吃零食被抓住': 'clip-012',
  '写代码': 'clip-013',
  '写福字': 'clip-014',
  '凭空生花': 'clip-015',
  '动物环绕': 'clip-016',
  '原地专心玩魔方': 'clip-017',
  '原地小憩沉眠': 'clip-018',
  '原地左转奔跑': 'clip-019',
  '原地敲击桌面互动': 'clip-020',
  '原地漂浮踏步': 'clip-021',
  '原地跳跃抓碎头顶物品': 'clip-022',
  '原地蹲下玩玩具汽车': 'clip-023',
  '原地重力下蹲压缩': 'clip-024',
  '变鸽子': 'clip-025',
  '可爱宅舞': 'clip-026',
  '吃Token': 'clip-027',
  '吃冰淇淋融化': 'clip-028',
  '吃午餐': 'clip-029',
  '吃大闸蟹': 'clip-030',
  '吃年糕': 'clip-031',
  '吃早餐': 'clip-032',
  '吃晚餐': 'clip-033',
  '吃汤圆': 'clip-034',
  '吃白饭': 'clip-035',
  '吃粽子': 'clip-036',
  '吃糖葫芦': 'clip-037',
  '吃腊八粥': 'clip-038',
  '吃西瓜': 'clip-039',
  '吃重阳糕': 'clip-040',
  '吃长寿面': 'clip-041',
  '吃青团': 'clip-042',
  '吃饺子': 'clip-043',
  '吹气球': 'clip-044',
  '吹笛子': 'clip-045',
  '哈欠连天': 'clip-046',
  '堆雪人': 'clip-047',
  '大口吃零食': 'clip-048',
  '女仆屈膝礼仪': 'clip-049',
  '小幅度原地360度旋转展示': 'clip-050',
  '小提琴演奏': 'clip-051',
  '工作状态-原地踱步张望': 'clip-052',
  '工作状态-垂头叹气冒汗': 'clip-053',
  '工作状态-忙碌点按': 'clip-054',
  '工作状态-思考冒泡': 'clip-055',
  '工作状态-清点归档': 'clip-056',
  '工作状态-雀跃庆祝': 'clip-057',
  '待机呼吸休闲': 'clip-058',
  '悠闲哼歌': 'clip-059',
  '扑克魔术': 'clip-060',
  '打瞌睡被惊醒': 'clip-061',
  '抽陀螺': 'clip-062',
  '拆礼物': 'clip-063',
  '插茱萸赏菊': 'clip-064',
  '摇扇纳凉': 'clip-065',
  '撸猫': 'clip-066',
  '收红包': 'clip-067',
  '放孔明灯': 'clip-068',
  '放河灯': 'clip-069',
  '放烟花': 'clip-070',
  '放风筝': 'clip-071',
  '整体换装试色': 'clip-072',
  '是啊，吃什么': 'clip-073',
  '晨间刷牙': 'clip-074',
  '涮火锅': 'clip-075',
  '深度思考碎碎念': 'clip-076',
  '点击回应-傲娇生气': 'clip-077',
  '点击回应-元气挥手': 'clip-078',
  '点击回应-害羞惊讶': 'clip-079',
  '点击回应-开心跃动': 'clip-080',
  '点击回应-挠痒咯咯笑': 'clip-081',
  '照镜子': 'clip-082',
  '玩水枪': 'clip-083',
  '玩游戏气急败坏': 'clip-084',
  '用鲸鱼尾巴拍打地面': 'clip-085',
  '碎碎念-发呆碎碎念': 'clip-086',
  '碎碎念-对屏碎碎念': 'clip-087',
  '碎碎念-擦桌碎碎念': 'clip-088',
  '穿针乞巧': 'clip-089',
  '舞狮头': 'clip-090',
  '荡秋千': 'clip-091',
  '萌化小幽灵': 'clip-092',
  '蓝鲸现世': 'clip-093',
  '蝴蝶蜜蜂环绕头顶开花': 'clip-094',
  '螃蟹走路': 'clip-095',
  '被吓一跳': 'clip-096',
  '被落叶淹没': 'clip-097',
  '被鼠标拖拽悬空反馈': 'clip-098',
  '装点圣诞树': 'clip-099',
  '讨糖南瓜灯': 'clip-100',
  '超大伸懒腰': 'clip-101',
  '踢毽子': 'clip-102',
  '轻快摇摆舞': 'clip-103',
  '轻快记录': 'clip-104',
  '骑木马': 'clip-105',
  '鲸鱼吐泡泡特效': 'clip-106',
}
