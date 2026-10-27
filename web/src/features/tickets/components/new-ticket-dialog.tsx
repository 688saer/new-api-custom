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
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { ticketCategoryLabelKey } from '../lib/tickets'
import { TICKET_CATEGORIES, type TicketCategory } from '../types'
import { PendingAttachmentList } from './ticket-attachments'
import type { PendingImage } from './ticket-composer'

type NewTicketDialogProps = {
  open: boolean
  submitting: boolean
  allowAttachments: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: {
    title: string
    category: TicketCategory
    content: string
    images: PendingImage[]
  }) => void
}

/** 新建工单弹窗：标题、分类、描述与可选图片。 */
export function NewTicketDialog(props: NewTicketDialogProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<TicketCategory>('api')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<PendingImage[]>([])

  useEffect(() => {
    if (props.open) return
    setTitle('')
    setCategory('api')
    setContent('')
    setImages((previous) => {
      for (const image of previous) URL.revokeObjectURL(image.preview)
      return []
    })
  }, [props.open])

  const canSubmit =
    !props.submitting && title.trim().length > 0 && content.trim().length > 0

  // Base UI 的 Select 需要 items 才能把值渲染成标签
  const categoryItems = TICKET_CATEGORIES.map((item) => ({
    value: item as string,
    label: t(ticketCategoryLabelKey(item)),
  }))

  function handleFiles(files: FileList | null) {
    if (!files) return
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
    if (accepted.length > 0) setImages((previous) => [...previous, ...accepted])
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('New ticket')}</DialogTitle>
          <DialogDescription>
            {t(
              'Describe the problem and how we can help. Model name, request time, task ID or error messages all speed things up.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='ticket-title'>{t('Title')}</Label>
            <Input
              id='ticket-title'
              value={title}
              maxLength={200}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('For example: video task failed without a refund')}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='ticket-category'>{t('Category')}</Label>
            <Select
              items={categoryItems}
              value={category}
              onValueChange={(value) => setCategory(value as TicketCategory)}
            >
              <SelectTrigger id='ticket-category' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='ticket-content'>{t('Description')}</Label>
            <Textarea
              id='ticket-content'
              value={content}
              rows={5}
              maxLength={5000}
              onChange={(event) => setContent(event.target.value)}
              placeholder={t(
                'What happened, and what did you expect? Include the model, time and any error text.'
              )}
            />
          </div>

          {props.allowAttachments && (
            <div className='space-y-2'>
              <Label htmlFor='ticket-images'>{t('Images (optional)')}</Label>
              <Input
                id='ticket-images'
                type='file'
                accept='image/png,image/jpeg,image/gif,image/webp'
                multiple
                onChange={(event) => handleFiles(event.target.files)}
              />
              <PendingAttachmentList
                items={images}
                onRemove={(key) => {
                  const target = images.find((item) => item.key === key)
                  if (target) URL.revokeObjectURL(target.preview)
                  setImages((previous) =>
                    previous.filter((item) => item.key !== key)
                  )
                }}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={props.submitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            disabled={!canSubmit}
            onClick={() =>
              props.onSubmit({
                title: title.trim(),
                category,
                content: content.trim(),
                images,
              })
            }
          >
            {props.submitting && (
              <Loader2 className='size-4 animate-spin' aria-hidden='true' />
            )}
            {props.submitting ? t('Submitting…') : t('Submit ticket')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
