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
import { MapPin, PackageSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { EmptyState } from '@/components/empty-state'
import { LoadingState } from '@/components/loading-state'
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
import { formatTimestamp } from '@/lib/format'

import {
  WHEEL_PRIZE_TYPE_LABEL_KEYS,
  WHEEL_WIN_STATUS_LABEL_KEYS,
  getWheelWinStatusVariant,
  toWheelWinStatus,
} from '../lib/wheel'
import type { WheelWin } from '../types'

interface WheelRecordsProps {
  items: WheelWin[]
  loading: boolean
  error: string | null
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  /** 实物奖品填写收货信息。 */
  onClaim: (win: WheelWin) => void
}

/** 我的中奖记录。 */
export function WheelRecords(props: WheelRecordsProps) {
  const { t } = useTranslation()
  const totalPages = Math.max(
    1,
    Math.ceil(props.total / Math.max(props.pageSize, 1))
  )

  if (props.loading && props.items.length === 0) {
    return <LoadingState />
  }
  if (props.error != null && props.items.length === 0) {
    return (
      <p role='alert' className='text-destructive py-8 text-center text-sm'>
        {props.error}
      </p>
    )
  }
  if (props.items.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title={t('No prize record yet')}
        description={t('Spin the wheel and your prizes will show up here.')}
      />
    )
  }

  return (
    <div className='space-y-3'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Prize')}</TableHead>
            <TableHead className='hidden sm:table-cell'>
              {t('Claim method')}
            </TableHead>
            <TableHead>{t('Status')}</TableHead>
            <TableHead className='hidden md:table-cell'>
              {t('Draw time')}
            </TableHead>
            <TableHead className='text-right'>{t('Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.items.map((win) => {
            const status = toWheelWinStatus(win.status)
            const needsAddress =
              win.prize_type === 'physical' &&
              status === 'pending' &&
              !win.has_address
            return (
              <TableRow key={win.id}>
                <TableCell>
                  <span className='flex items-center gap-2 font-medium'>
                    <span aria-hidden='true'>{win.prize_icon || '🎁'}</span>
                    {win.prize_name}
                  </span>
                  {win.tracking_no ? (
                    <span className='text-muted-foreground mt-1 block text-xs'>
                      {t('Tracking number')} {win.tracking_no}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className='hidden sm:table-cell'>
                  <span className='text-muted-foreground text-xs'>
                    {t(WHEEL_PRIZE_TYPE_LABEL_KEYS[win.prize_type])}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={getWheelWinStatusVariant(status)}>
                    {t(WHEEL_WIN_STATUS_LABEL_KEYS[status])}
                  </Badge>
                </TableCell>
                <TableCell className='text-muted-foreground hidden text-xs md:table-cell'>
                  {win.created_at > 0 ? formatTimestamp(win.created_at) : '—'}
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex items-center justify-end gap-2'>
                    {win.code ? (
                      <CopyButton
                        value={win.code}
                        tooltip={t('Copy code')}
                        successTooltip={t('Copied')}
                        aria-label={t('Copy code')}
                      />
                    ) : null}
                    {needsAddress ? (
                      <Button size='sm' onClick={() => props.onClaim(win)}>
                        <MapPin aria-hidden='true' className='size-3.5' />
                        {t('Fill shipping address')}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {props.total > props.pageSize ? (
        <div className='flex items-center justify-between gap-2'>
          <p className='text-muted-foreground text-xs' aria-live='polite'>
            {t('Page {{page}} of {{total}}', {
              page: props.page,
              total: totalPages,
            })}
          </p>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={props.page <= 1}
              onClick={() => props.onPageChange(props.page - 1)}
            >
              {t('Previous')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={props.page >= totalPages}
              onClick={() => props.onPageChange(props.page + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
