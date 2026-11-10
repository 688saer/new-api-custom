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
import { KeyRound, Pencil, Plus, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatQuota } from '@/lib/format'

import { PRIZE_TYPE_OPTIONS, stockLabel } from '../lib/prizes'
import type { WheelAdminPrize } from '../types'

interface PrizeTableProps {
  prizes: WheelAdminPrize[]
  loading: boolean
  onCreate: () => void
  onEdit: (prize: WheelAdminPrize) => void
  onDelete: (prize: WheelAdminPrize) => void
  onAdjustStock: (prize: WheelAdminPrize) => void
  onManageCodes: (prize: WheelAdminPrize) => void
  onToggleEnabled: (prize: WheelAdminPrize, enabled: boolean) => void
}

/** 奖品配置列表。 */
export function PrizeTable(props: PrizeTableProps) {
  const { t } = useTranslation()

  if (props.loading && props.prizes.length === 0) {
    return <LoadingState />
  }

  if (props.prizes.length === 0) {
    return (
      <EmptyState
        title={t('No prize configured yet')}
        description={t('Add at least two prizes to start the wheel.')}
        action={
          <Button onClick={props.onCreate}>
            <Plus aria-hidden='true' className='size-4' />
            {t('New prize')}
          </Button>
        }
      />
    )
  }

  return (
    <div className='space-y-3'>
      <div className='flex justify-end'>
        <Button size='sm' onClick={props.onCreate}>
          <Plus aria-hidden='true' className='size-4' />
          {t('New prize')}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Prize')}</TableHead>
            <TableHead className='hidden sm:table-cell'>
              {t('Claim method')}
            </TableHead>
            <TableHead className='text-right'>{t('Weight')}</TableHead>
            <TableHead className='text-right'>{t('Stock')}</TableHead>
            <TableHead className='text-right'>{t('Issued')}</TableHead>
            <TableHead>{t('Enabled')}</TableHead>
            <TableHead className='text-right'>{t('Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.prizes.map((prize) => {
            const typeLabel =
              PRIZE_TYPE_OPTIONS.find((option) => option.value === prize.type)
                ?.labelKey ?? 'Account credit'
            return (
              <TableRow key={prize.id}>
                <TableCell>
                  <span className='flex items-center gap-2 font-medium'>
                    <span aria-hidden='true'>{prize.icon || '🎁'}</span>
                    <span className='truncate'>{prize.name}</span>
                    {prize.label ? (
                      <Badge variant='warning'>{prize.label}</Badge>
                    ) : null}
                  </span>
                  {prize.quota_value > 0 &&
                  (prize.type === 'quota' ||
                    prize.type === 'redemption_code') ? (
                    <span className='text-muted-foreground mt-1 block text-xs'>
                      {formatQuota(prize.quota_value)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className='text-muted-foreground hidden text-xs sm:table-cell'>
                  {t(typeLabel)}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {prize.weight}
                </TableCell>
                <TableCell className='text-right tabular-nums'>
                  {t(stockLabel(prize.stock))}
                </TableCell>
                <TableCell className='text-muted-foreground text-right tabular-nums'>
                  {prize.issued_count}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={prize.enabled}
                    aria-label={t('Enabled')}
                    onCheckedChange={(checked) =>
                      props.onToggleEnabled(prize, !!checked)
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className='flex items-center justify-end gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      aria-label={t('Edit prize')}
                      onClick={() => props.onEdit(prize)}
                    >
                      <Pencil aria-hidden='true' className='size-4' />
                    </Button>
                    {prize.type === 'card_key' ? (
                      <Button
                        variant='ghost'
                        size='icon'
                        aria-label={t('Card key pool')}
                        onClick={() => props.onManageCodes(prize)}
                      >
                        <KeyRound aria-hidden='true' className='size-4' />
                      </Button>
                    ) : (
                      <Button
                        variant='ghost'
                        size='icon'
                        aria-label={t('Adjust stock')}
                        onClick={() => props.onAdjustStock(prize)}
                      >
                        <SlidersHorizontal
                          aria-hidden='true'
                          className='size-4'
                        />
                      </Button>
                    )}
                    <Button
                      variant='ghost'
                      size='icon'
                      aria-label={t('Delete prize')}
                      onClick={() => props.onDelete(prize)}
                    >
                      <Trash2
                        aria-hidden='true'
                        className='text-destructive size-4'
                      />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
