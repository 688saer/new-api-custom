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
import { ImageOff, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import {
  useTicketImage,
  type TicketImageLoader,
} from '../hooks/use-ticket-image'
import type { TicketAttachment } from '../types'

type TicketAttachmentImageProps = {
  attachment: TicketAttachment
  loadImage: TicketImageLoader
}

function TicketAttachmentImage(props: TicketAttachmentImageProps) {
  const { t } = useTranslation()
  const url = useTicketImage(props.attachment.id, props.loadImage)

  if (!url) {
    return (
      <div className='bg-muted text-muted-foreground flex h-20 w-28 items-center justify-center rounded-md border'>
        <ImageOff className='size-5' aria-hidden='true' />
        <span className='sr-only'>{t('Image unavailable')}</span>
      </div>
    )
  }

  return (
    <a
      href={url}
      target='_blank'
      rel='noreferrer noopener'
      className='block overflow-hidden rounded-md border'
    >
      <img
        src={url}
        alt={props.attachment.file_name || t('Ticket image')}
        className='h-20 w-28 object-cover transition-opacity hover:opacity-90'
        loading='lazy'
      />
    </a>
  )
}

type TicketAttachmentListProps = {
  attachments: TicketAttachment[]
  /** 两侧令牌不同，读图接口也不同，所以由调用方决定怎么取 */
  loadImage: TicketImageLoader
}

export function TicketAttachmentList(props: TicketAttachmentListProps) {
  if (props.attachments.length === 0) return null

  return (
    <div className='mt-2 flex flex-wrap gap-2'>
      {props.attachments.map((attachment) => (
        <TicketAttachmentImage
          key={attachment.id}
          attachment={attachment}
          loadImage={props.loadImage}
        />
      ))}
    </div>
  )
}

type PendingAttachmentListProps = {
  items: { key: string; name: string; preview: string }[]
  onRemove: (key: string) => void
}

/** 发送前的本地预览，图片还没上传到服务端。 */
export function PendingAttachmentList(props: PendingAttachmentListProps) {
  const { t } = useTranslation()

  if (props.items.length === 0) return null

  return (
    <ul className='flex flex-wrap gap-2'>
      {props.items.map((item) => (
        <li key={item.key} className='relative'>
          <img
            src={item.preview}
            alt={item.name}
            className='h-16 w-24 rounded-md border object-cover'
          />
          <Button
            type='button'
            variant='destructive'
            size='icon'
            className='absolute -top-1.5 -right-1.5 size-5 rounded-full'
            onClick={() => props.onRemove(item.key)}
            aria-label={t('Remove image')}
          >
            <X className='size-3' aria-hidden='true' />
          </Button>
        </li>
      ))}
    </ul>
  )
}
