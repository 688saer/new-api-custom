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
import { Pencil, Plus, Search, Ticket, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatNumber, formatTimestamp } from '@/lib/format'

import type { WheelDrawGrant } from '../types'

interface DrawGrantTableProps {
  grants: WheelDrawGrant[]
  total: number
  loading: boolean
  error: string | null
  keyword: string
  page: number
  pageSize: number
  onKeywordChange: (keyword: string) => void
  onPageChange: (page: number) => void
  onCreate: () => void
  onEdit: (grant: WheelDrawGrant) => void
  onRevoke: (grant: WheelDrawGrant) => void
}

/** 已发放抽奖次数列表。 */
export function DrawGrantTable(props: DrawGrantTableProps) {
  const { t } = useTranslation()
  const totalPages = Math.max(
    Math.ceil(props.total / Math.max(props.pageSize, 1)),
    1
  )

  const renderBody = () => {
    if (props.loading && props.grants.length === 0) {
      return <LoadingState />
    }
    if (props.grants.length === 0) {
      return (
        <EmptyState
          title={t('No draw attempts granted yet')}
          description={t(
            'Grant permanent or daily free draws to individual users. Both can be granted together or one at a time.'
          )}
          action={
            <Button onClick={props.onCreate}>
              <Plus aria-hidden='true' className='size-4' />
              {t('Grant draw attempts')}
            </Button>
          }
        />
      )
    }
    return (
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('User')}</TableHead>
              <TableHead>{t('Granted permanent left')}</TableHead>
              <TableHead>{t('Initial draws left')}</TableHead>
              <TableHead>{t('Daily free draws')}</TableHead>
              <TableHead>{t('Free draws today')}</TableHead>
              <TableHead>{t('Updated at')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.grants.map((grant) => (
              <TableRow key={grant.user_id}>
                <TableCell>
                  <div className='flex items-center gap-2'>
                    <span className='font-medium'>
                      {grant.username || `#${grant.user_id}`}
                    </span>
                    <span className='text-muted-foreground text-xs'>
                      #{grant.user_id}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={grant.permanent_draws > 0 ? 'default' : 'outline'}
                  >
                    <Ticket aria-hidden='true' className='size-3' />
                    {formatNumber(grant.permanent_draws)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      grant.initial_permanent_left > 0 ? 'default' : 'outline'
                    }
                  >
                    {formatNumber(grant.initial_permanent_left)}
                  </Badge>
                </TableCell>
                <TableCell>{formatNumber(grant.daily_free_draws)}</TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {t('{{used}} used / {{total}} total', {
                    used: formatNumber(grant.free_used_today),
                    total: formatNumber(grant.free_today),
                  })}
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {grant.updated_at > 0
                    ? formatTimestamp(grant.updated_at)
                    : '—'}
                </TableCell>
                <TableCell>
                  <div className='flex justify-end gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => props.onEdit(grant)}
                    >
                      <Pencil aria-hidden='true' className='size-4' />
                      {t('Edit')}
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => props.onRevoke(grant)}
                    >
                      <Trash2 aria-hidden='true' className='size-4' />
                      {t('Revoke')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='relative w-full max-w-xs'>
          <Search
            aria-hidden='true'
            className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2'
          />
          <Input
            value={props.keyword}
            placeholder={t('Search by user name or ID')}
            aria-label={t('Search by user name or ID')}
            className='pl-9'
            onChange={(event) => props.onKeywordChange(event.target.value)}
          />
        </div>
        <Button size='sm' onClick={props.onCreate}>
          <Plus aria-hidden='true' className='size-4' />
          {t('Grant draw attempts')}
        </Button>
      </div>

      {renderBody()}

      {props.error != null && (
        <p role='alert' className='text-destructive text-sm'>
          {props.error}
        </p>
      )}

      {props.total > props.pageSize ? (
        <div className='flex items-center justify-between'>
          <p className='text-muted-foreground text-xs'>
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
