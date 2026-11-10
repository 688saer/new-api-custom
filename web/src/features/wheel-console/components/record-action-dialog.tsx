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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { WheelWin } from '@/features/lucky-wheel'

import type { WheelRecordAction } from './record-table'

interface RecordActionDialogProps {
  action: WheelRecordAction | null
  win: WheelWin | null
  submitting: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: {
    tracking_no?: string
    note?: string
    code?: string
  }) => void
}

const TITLE_KEYS: Record<WheelRecordAction, string> = {
  ship: 'Ship prize',
  deliver: 'Mark as delivered',
  cancel: 'Cancel this record',
}

/** 中奖记录的发货、发放与作废操作弹窗。 */
export function RecordActionDialog(props: RecordActionDialogProps) {
  const { t } = useTranslation()
  const [trackingNo, setTrackingNo] = useState('')
  const [note, setNote] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => {
    setTrackingNo('')
    setNote('')
    setCode('')
  }, [props.action, props.win?.id])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    props.onSubmit({
      tracking_no: trackingNo.trim(),
      note: note.trim(),
      code: code.trim(),
    })
  }

  const action = props.action
  let submitLabel = t('Submit')
  if (action) {
    submitLabel = t(TITLE_KEYS[action])
  }
  if (props.submitting) {
    submitLabel = t('Submitting…')
  }

  return (
    <Dialog
      open={action != null}
      onOpenChange={props.onOpenChange}
      title={action ? t(TITLE_KEYS[action]) : ''}
      description={
        props.win
          ? t('{{prize}} won by {{user}}', {
              prize: props.win.prize_name,
              user: props.win.username || `#${props.win.user_id}`,
            })
          : undefined
      }
      contentClassName='sm:max-w-md'
      contentHeight='auto'
    >
      <form className='space-y-3' onSubmit={handleSubmit}>
        {props.win?.has_address ? (
          <div className='bg-muted/60 rounded-lg px-3 py-2 text-xs'>
            <p className='font-medium'>{props.win.receiver_name}</p>
            <p className='text-muted-foreground'>{props.win.receiver_phone}</p>
            <p className='text-muted-foreground'>
              {props.win.receiver_address}
            </p>
          </div>
        ) : null}

        {action === 'ship' ? (
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-tracking-no'>{t('Tracking number')}</Label>
            <Input
              id='wheel-tracking-no'
              value={trackingNo}
              maxLength={64}
              onChange={(event) => setTrackingNo(event.target.value)}
            />
          </div>
        ) : null}

        {action === 'deliver' ? (
          <div className='grid gap-1.5'>
            <Label htmlFor='wheel-deliver-code'>{t('Code to deliver')}</Label>
            <Input
              id='wheel-deliver-code'
              value={code}
              maxLength={128}
              placeholder={t('Leave empty to keep the issued code')}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
        ) : null}

        <div className='grid gap-1.5'>
          <Label htmlFor='wheel-record-note'>{t('Note')}</Label>
          <Textarea
            id='wheel-record-note'
            value={note}
            rows={2}
            maxLength={255}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        {props.error != null && (
          <p role='alert' className='text-destructive text-sm'>
            {props.error}
          </p>
        )}

        <Button
          type='submit'
          className='w-full'
          variant={action === 'cancel' ? 'destructive' : 'default'}
          disabled={props.submitting}
        >
          {submitLabel}
        </Button>
      </form>
    </Dialog>
  )
}
