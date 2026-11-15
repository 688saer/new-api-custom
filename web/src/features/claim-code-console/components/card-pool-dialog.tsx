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

import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatTimestamp } from '@/lib/format'

import {
  addClaimCodeCards,
  deleteClaimCodeCard,
  listClaimCodeCards,
} from '../api'
import type { ClaimCodeCard, ClaimCodeCardStatus, ClaimCodeRow } from '../types'

const CARD_PAGE_SIZE = 20

interface CardPoolDialogProps {
  /** 管理卡密池的口令，null 表示关闭。 */
  code: ClaimCodeRow | null
  onOpenChange: (open: boolean) => void
  /** 卡密数量变化后通知页面刷新统计。 */
  onChanged: () => void
}

/** 虚拟产品卡密池：查看、导入与删除未发放的卡密。 */
export function CardPoolDialog(props: CardPoolDialogProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ClaimCodeCardStatus>('available')
  const [page, setPage] = useState(1)
  const [cards, setCards] = useState<ClaimCodeCard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const claimCodeId = props.code?.id ?? 0

  const loadCards = useCallback(async () => {
    if (claimCodeId <= 0) {
      return
    }
    setLoading(true)
    const res = await listClaimCodeCards(
      claimCodeId,
      status,
      page,
      CARD_PAGE_SIZE
    )
    if (res?.success && res.data) {
      setCards(res.data.items ?? [])
      setTotal(res.data.total ?? 0)
      setError(null)
    } else {
      setError(res?.message || t('Failed to load card keys'))
    }
    setLoading(false)
  }, [claimCodeId, page, status, t])

  useEffect(() => {
    void loadCards()
  }, [loadCards])

  const handleAdd = async () => {
    if (input.trim() === '') {
      setError(t('Paste at least one card key'))
      return
    }
    setSubmitting(true)
    setNotice(null)
    const res = await addClaimCodeCards(claimCodeId, input)
    setSubmitting(false)
    if (res?.success && res.data) {
      setInput('')
      setError(null)
      setNotice(t('{{count}} card keys imported', { count: res.data.added }))
      setPage(1)
      await loadCards()
      props.onChanged()
      return
    }
    setError(res?.message || t('Failed to import card keys'))
  }

  const handleDelete = async (card: ClaimCodeCard) => {
    const res = await deleteClaimCodeCard(claimCodeId, card.id)
    if (res?.success) {
      setError(null)
      await loadCards()
      props.onChanged()
      return
    }
    setError(res?.message || t('Failed to delete the card key'))
  }

  const totalPages = Math.max(Math.ceil(total / CARD_PAGE_SIZE), 1)

  const renderCards = () => {
    if (loading && cards.length === 0) {
      return <LoadingState />
    }
    if (cards.length === 0) {
      return (
        <EmptyState
          title={t('No card keys yet')}
          description={t(
            'Import card keys so that redeeming this code can issue one automatically.'
          )}
        />
      )
    }
    return (
      <ul className='divide-y rounded-lg border'>
        {cards.map((card) => (
          <li
            key={card.id}
            className='flex items-center justify-between gap-2 px-3 py-2'
          >
            <code className='min-w-0 flex-1 truncate font-mono text-xs'>
              {card.content}
            </code>
            {card.status === 'used' ? (
              <Badge variant='secondary'>
                {t('Issued at {{time}}', {
                  time: formatTimestamp(card.used_at),
                })}
              </Badge>
            ) : (
              <Button
                variant='ghost'
                size='icon'
                aria-label={t('Delete')}
                onClick={() => void handleDelete(card)}
              >
                <Trash2 aria-hidden='true' className='size-4' />
              </Button>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <Dialog
      open={props.code != null}
      onOpenChange={props.onOpenChange}
      title={t('Card key pool')}
      description={props.code?.name}
      contentClassName='sm:max-w-2xl'
      contentHeight='auto'
    >
      <div className='space-y-4'>
        <div className='grid gap-1.5'>
          <Label htmlFor='claim-code-cards-input'>
            {t('Card keys, one per line')}
          </Label>
          <Textarea
            id='claim-code-cards-input'
            value={input}
            rows={4}
            placeholder={'AAAA-BBBB-CCCC\nDDDD-EEEE-FFFF'}
            onChange={(event) => setInput(event.target.value)}
          />
          <div className='flex items-center justify-between gap-2'>
            <p className='text-muted-foreground text-xs'>
              {t('Duplicated card keys are skipped automatically.')}
            </p>
            <Button
              size='sm'
              disabled={submitting}
              onClick={() => void handleAdd()}
            >
              {submitting ? t('Importing…') : t('Import card keys')}
            </Button>
          </div>
        </div>

        {notice != null && <p className='text-sm text-emerald-600'>{notice}</p>}
        {error != null && (
          <p role='alert' className='text-destructive text-sm'>
            {error}
          </p>
        )}

        <div className='flex items-center justify-between gap-2'>
          <div className='flex gap-2'>
            <Button
              variant={status === 'available' ? 'default' : 'outline'}
              size='sm'
              onClick={() => {
                setStatus('available')
                setPage(1)
              }}
            >
              {t('Available')}
            </Button>
            <Button
              variant={status === 'used' ? 'default' : 'outline'}
              size='sm'
              onClick={() => {
                setStatus('used')
                setPage(1)
              }}
            >
              {t('Issued')}
            </Button>
          </div>
          <p className='text-muted-foreground text-xs'>
            {t('{{count}} in total', { count: total })}
          </p>
        </div>

        {renderCards()}

        {total > CARD_PAGE_SIZE ? (
          <div className='flex items-center justify-between'>
            <p className='text-muted-foreground text-xs'>
              {t('Page {{page}} of {{total}}', { page, total: totalPages })}
            </p>
            <div className='flex gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                {t('Previous')}
              </Button>
              <Button
                variant='outline'
                size='sm'
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('Next')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
