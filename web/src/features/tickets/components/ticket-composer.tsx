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
import { ImagePlus, Send } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import { PendingAttachmentList } from './ticket-attachments'

export type PendingImage = {
  key: string
  name: string
  preview: string
  file: File
}

type TicketComposerProps = {
  placeholder: string
  submitting: boolean
  allowAttachments: boolean
  attachments: PendingImage[]
  onAttachmentsChange: (next: PendingImage[]) => void
  onSubmit: (content: string) => void
  disabled?: boolean
  disabledHint?: string
}

/** 工单输入框：Enter 发送、Shift+Enter 换行，可选附图。 */
export function TicketComposer(props: TicketComposerProps) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const trimmed = content.trim()
  const canSubmit = !props.disabled && !props.submitting && trimmed.length > 0

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const accepted: PendingImage[] = []
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > 2 * 1024 * 1024) continue
      accepted.push({
        key: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        preview: URL.createObjectURL(file),
        file,
      })
    }
    if (accepted.length > 0) {
      props.onAttachmentsChange([...props.attachments, ...accepted])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleRemove(key: string) {
    const target = props.attachments.find((item) => item.key === key)
    if (target) URL.revokeObjectURL(target.preview)
    props.onAttachmentsChange(
      props.attachments.filter((item) => item.key !== key)
    )
  }

  function handleSubmit() {
    if (!canSubmit) return
    props.onSubmit(trimmed)
    setContent('')
  }

  if (props.disabled) {
    return (
      <p className='text-muted-foreground border-t px-4 py-4 text-center text-sm'>
        {props.disabledHint ?? t('This ticket is closed')}
      </p>
    )
  }

  return (
    <div className='space-y-2 border-t p-3 sm:p-4'>
      {props.attachments.length > 0 && (
        <PendingAttachmentList
          items={props.attachments}
          onRemove={handleRemove}
        />
      )}
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            handleSubmit()
          }
        }}
        placeholder={props.placeholder}
        rows={3}
        maxLength={5000}
        aria-label={props.placeholder}
      />
      <div className='flex items-center justify-between gap-2'>
        <div className='text-muted-foreground flex items-center gap-2 text-xs'>
          {props.allowAttachments && (
            <>
              <input
                ref={fileInputRef}
                type='file'
                accept='image/png,image/jpeg,image/gif,image/webp'
                multiple
                className='hidden'
                onChange={(event) => handleFiles(event.target.files)}
              />
              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className='size-4' aria-hidden='true' />
                {t('Add image')}
              </Button>
              <span className='hidden sm:inline'>
                {t('PNG, JPG, GIF or WebP, up to 2 MB each')}
              </span>
            </>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground hidden text-xs sm:inline'>
            {t('Enter to send, Shift + Enter for a new line')}
          </span>
          <Button
            type='button'
            size='sm'
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            <Send className='size-4' aria-hidden='true' />
            {props.submitting ? t('Sending…') : t('Send')}
          </Button>
        </div>
      </div>
    </div>
  )
}
