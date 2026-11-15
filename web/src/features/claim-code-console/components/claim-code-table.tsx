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
import { KeyRound, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
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
import { formatNumber, formatTimestamp } from '@/lib/format'

import { CLAIM_TYPE_OPTIONS, claimCodeStatusLabelKey } from '../lib/claim-codes'
import type { ClaimCodeListFilter, ClaimCodeRow } from '../types'

interface ClaimCodeTableProps {
  codes: ClaimCodeRow[]
  total: number
  loading: boolean
  error: string | null
  filter: ClaimCodeListFilter
  onFilterChange: (patch: Partial<ClaimCodeListFilter>) => void
  onCreate: () => void
  onEdit: (code: ClaimCodeRow) => void
  onCards: (code: ClaimCodeRow) => void
  onDelete: (code: ClaimCodeRow) => void
}

/** 口令列表：支持按名称、类型与状态筛选。 */
export function ClaimCodeTable(props: ClaimCodeTableProps) {
  const { t } = useTranslation()
  const totalPages = Math.max(
    Math.ceil(props.total / Math.max(props.filter.pageSize, 1)),
    1
  )

  const renderUsage = (code: ClaimCodeRow) => {
    if (code.total_count === 0) {
      return t('{{used}} claimed · unlimited', {
        used: formatNumber(code.used_count),
      })
    }
    return t('{{used}} / {{total}} claimed', {
      used: formatNumber(code.used_count),
      total: formatNumber(code.total_count),
    })
  }

  const renderBody = () => {
    if (props.loading && props.codes.length === 0) {
      return <LoadingState />
    }
    if (props.codes.length === 0) {
      return (
        <EmptyState
          icon={KeyRound}
          title={t('No claim codes yet')}
          description={t(
            'Create a claim code so that users can redeem balance, subscriptions, card keys or physical prizes.'
          )}
          action={
            <Button onClick={props.onCreate}>
              <Plus aria-hidden='true' className='size-4' />
              {t('New claim code')}
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
              <TableHead>{t('Claim code')}</TableHead>
              <TableHead>{t('Prize type')}</TableHead>
              <TableHead>{t('Claims')}</TableHead>
              <TableHead>{t('Claimed users')}</TableHead>
              <TableHead>{t('Card key stock')}</TableHead>
              <TableHead>{t('Valid until')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.codes.map((code) => (
              <TableRow key={code.id}>
                <TableCell>
                  <div className='flex items-center gap-2'>
                    <div className='min-w-0'>
                      <p className='truncate font-medium'>{code.name}</p>
                      <p className='text-muted-foreground font-mono text-xs'>
                        {code.code}
                      </p>
                    </div>
                    <CopyButton
                      value={code.code}
                      tooltip={t('Copy to clipboard')}
                      aria-label={t('Copy to clipboard')}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant='outline'>
                    {t(
                      CLAIM_TYPE_OPTIONS.find(
                        (option) => option.value === code.type
                      )?.labelKey ?? code.type
                    )}
                  </Badge>
                </TableCell>
                <TableCell className='text-sm'>{renderUsage(code)}</TableCell>
                <TableCell>{formatNumber(code.claimed_users)}</TableCell>
                <TableCell>
                  {code.type === 'card_key'
                    ? formatNumber(code.available_cards)
                    : '—'}
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {code.expired_time > 0
                    ? formatTimestamp(code.expired_time)
                    : t('Never expires')}
                </TableCell>
                <TableCell>
                  <div className='flex flex-wrap items-center gap-1'>
                    <Badge
                      variant={code.status === 1 ? 'secondary' : 'outline'}
                    >
                      {t(claimCodeStatusLabelKey(code.status))}
                    </Badge>
                    {code.expired && (
                      <Badge variant='outline'>{t('Expired')}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex justify-end gap-1'>
                    {code.type === 'card_key' && (
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => props.onCards(code)}
                      >
                        <KeyRound aria-hidden='true' className='size-4' />
                        {t('Card keys')}
                      </Button>
                    )}
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => props.onEdit(code)}
                    >
                      <Pencil aria-hidden='true' className='size-4' />
                      {t('Edit')}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => props.onDelete(code)}
                    >
                      <Trash2 aria-hidden='true' className='size-4' />
                      {t('Delete')}
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
        <div className='flex flex-wrap items-center gap-2'>
          <div className='relative w-full max-w-xs'>
            <Search
              aria-hidden='true'
              className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2'
            />
            <Input
              value={props.filter.keyword}
              placeholder={t('Search by name or code')}
              aria-label={t('Search by name or code')}
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
            className='w-32'
            value={String(props.filter.status)}
            onChange={(event) =>
              props.onFilterChange({
                status: Number(event.target.value),
                page: 1,
              })
            }
          >
            <NativeSelectOption value='0'>
              {t('All statuses')}
            </NativeSelectOption>
            <NativeSelectOption value='1'>{t('Enabled')}</NativeSelectOption>
            <NativeSelectOption value='2'>{t('Disabled')}</NativeSelectOption>
          </NativeSelect>
        </div>
        <Button size='sm' onClick={props.onCreate}>
          <Plus aria-hidden='true' className='size-4' />
          {t('New claim code')}
        </Button>
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
