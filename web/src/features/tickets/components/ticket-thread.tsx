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
import { useTranslation } from 'react-i18next'

import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { TicketImageLoader } from '../hooks/use-ticket-image'
import type { TicketMessage } from '../types'
import { TicketAttachmentList } from './ticket-attachments'

type TicketThreadProps = {
  messages: TicketMessage[]
  /** 客服统一展示名，用于左侧气泡署名 */
  agentName: string
  /** 站点用户侧展示自己的气泡在右侧 */
  selfSide: 'user' | 'agent'
  /** 读图方式，用户侧与后台侧令牌不同 */
  loadImage: TicketImageLoader
}

/** 工单会话流：自己一侧靠右、客服靠左、系统消息居中。 */
export function TicketThread(props: TicketThreadProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  return (
    <ol className='space-y-4' aria-label={t('Conversation')}>
      {props.messages.map((message) => {
        const isSystem = message.author_type === 'system'
        if (isSystem) {
          return (
            <li key={message.id} className='flex justify-center'>
              <div className='bg-muted text-muted-foreground max-w-[85%] rounded-md px-3 py-2 text-xs'>
                <span className='font-medium'>{props.agentName}</span>
                <span className='mx-1'>·</span>
                <span>{t('Automatic reply')}</span>
                <p className='mt-1 whitespace-pre-wrap'>{message.content}</p>
              </div>
            </li>
          )
        }

        const isSelf = message.author_type === props.selfSide
        return (
          <li
            key={message.id}
            className={cn('flex', isSelf ? 'justify-end' : 'justify-start')}
          >
            <div className='max-w-[85%] min-w-0'>
              <div
                className={cn(
                  'mb-1 flex items-center gap-2 text-xs',
                  isSelf ? 'justify-end' : 'justify-start'
                )}
              >
                <span className='font-medium'>
                  {isSelf ? t('You') : message.author_name || props.agentName}
                </span>
                <time
                  className='text-muted-foreground'
                  dateTime={new Date(message.created_at * 1000).toISOString()}
                  title={new Date(message.created_at * 1000).toLocaleString(
                    locale
                  )}
                >
                  {formatTimestampRelative(
                    message.created_at,
                    'seconds',
                    locale
                  )}
                </time>
              </div>
              <div
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm',
                  isSelf
                    ? 'bg-primary text-primary-foreground border-transparent'
                    : 'bg-muted/60'
                )}
              >
                <p className='break-words whitespace-pre-wrap'>
                  {message.content}
                </p>
                <TicketAttachmentList
                  attachments={message.attachments}
                  loadImage={props.loadImage}
                />
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
