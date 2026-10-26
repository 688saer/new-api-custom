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
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatQuota } from '@/lib/format'
import { formatDateTimeObject } from '@/lib/time'

import { REWARD_MODE_LABEL_KEYS, toRewardMode } from '../lib/rewards'
import type { RewardCampaignSummary } from '../types'

interface AdminRewardCampaignsProps {
  items: RewardCampaignSummary[]
  loading: boolean
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onShowGrants: (campaign: RewardCampaignSummary) => void
  onRevoke: (campaign: RewardCampaignSummary) => void
}

/** 发放记录表：人数、已领取、总额、状态，并可查看明细或撤回。 */
export function AdminRewardCampaigns(props: AdminRewardCampaignsProps) {
  const { t } = useTranslation()
  const pages = Math.max(
    1,
    Math.ceil(props.total / Math.max(1, props.pageSize))
  )

  if (props.loading && props.items.length === 0) {
    return (
      <p className='text-muted-foreground py-8 text-center text-sm'>
        {t('Loading campaigns…')}
      </p>
    )
  }

  if (props.items.length === 0) {
    return (
      <p className='text-muted-foreground py-8 text-center text-sm'>
        {t('No campaigns yet')}
      </p>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Campaign')}</TableHead>
              <TableHead>{t('Calculation')}</TableHead>
              <TableHead>{t('Recipients')}</TableHead>
              <TableHead>{t('Total amount')}</TableHead>
              <TableHead>{t('Claimed')}</TableHead>
              <TableHead>{t('Claim window')}</TableHead>
              <TableHead>{t('Created at')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.items.map((campaign) => {
              const revoked = campaign.status === 'revoked'
              return (
                <TableRow key={campaign.id}>
                  <TableCell className='min-w-[160px] font-medium'>
                    {campaign.name}
                  </TableCell>
                  <TableCell className='text-muted-foreground whitespace-nowrap'>
                    {t(
                      REWARD_MODE_LABEL_KEYS[toRewardMode(campaign.reward_mode)]
                    )}
                  </TableCell>
                  <TableCell className='tabular-nums'>
                    {campaign.claimed_count} / {campaign.target_count}
                  </TableCell>
                  <TableCell className='tabular-nums'>
                    {formatQuota(campaign.total_quota)}
                  </TableCell>
                  <TableCell className='tabular-nums'>
                    {formatQuota(campaign.claimed_quota)}
                  </TableCell>
                  <TableCell className='text-muted-foreground min-w-[200px] text-xs'>
                    <span className='block'>
                      {campaign.claim_start_at > 0
                        ? formatDateTimeObject(
                            new Date(campaign.claim_start_at * 1000)
                          )
                        : t('Immediately')}
                    </span>
                    <span className='block'>
                      {campaign.expires_at > 0
                        ? formatDateTimeObject(
                            new Date(campaign.expires_at * 1000)
                          )
                        : t('Long-term valid')}
                    </span>
                  </TableCell>
                  <TableCell className='text-muted-foreground whitespace-nowrap'>
                    {formatDateTimeObject(new Date(campaign.created_at * 1000))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={revoked ? 'outline' : 'secondary'}>
                      {revoked ? t('Withdrawn') : t('Active')}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-right whitespace-nowrap'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => props.onShowGrants(campaign)}
                    >
                      {t('Details')}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      disabled={revoked}
                      onClick={() => props.onRevoke(campaign)}
                    >
                      {t('Withdraw unclaimed')}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {pages > 1 && (
        <nav
          aria-label={t('Pagination')}
          className='flex items-center justify-end gap-3'
        >
          <Button
            variant='outline'
            size='sm'
            disabled={props.page <= 1}
            onClick={() => props.onPageChange(props.page - 1)}
          >
            {t('Previous')}
          </Button>
          <span className='text-muted-foreground text-sm tabular-nums'>
            {props.page} / {pages}
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={props.page >= pages}
            onClick={() => props.onPageChange(props.page + 1)}
          >
            {t('Next')}
          </Button>
        </nav>
      )}
    </div>
  )
}
