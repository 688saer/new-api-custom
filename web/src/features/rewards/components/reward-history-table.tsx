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

import {
  getRewardStatusVariant,
  REWARD_STATUS_LABEL_KEYS,
  toRewardGrantStatus,
} from '../lib/rewards'
import type { RewardItem } from '../types'

interface RewardHistoryTableProps {
  items: RewardItem[]
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

/** 领取记录表：活动、金额、状态、领取时间。 */
export function RewardHistoryTable(props: RewardHistoryTableProps) {
  const { t } = useTranslation()
  const pages = Math.max(
    1,
    Math.ceil(props.total / Math.max(1, props.pageSize))
  )

  return (
    <div className='space-y-4'>
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Campaign')}</TableHead>
              <TableHead>{t('Amount')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Claimed at')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.items.map((item) => {
              const status = toRewardGrantStatus(item.status)
              return (
                <TableRow key={item.id}>
                  <TableCell className='min-w-[160px] font-medium'>
                    {item.campaign_name}
                  </TableCell>
                  <TableCell className='tabular-nums'>
                    {formatQuota(item.amount_quota)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRewardStatusVariant(status)}>
                      {t(REWARD_STATUS_LABEL_KEYS[status])}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {item.claimed_at > 0
                      ? formatDateTimeObject(new Date(item.claimed_at * 1000))
                      : t('Not claimed')}
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
