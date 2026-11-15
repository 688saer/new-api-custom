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
import { Ban, CheckCheck, PackageCheck, Search } from 'lucide-react'
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
  claimStatusLabelKey,
  claimTypeLabelKey,
  type ClaimCodeClaim,
} from '@/features/redeem-center'
import { formatTimestamp } from '@/lib/format'

import { CLAIM_TYPE_OPTIONS } from '../lib/claim-codes'
import type { ClaimCodeClaimFilter, ClaimRecordAction } from '../types'

const STATUS_OPTIONS: { value: string; labelKey: string }[] = [
  { value: '', labelKey: 'All statuses' },
  { value: 'pending', labelKey: 'Waiting for shipping address' },
  { value: 'ready', labelKey: 'Waiting for shipment' },
  { value: 'shipped', labelKey: 'Shipped' },
  { value: 'delivered', labelKey: 'Delivered' },
  { value: 'cancelled', labelKey: 'Cancelled' },
]

interface ClaimRecordTableProps {
  claims: ClaimCodeClaim[]
  total: number
  loading: boolean
  error: string | null
  filter: ClaimCodeClaimFilter
  onFilterChange: (patch: Partial<ClaimCodeClaimFilter>) => void
  onAction: (action: ClaimRecordAction, claim: ClaimCodeClaim) => void
}

/** 领取记录：实物发货、标记已发放与作废。 */
export function ClaimRecordTable(props: ClaimRecordTableProps) {
  const { t } = useTranslation()
  const totalPages = Math.max(
    Math.ceil(props.total / Math.max(props.filter.pageSize, 1)),
    1
  )

  const renderActions = (claim: ClaimCodeClaim) => {
    const canShip =
      claim.type === 'physical' &&
      (claim.status === 'ready' || claim.status === 'shipped')
    const canDeliver = claim.type === 'physical' && claim.status === 'shipped'
    const canCancel =
      claim.status !== 'cancelled' && claim.status !== 'delivered'

    if (!canShip && !canDeliver && !canCancel) {
      return <span className='text-muted-foreground text-xs'>—</span>
    }
    return (
      <div className='flex justify-end gap-1'>
        {canShip && (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => props.onAction('ship', claim)}
          >
            <PackageCheck aria-hidden='true' className='size-4' />
            {t('Ship prize')}
          </Button>
        )}
        {canDeliver && (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => props.onAction('deliver', claim)}
          >
            <CheckCheck aria-hidden='true' className='size-4' />
            {t('Mark as delivered')}
          </Button>
        )}
        {canCancel && (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => props.onAction('cancel', claim)}
          >
            <Ban aria-hidden='true' className='size-4' />
            {t('Cancel this record')}
          </Button>
        )}
      </div>
    )
  }

  const renderBody = () => {
    if (props.loading && props.claims.length === 0) {
      return <LoadingState />
    }
    if (props.claims.length === 0) {
      return (
        <EmptyState
          title={t('No claim records yet')}
          description={t(
            'Records appear here as soon as a user redeems a code.'
          )}
        />
      )
    }
    return (
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Prize')}</TableHead>
              <TableHead>{t('User')}</TableHead>
              <TableHead>{t('Prize type')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Shipping information')}</TableHead>
              <TableHead>{t('Redeemed at')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.claims.map((claim) => (
              <TableRow key={claim.id}>
                <TableCell>
                  <div className='min-w-0'>
                    <p className='truncate font-medium'>{claim.name}</p>
                    <p className='text-muted-foreground font-mono text-xs'>
                      {claim.code}
                    </p>
                  </div>
                </TableCell>
                <TableCell className='text-sm'>
                  {claim.username || `#${claim.user_id}`}
                </TableCell>
                <TableCell>
                  <Badge variant='outline'>
                    {t(claimTypeLabelKey(claim.type))}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant='secondary'>
                    {t(claimStatusLabelKey(claim.status))}
                  </Badge>
                </TableCell>
                <TableCell className='max-w-[240px] text-xs'>
                  {claim.receiver_address ? (
                    <div className='text-muted-foreground space-y-0.5'>
                      <p className='text-foreground font-medium'>
                        {claim.receiver_name} · {claim.receiver_phone}
                      </p>
                      <p className='truncate'>{claim.receiver_address}</p>
                      {claim.tracking_no !== '' && (
                        <p className='font-mono'>{claim.tracking_no}</p>
                      )}
                    </div>
                  ) : (
                    <span className='text-muted-foreground'>—</span>
                  )}
                </TableCell>
                <TableCell className='text-muted-foreground text-xs'>
                  {formatTimestamp(claim.created_at)}
                </TableCell>
                <TableCell>{renderActions(claim)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative w-full max-w-xs'>
          <Search
            aria-hidden='true'
            className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2'
          />
          <Input
            value={props.filter.keyword}
            placeholder={t('Search by name, code or user')}
            aria-label={t('Search by name, code or user')}
            className='pl-9'
            onChange={(event) =>
              props.onFilterChange({ keyword: event.target.value, page: 1 })
            }
          />
        </div>
        <NativeSelect
          aria-label={t('Prize type')}
          className='w-40'
          value={props.filter.type}
          onChange={(event) =>
            props.onFilterChange({ type: event.target.value, page: 1 })
          }
        >
          <NativeSelectOption value=''>{t('All types')}</NativeSelectOption>
          {CLAIM_TYPE_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {t(option.labelKey)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t('Status')}
          className='w-48'
          value={props.filter.status}
          onChange={(event) =>
            props.onFilterChange({ status: event.target.value, page: 1 })
          }
        >
          {STATUS_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {t(option.labelKey)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {renderBody()}

      {props.error != null && (
        <p role='alert' className='text-destructive text-sm'>
          {props.error}
        </p>
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
