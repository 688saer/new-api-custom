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
import { Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

import {
  addWheelPrizeCodes,
  deleteWheelPrizeCode,
  listWheelPrizeCodes,
} from '../api'
import type { WheelAdminPrize, WheelPrizeCode } from '../types'

const PAGE_SIZE = 20

const CODE_STATUS_OPTIONS = [
  { value: 'available', labelKey: 'Available' },
  { value: 'used', labelKey: 'Used' },
]

interface CardKeyDialogProps {
  open: boolean
  prize: WheelAdminPrize | null
  onOpenChange: (open: boolean) => void
  /** 卡密池变化后通知父级刷新奖品库存。 */
  onChanged: () => void
}

/** 卡密奖品的卡密池管理。 */
export function CardKeyDialog(props: CardKeyDialogProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState('available')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<WheelPrizeCode[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<WheelPrizeCode | null>(null)
  const [deletingLoading, setDeletingLoading] = useState(false)

  const prizeId = props.prize?.id ?? 0

  const load = useCallback(
    async (nextPage: number, nextStatus: string) => {
      if (prizeId <= 0) return
      setLoading(true)
      setError(null)
      try {
        const res = await listWheelPrizeCodes(
          prizeId,
          nextStatus,
          nextPage,
          PAGE_SIZE
        )
        if (!res.success || !res.data) {
          setError(res.reason || res.message || t('Failed to load card keys'))
          return
        }
        setItems(res.data.items)
        setTotal(res.data.total)
        setPage(nextPage)
      } catch {
        setError(t('Failed to load card keys'))
      } finally {
        setLoading(false)
      }
    },
    [prizeId, t]
  )

  useEffect(() => {
    if (!props.open) return
    setDraft('')
    setStatus('available')
    void load(1, 'available')
  }, [props.open, load])

  const handleAdd = async () => {
    if (draft.trim() === '' || prizeId <= 0) return
    setAdding(true)
    try {
      const res = await addWheelPrizeCodes(prizeId, draft)
      if (!res.success || !res.data) {
        toast.error(
          res.reason || res.message || t('Failed to import card keys')
        )
        return
      }
      toast.success(
        t('Imported {{count}} card keys', { count: res.data.added })
      )
      setDraft('')
      props.onChanged()
      void load(1, status)
    } catch {
      toast.error(t('Failed to import card keys'))
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeletingLoading(true)
    try {
      const res = await deleteWheelPrizeCode(prizeId, deleting.id)
      if (!res.success) {
        toast.error(res.reason || res.message || t('Delete failed'))
        return
      }
      toast.success(t('Deleted'))
      setDeleting(null)
      props.onChanged()
      void load(page, status)
    } catch {
      toast.error(t('Delete failed'))
    } finally {
      setDeletingLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={t('Card key pool · {{name}}', {
          name: props.prize?.name ?? '',
        })}
        description={t(
          'Each draw consumes one card key. The winner sees the code right away.'
        )}
        contentClassName='sm:max-w-xl'
        contentHeight='auto'
      >
        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='wheel-code-input'>
              {t('Paste card keys, one per line')}
            </Label>
            <Textarea
              id='wheel-code-input'
              value={draft}
              rows={4}
              placeholder={'KEY-0001\nKEY-0002'}
              className='font-mono text-xs'
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className='flex items-center justify-between gap-2'>
              <p className='text-muted-foreground text-xs'>
                {t('Duplicated codes are ignored automatically.')}
              </p>
              <Button
                size='sm'
                disabled={adding || draft.trim() === ''}
                onClick={() => void handleAdd()}
              >
                {adding ? t('Importing…') : t('Import card keys')}
              </Button>
            </div>
          </div>

          <div className='flex items-center justify-between gap-2'>
            <NativeSelect
              aria-label={t('Status')}
              className='w-36'
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                void load(1, event.target.value)
              }}
            >
              {CODE_STATUS_OPTIONS.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className='text-muted-foreground text-xs' aria-live='polite'>
              {t('{{count}} card keys', { count: total })}
            </p>
          </div>

          {error != null ? (
            <p role='alert' className='text-destructive text-sm'>
              {error}
            </p>
          ) : null}

          {items.length === 0 && !loading ? (
            <EmptyState title={t('No card key in this pool')} />
          ) : (
            <ul className='divide-border max-h-64 divide-y overflow-y-auto'>
              {items.map((item) => (
                <li
                  key={item.id}
                  className='flex items-center justify-between gap-2 py-2'
                >
                  <code className='truncate font-mono text-xs'>
                    {item.code}
                  </code>
                  <div className='flex shrink-0 items-center gap-1'>
                    <Badge
                      variant={item.status === 'used' ? 'outline' : 'secondary'}
                    >
                      {item.status === 'used' ? t('Used') : t('Available')}
                    </Badge>
                    <CopyButton
                      value={item.code}
                      tooltip={t('Copy code')}
                      successTooltip={t('Copied')}
                    />
                    {item.status === 'available' ? (
                      <Button
                        variant='ghost'
                        size='icon-sm'
                        aria-label={t('Delete')}
                        onClick={() => setDeleting(item)}
                      >
                        <Trash2
                          aria-hidden='true'
                          className='text-destructive size-3.5'
                        />
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {total > PAGE_SIZE ? (
            <div className='flex items-center justify-between'>
              <p className='text-muted-foreground text-xs'>
                {t('Page {{page}} of {{total}}', {
                  page,
                  total: totalPages,
                })}
              </p>
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page <= 1}
                  onClick={() => void load(page - 1, status)}
                >
                  {t('Previous')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= totalPages}
                  onClick={() => void load(page + 1, status)}
                >
                  {t('Next')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={t('Delete card key')}
        desc={t(
          'This card key will be removed from the pool. This cannot be undone.'
        )}
        confirmText={t('Delete')}
        destructive
        isLoading={deletingLoading}
        handleConfirm={() => void handleDelete()}
      />
    </>
  )
}
