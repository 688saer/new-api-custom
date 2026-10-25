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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
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

import { listRewardCampaignGrants } from '../api'
import {
  getRewardStatusVariant,
  REWARD_STATUS_LABEL_KEYS,
} from '../lib/rewards'
import type { RewardCampaignSummary, RewardGrantList } from '../types'

const PAGE_SIZE = 20

interface AdminRewardGrantsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaign: RewardCampaignSummary | null
}

/** 某次发放的领取明细。 */
export function AdminRewardGrantsDialog(props: AdminRewardGrantsDialogProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<RewardGrantList | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const campaignId = props.campaign?.id ?? 0

  useEffect(() => {
    if (!props.open || campaignId <= 0) return
    let cancelled = false
    setLoading(true)
    setError(false)
    listRewardCampaignGrants(campaignId, page, PAGE_SIZE)
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data) setData(res.data)
        else setError(true)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [campaignId, page, props.open])

  useEffect(() => {
    if (!props.open) {
      setData(null)
      setPage(1)
    }
  }, [props.open])

  const pages = Math.max(
    1,
    Math.ceil((data?.total ?? 0) / Math.max(1, data?.page_size ?? PAGE_SIZE))
  )

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Claim details')}
      description={props.campaign?.name}
      contentClassName='sm:max-w-2xl'
      contentHeight='auto'
    >
      {loading && !data ? (
        <p className='text-muted-foreground py-8 text-center text-sm'>
          {t('Loading details…')}
        </p>
      ) : error ? (
        <p className='text-destructive py-8 text-center text-sm'>
          {t('Request failed, please try again later.')}
        </p>
      ) : !data || data.items.length === 0 ? (
        <p className='text-muted-foreground py-8 text-center text-sm'>
          {t('No recipients')}
        </p>
      ) : (
        <div className='space-y-4'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('User')}</TableHead>
                  <TableHead>{t('Amount')}</TableHead>
                  <TableHead>{t('Status')}</TableHead>
                  <TableHead>{t('Claimed at')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((grant) => (
                  <TableRow key={grant.id}>
                    <TableCell className='min-w-[180px]'>
                      {grant.username
                        ? `${grant.username} · ${grant.email}`
                        : grant.email}
                    </TableCell>
                    <TableCell className='tabular-nums'>
                      {formatQuota(grant.amount_quota)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRewardStatusVariant(grant.status)}>
                        {t(REWARD_STATUS_LABEL_KEYS[grant.status])}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-muted-foreground whitespace-nowrap'>
                      {grant.claimed_at > 0
                        ? formatDateTimeObject(
                            new Date(grant.claimed_at * 1000)
                          )
                        : t('Not claimed')}
                    </TableCell>
                  </TableRow>
                ))}
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
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                {t('Previous')}
              </Button>
              <span className='text-muted-foreground text-sm tabular-nums'>
                {page} / {pages}
              </span>
              <Button
                variant='outline'
                size='sm'
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                {t('Next')}
              </Button>
            </nav>
          )}
        </div>
      )}
    </Dialog>
  )
}
