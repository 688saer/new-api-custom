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

import { EmptyState } from '@/components/empty-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  WHEEL_PRIZE_TYPE_LABEL_KEYS,
  WHEEL_WIN_STATUS_LABEL_KEYS,
  getWheelWinStatusVariant,
  toWheelWinStatus,
  type WheelWin,
} from '@/features/lucky-wheel'
import { formatTimestamp } from '@/lib/format'

import { RECORD_STATUS_FILTERS } from '../lib/prizes'
import type { WheelAdminPrize, WheelRecordFilter } from '../types'

/** 中奖记录可执行的后台操作。 */
export type WheelRecordAction = 'ship' | 'deliver' | 'cancel'

interface RecordTableProps {
  records: WheelWin[]
  prizes: WheelAdminPrize[]
  filter: WheelRecordFilter
  /** 搜索框当前输入值，父级防抖后再写入 filter.keyword。 */
  keyword: string
  total: number
  loading: boolean
  error: string | null
  onFilterChange: (patch: Partial<WheelRecordFilter>) => void
  onAction: (action: WheelRecordAction, win: WheelWin) => void
}

/** 后台中奖记录列表。 */
export function RecordTable(props: RecordTableProps) {
  const { t } = useTranslation()
  const totalPages = Math.max(
    1,
    Math.ceil(props.total / Math.max(props.filter.pageSize, 1))
  )

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          className='max-w-56'
          value={props.keyword}
          placeholder={t('Search by user or prize')}
          aria-label={t('Search by user or prize')}
          onChange={(event) =>
            props.onFilterChange({ keyword: event.target.value, page: 1 })
          }
        />
        <NativeSelect
          className='w-40'
          aria-label={t('Status')}
          value={props.filter.status}
          onChange={(event) =>
            props.onFilterChange({ status: event.target.value, page: 1 })
          }
        >
          {RECORD_STATUS_FILTERS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {t(option.labelKey)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          className='w-44'
          aria-label={t('Prize')}
          value={String(props.filter.prize_id)}
          onChange={(event) =>
            props.onFilterChange({
              prize_id: Number(event.target.value) || 0,
              page: 1,
            })
          }
        >
          <NativeSelectOption value='0'>{t('All prizes')}</NativeSelectOption>
          {props.prizes.map((prize) => (
            <NativeSelectOption key={prize.id} value={String(prize.id)}>
              {prize.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className='text-muted-foreground ml-auto text-xs' aria-live='polite'>
          {t('{{count}} records', { count: props.total })}
        </p>
      </div>

      {props.error != null ? (
        <p role='alert' className='text-destructive text-sm'>
          {props.error}
        </p>
      ) : null}

      {props.loading && props.records.length === 0 && <LoadingState />}
      {!props.loading && props.records.length === 0 && (
        <EmptyState title={t('No prize record yet')} />
      )}
      {props.records.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('User')}</TableHead>
              <TableHead>{t('Prize')}</TableHead>
              <TableHead className='hidden sm:table-cell'>
                {t('Status')}
              </TableHead>
              <TableHead className='hidden lg:table-cell'>
                {t('Shipping address')}
              </TableHead>
              <TableHead className='hidden md:table-cell'>
                {t('Draw time')}
              </TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.records.map((win) => {
              const status = toWheelWinStatus(win.status)
              const finished = status === 'delivered' || status === 'cancelled'
              const canShip =
                win.prize_type === 'physical' &&
                status === 'pending' &&
                win.has_address
              return (
                <TableRow key={win.id}>
                  <TableCell>
                    <span className='font-medium'>
                      {win.username || `#${win.user_id}`}
                    </span>
                    <span className='text-muted-foreground block text-xs'>
                      {t(WHEEL_PRIZE_TYPE_LABEL_KEYS[win.prize_type])}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className='flex items-center gap-1.5'>
                      <span aria-hidden='true'>{win.prize_icon || '🎁'}</span>
                      {win.prize_name}
                    </span>
                    {win.tracking_no ? (
                      <span className='text-muted-foreground block text-xs'>
                        {t('Tracking number')} {win.tracking_no}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className='hidden sm:table-cell'>
                    <Badge variant={getWheelWinStatusVariant(status)}>
                      {t(WHEEL_WIN_STATUS_LABEL_KEYS[status])}
                    </Badge>
                  </TableCell>
                  <TableCell className='hidden max-w-56 lg:table-cell'>
                    {win.has_address ? (
                      <span className='text-muted-foreground block text-xs'>
                        {win.receiver_name} · {win.receiver_phone}
                        <br />
                        {win.receiver_address}
                      </span>
                    ) : (
                      <span className='text-muted-foreground text-xs'>—</span>
                    )}
                  </TableCell>
                  <TableCell className='text-muted-foreground hidden text-xs md:table-cell'>
                    {win.created_at > 0 ? formatTimestamp(win.created_at) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className='flex items-center justify-end gap-1'>
                      {canShip ? (
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => props.onAction('ship', win)}
                        >
                          {t('Ship')}
                        </Button>
                      ) : null}
                      {finished ? null : (
                        <>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => props.onAction('deliver', win)}
                          >
                            {t('Mark delivered')}
                          </Button>
                          <Button
                            size='sm'
                            variant='ghost'
                            onClick={() => props.onAction('cancel', win)}
                          >
                            {t('Cancel')}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {props.total > props.filter.pageSize ? (
        <div className='flex items-center justify-between'>
          <p className='text-muted-foreground text-xs'>
            {t('Page {{page}} of {{total}}', {
              page: props.filter.page,
              total: totalPages,
            })}
          </p>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={props.filter.page <= 1}
              onClick={() =>
                props.onFilterChange({ page: props.filter.page - 1 })
              }
            >
              {t('Previous')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={props.filter.page >= totalPages}
              onClick={() =>
                props.onFilterChange({ page: props.filter.page + 1 })
              }
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
