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
import { api } from '@/lib/api'

import type {
  LotteryDrawResult,
  LotteryMode,
  LotteryPublicWin,
  LotteryRankBoard,
  LotteryStatus,
  WelfareChestKey,
  WelfareChestOpenResult,
  WelfareChestRankings,
  WelfareChestStatus,
} from './types'

type ApiEnvelope<T> = {
  success: boolean
  message?: string
  code?: string
  reason?: string
  data?: T
}

// 业务失败由页面自行处理，因此关闭全局拦截器提示
const silentOptions = {
  skipBusinessError: true,
  skipErrorHandler: true,
}

// ---------------------------------------------------------------------------
// 幸运抽奖
// ---------------------------------------------------------------------------

export async function getLotteryStatus(): Promise<ApiEnvelope<LotteryStatus>> {
  const res = await api.get('/api/user/lottery/status', silentOptions)
  return res.data
}

export async function drawLottery(
  mode: LotteryMode
): Promise<ApiEnvelope<LotteryDrawResult>> {
  const res = await api.post('/api/user/lottery/draw', { mode }, silentOptions)
  return res.data
}

export async function getLotteryRanking(): Promise<
  ApiEnvelope<LotteryRankBoard>
> {
  const res = await api.get('/api/user/lottery/ranking', silentOptions)
  return res.data
}

export async function getLotteryPublicWins(): Promise<
  ApiEnvelope<{ items: LotteryPublicWin[] }>
> {
  const res = await api.get('/api/user/lottery/public-wins', silentOptions)
  return res.data
}

// ---------------------------------------------------------------------------
// 福利宝箱
// ---------------------------------------------------------------------------

export async function getWelfareChestsStatus(): Promise<
  ApiEnvelope<WelfareChestStatus>
> {
  const res = await api.get('/api/user/welfare-chests/status', silentOptions)
  return res.data
}

export async function openWelfareChest(
  chest: WelfareChestKey
): Promise<ApiEnvelope<WelfareChestOpenResult>> {
  const res = await api.post(
    '/api/user/welfare-chests/open',
    { chest },
    silentOptions
  )
  return res.data
}

export async function getWelfareChestsRanking(): Promise<
  ApiEnvelope<WelfareChestRankings>
> {
  const res = await api.get('/api/user/welfare-chests/ranking', silentOptions)
  return res.data
}
