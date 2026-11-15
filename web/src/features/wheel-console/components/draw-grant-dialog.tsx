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

import {
  createEmptyDrawGrantDraft,
  toDrawGrantDraft,
  validateDrawGrantDraft,
  type DrawGrantDraft,
} from '../lib/draw-grants'
import type { WheelDrawGrant } from '../types'

interface DrawGrantDialogProps {
  open: boolean
  /** 编辑已有发放时带上目标用户，新增时为空 */
  grant: WheelDrawGrant | null
  submitting: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (identifier: string, draft: DrawGrantDraft) => void
}

/** 发放用户专属抽奖次数：永久次数与每日免费次数可以只发一种。 */
export function DrawGrantDialog(props: DrawGrantDialogProps) {
  const { t } = useTranslation()
  const [identifier, setIdentifier] = useState('')
  const [draft, setDraft] = useState<DrawGrantDraft>(createEmptyDrawGrantDraft)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!props.open) return
    setLocalError(null)
    if (props.grant) {
      setIdentifier(props.grant.username || String(props.grant.user_id))
      setDraft(toDrawGrantDraft(props.grant))
      return
    }
    setIdentifier('')
    setDraft(createEmptyDrawGrantDraft())
  }, [props.open, props.grant])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = identifier.trim()
    if (trimmed === '') {
      setLocalError(t('Enter a username or user ID'))
      return
    }
    const draftError = validateDrawGrantDraft(draft)
    if (draftError != null) {
      setLocalError(t(draftError))
      return
    }
    setLocalError(null)
    props.onSubmit(trimmed, draft)
  }

  const editing = props.grant != null
  const errorText = props.error ?? localError

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={editing ? t('Adjust draw attempts') : t('Grant draw attempts')}
      description={t(
        'Permanent draws never expire. Daily free draws stack on top of the global free draws and reset every day.'
      )}
      contentClassName='sm:max-w-md'
      contentHeight='auto'
    >
      <form className='space-y-3' onSubmit={handleSubmit}>
        <div className='grid gap-1.5'>
          <Label htmlFor='wheel-grant-user'>{t('User name or ID')}</Label>
          <Input
            id='wheel-grant-user'
            value={identifier}
            readOnly={editing}
            placeholder={t('Enter a username or user ID')}
            onChange={(event) => setIdentifier(event.target.value)}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='wheel-grant-permanent'>{t('Permanent draws')}</Label>
          <Input
            id='wheel-grant-permanent'
            type='number'
            min={0}
            step={1}
            value={draft.permanentDraws}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                permanentDraws: Number(event.target.value) || 0,
              }))
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t('Remaining balance, one draw is deducted per spin.')}
          </p>
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='wheel-grant-daily'>{t('Daily free draws')}</Label>
          <Input
            id='wheel-grant-daily'
            type='number'
            min={0}
            step={1}
            value={draft.dailyFreeDraws}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                dailyFreeDraws: Number(event.target.value) || 0,
              }))
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t('Extra free draws every day on top of the global setting.')}
          </p>
        </div>
        <p className='text-muted-foreground text-xs'>
          {t(
            'Draws are consumed in this order: free draws, granted permanent draws, initial permanent draws, then paid draws. Setting both to 0 removes the grant.'
          )}
        </p>
        {errorText != null && (
          <p role='alert' className='text-destructive text-sm'>
            {errorText}
          </p>
        )}
        <Button type='submit' className='w-full' disabled={props.submitting}>
          {props.submitting ? t('Saving…') : t('Save')}
        </Button>
      </form>
    </Dialog>
  )
}
