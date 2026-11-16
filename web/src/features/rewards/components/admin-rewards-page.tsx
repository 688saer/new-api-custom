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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatQuota } from '@/lib/format'

import {
  issueRewardCampaign,
  listRewardCampaigns,
  previewRewardCampaign,
  revokeRewardCampaign,
} from '../api'
import { createEmptyDraft } from '../lib/reward-draft'
import type {
  RewardCampaignDraft,
  RewardCampaignList,
  RewardCampaignSummary,
  RewardPreview,
} from '../types'
import { AdminRewardCampaigns } from './admin-reward-campaigns'
import { AdminRewardForm } from './admin-reward-form'
import { AdminRewardGrantsDialog } from './admin-reward-grants-dialog'

const PAGE_SIZE = 20

/**
 * 奖励管理：发放奖励（表单 + 券面预览）与发放记录两个页签。
 *
 * 对应参考站 `/admin/rewards`。撤回只会作废尚未领取的部分，已到账的余额
 * 保持不变。
 */
export function AdminRewardsPage() {
  const { t } = useTranslation()

  const [tab, setTab] = useState('draft')
  const [draft, setDraft] = useState<RewardCampaignDraft>(createEmptyDraft)
  const [preview, setPreview] = useState<RewardPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [issuing, setIssuing] = useState(false)

  const [campaigns, setCampaigns] = useState<RewardCampaignList | null>(null)
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [grantsCampaign, setGrantsCampaign] =
    useState<RewardCampaignSummary | null>(null)
  const [grantsOpen, setGrantsOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] =
    useState<RewardCampaignSummary | null>(null)

  const campaignSeq = useRef(0)

  const loadCampaigns = useCallback(
    async (targetPage: number) => {
      const seq = ++campaignSeq.current
      setCampaignsLoading(true)
      try {
        const res = await listRewardCampaigns(targetPage, PAGE_SIZE)
        if (seq !== campaignSeq.current) return
        if (res.success && res.data) setCampaigns(res.data)
        else
          toast.error(
            res.reason || t('Request failed, please try again later.')
          )
      } catch {
        toast.error(t('Request failed, please try again later.'))
      } finally {
        if (seq === campaignSeq.current) setCampaignsLoading(false)
      }
    },
    [t]
  )

  useEffect(() => {
    void loadCampaigns(page)
  }, [loadCampaigns, page])

  const handlePreview = async () => {
    setPreviewing(true)
    try {
      const res = await previewRewardCampaign(draft)
      if (!res.success || !res.data) {
        toast.error(res.reason || t('Request failed, please try again later.'))
        return
      }
      setPreview(res.data)
      toast.success(
        t('{{count}} users match, total {{amount}}', {
          count: res.data.count,
          amount: formatQuota(res.data.total_quota),
        })
      )
    } catch {
      toast.error(t('Request failed, please try again later.'))
    } finally {
      setPreviewing(false)
    }
  }

  const handleIssue = async () => {
    setIssuing(true)
    try {
      const res = await issueRewardCampaign(draft)
      if (!res.success || !res.data) {
        toast.error(res.reason || t('Request failed, please try again later.'))
        return
      }
      toast.success(
        t('Rewards issued to {{count}} users', { count: res.data.target_count })
      )
      setDraft(createEmptyDraft())
      setPreview(null)
      setTab('campaigns')
      setPage(1)
      void loadCampaigns(1)
    } catch {
      toast.error(t('Request failed, please try again later.'))
    } finally {
      setIssuing(false)
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    try {
      const res = await revokeRewardCampaign(revokeTarget.id)
      if (!res.success) {
        toast.error(res.reason || t('Request failed, please try again later.'))
        return
      }
      toast.success(t('Unclaimed rewards have been withdrawn'))
      void loadCampaigns(page)
    } catch {
      toast.error(t('Request failed, please try again later.'))
    } finally {
      setRevokeTarget(null)
    }
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Reward management')}
        </SectionPageLayout.Title>

        <SectionPageLayout.Actions>
          {preview != null && (
            <span className='text-muted-foreground text-sm'>
              {preview.estimated
                ? t(
                    '{{count}} users match, total about {{amount}} (random amounts are drawn at issue time)',
                    {
                      count: preview.count,
                      amount: formatQuota(preview.total_quota),
                    }
                  )
                : t('{{count}} users match, total {{amount}}', {
                    count: preview.count,
                    amount: formatQuota(preview.total_quota),
                  })}
            </span>
          )}
        </SectionPageLayout.Actions>

        <SectionPageLayout.Content>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value='draft'>{t('Issue rewards')}</TabsTrigger>
              <TabsTrigger value='campaigns'>{t('Issue history')}</TabsTrigger>
            </TabsList>

            <TabsContent value='draft' className='pt-6'>
              <AdminRewardForm
                draft={draft}
                onDraftChange={setDraft}
                onPreview={() => void handlePreview()}
                onIssue={() => void handleIssue()}
                previewing={previewing}
                issuing={issuing}
                canIssue={preview != null && preview.count > 0}
              />
            </TabsContent>

            <TabsContent value='campaigns' className='pt-6'>
              <div className='space-y-4'>
                <div className='flex justify-end'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => void loadCampaigns(page)}
                  >
                    {t('Refresh records')}
                  </Button>
                </div>
                <AdminRewardCampaigns
                  items={campaigns?.items ?? []}
                  loading={campaignsLoading}
                  page={page}
                  pageSize={campaigns?.page_size ?? PAGE_SIZE}
                  total={campaigns?.total ?? 0}
                  onPageChange={setPage}
                  onShowGrants={(campaign) => {
                    setGrantsCampaign(campaign)
                    setGrantsOpen(true)
                  }}
                  onRevoke={setRevokeTarget}
                />
              </div>
            </TabsContent>
          </Tabs>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <AdminRewardGrantsDialog
        open={grantsOpen}
        onOpenChange={setGrantsOpen}
        campaign={grantsCampaign}
      />

      <ConfirmDialog
        open={revokeTarget != null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
        title={t('Withdraw unclaimed rewards?')}
        desc={t(
          'Only rewards that are still unclaimed are withdrawn. Credits already in user balances stay valid.'
        )}
        confirmText={t('Withdraw unclaimed')}
        destructive
        handleConfirm={() => void handleRevoke()}
      />
    </>
  )
}
