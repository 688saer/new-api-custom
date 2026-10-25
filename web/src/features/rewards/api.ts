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
  RewardCampaignDraft,
  RewardCampaignList,
  RewardCampaignSummary,
  RewardClaimResult,
  RewardGrantList,
  RewardHistoryResult,
  RewardPendingResult,
  RewardPreview,
  RewardUserOption,
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
// 用户侧
// ---------------------------------------------------------------------------

export async function getPendingRewards(): Promise<
  ApiEnvelope<RewardPendingResult>
> {
  const res = await api.get('/api/user/rewards/pending', silentOptions)
  return res.data
}

export async function getRewardHistory(
  page: number,
  pageSize: number
): Promise<ApiEnvelope<RewardHistoryResult>> {
  const res = await api.get(
    `/api/user/rewards/history?page=${page}&page_size=${pageSize}`,
    silentOptions
  )
  return res.data
}

export async function claimReward(
  grantId: number
): Promise<ApiEnvelope<RewardClaimResult>> {
  const res = await api.post(
    `/api/user/rewards/${grantId}/claim`,
    {},
    silentOptions
  )
  return res.data
}

// ---------------------------------------------------------------------------
// 管理侧
// ---------------------------------------------------------------------------

export async function searchRewardUsers(
  keyword: string,
  limit = 20
): Promise<ApiEnvelope<{ items: RewardUserOption[] }>> {
  const res = await api.get(
    `/api/user/rewards/users?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
    silentOptions
  )
  return res.data
}

export async function previewRewardCampaign(
  draft: RewardCampaignDraft
): Promise<ApiEnvelope<RewardPreview>> {
  const res = await api.post(
    '/api/user/rewards/campaigns/preview',
    draft,
    silentOptions
  )
  return res.data
}

export async function issueRewardCampaign(
  draft: RewardCampaignDraft
): Promise<ApiEnvelope<RewardCampaignSummary>> {
  const res = await api.post(
    '/api/user/rewards/campaigns',
    draft,
    silentOptions
  )
  return res.data
}

export async function listRewardCampaigns(
  page: number,
  pageSize: number
): Promise<ApiEnvelope<RewardCampaignList>> {
  const res = await api.get(
    `/api/user/rewards/campaigns?page=${page}&page_size=${pageSize}`,
    silentOptions
  )
  return res.data
}

export async function listRewardCampaignGrants(
  campaignId: number,
  page: number,
  pageSize: number
): Promise<ApiEnvelope<RewardGrantList>> {
  const res = await api.get(
    `/api/user/rewards/campaigns/${campaignId}/grants?page=${page}&page_size=${pageSize}`,
    silentOptions
  )
  return res.data
}

export async function revokeRewardCampaign(
  campaignId: number
): Promise<ApiEnvelope<RewardCampaignSummary>> {
  const res = await api.post(
    `/api/user/rewards/campaigns/${campaignId}/revoke`,
    {},
    silentOptions
  )
  return res.data
}
