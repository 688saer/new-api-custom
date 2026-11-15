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
import type { WheelDrawGrant } from '../types'

/** 单次发放上限，与后端 model.WheelDrawGrantLimit 保持一致。 */
export const DRAW_GRANT_LIMIT = 1000000

/** 发放抽奖次数的表单值。 */
export interface DrawGrantDraft {
  permanentDraws: number
  dailyFreeDraws: number
}

export function createEmptyDrawGrantDraft(): DrawGrantDraft {
  return { permanentDraws: 0, dailyFreeDraws: 0 }
}

/** 编辑已有发放记录时用当前值回填。 */
export function toDrawGrantDraft(grant: WheelDrawGrant): DrawGrantDraft {
  return {
    permanentDraws: grant.permanent_draws,
    dailyFreeDraws: grant.daily_free_draws,
  }
}

/**
 * 校验发放输入，返回 i18n 错误键；合法时返回 null。
 * 两个值都为 0 是合法的，表示收回该用户的发放。
 */
export function validateDrawGrantDraft(draft: DrawGrantDraft): string | null {
  if (!Number.isInteger(draft.permanentDraws) || draft.permanentDraws < 0) {
    return 'Permanent draw attempts must be a whole number of 0 or more'
  }
  if (!Number.isInteger(draft.dailyFreeDraws) || draft.dailyFreeDraws < 0) {
    return 'Daily free draw attempts must be a whole number of 0 or more'
  }
  if (
    draft.permanentDraws > DRAW_GRANT_LIMIT ||
    draft.dailyFreeDraws > DRAW_GRANT_LIMIT
  ) {
    return 'Draw attempts exceed the allowed maximum'
  }
  return null
}
