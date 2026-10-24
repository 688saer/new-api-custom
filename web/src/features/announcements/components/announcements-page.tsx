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
import { CheckCheck, Megaphone, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useStatus } from '@/hooks/use-status'
import { useNotificationStore } from '@/stores/notification-store'

import {
  countUnread,
  filterAnnouncements,
  getAnnouncementReadKey,
  sortAnnouncements,
} from '../lib/announcements'
import {
  ANNOUNCEMENT_TYPES,
  toAnnouncementType,
  type AnnouncementItem,
  type AnnouncementType,
} from '../types'
import { AnnouncementDetailDialog } from './announcement-detail-dialog'
import { AnnouncementListItem } from './announcement-list-item'

type TypeFilter = AnnouncementType | 'all'

const TYPE_LABEL_KEYS: Record<AnnouncementType, string> = {
  default: 'Default',
  ongoing: 'Ongoing',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
}

function AnnouncementSkeletons() {
  return (
    <div className='overflow-hidden rounded-lg border'>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className='space-y-2 border-b p-4 last:border-b-0 sm:px-5'
        >
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-4 w-full max-w-xl' />
          <Skeleton className='h-4 w-40' />
        </div>
      ))}
    </div>
  )
}

/**
 * All published announcements, newest first.
 *
 * The dashboard panel only shows a preview line and the notification popover
 * caps its list, so neither is a place to read a long maintenance notice. This
 * page is: it prints each body in full and keeps the read state in sync with the
 * notification centre.
 */
export function AnnouncementsPage() {
  const { t } = useTranslation()
  const { status, loading } = useStatus()

  const [query, setQuery] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [selected, setSelected] = useState<AnnouncementItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const readKeys = useNotificationStore((state) => state.readAnnouncementKeys)
  const markAnnouncementsRead = useNotificationStore(
    (state) => state.markAnnouncementsRead
  )

  // A disabled panel hides the data entirely, so the page has nothing to show.
  const enabled = status?.announcements_enabled !== false
  const all = useMemo(() => {
    if (!enabled) return []
    const raw = (status?.announcements ?? []) as AnnouncementItem[]
    return sortAnnouncements(raw)
  }, [enabled, status?.announcements])

  const readKeySet = useMemo(() => new Set(readKeys), [readKeys])
  const unreadCount = useMemo(
    () => countUnread(all, (key) => readKeySet.has(key)),
    [all, readKeySet]
  )

  const visible = useMemo(
    () => filterAnnouncements(all, { query, type }),
    [all, query, type]
  )

  const filtered = visible.length !== all.length

  const handleOpen = (announcement: AnnouncementItem) => {
    setSelected(announcement)
    setDialogOpen(true)
    // Opening counts as reading, so the bell stops advertising it.
    markAnnouncementsRead([getAnnouncementReadKey(announcement)])
  }

  const handleMarkAllRead = () => {
    markAnnouncementsRead(all.map(getAnnouncementReadKey))
  }

  const typeItems = [
    { value: 'all', label: t('All Types') },
    ...ANNOUNCEMENT_TYPES.map((value) => ({
      value,
      label: t(TYPE_LABEL_KEYS[toAnnouncementType(value)]),
    })),
  ]

  const renderBody = () => {
    if (!enabled) {
      return (
        <EmptyState
          bordered
          icon={Megaphone}
          title={t('Announcements are turned off')}
          description={t(
            'The site operator has disabled the announcements panel.'
          )}
        />
      )
    }
    if (loading && all.length === 0) return <AnnouncementSkeletons />
    if (all.length === 0) {
      return (
        <EmptyState
          bordered
          icon={Megaphone}
          title={t('No announcements at this time')}
          description={t(
            'New notices from the site operator will appear here.'
          )}
        />
      )
    }
    if (visible.length === 0) {
      return (
        <EmptyState
          bordered
          icon={Search}
          title={t('No announcements match your filters')}
          description={t('Try a different keyword or severity.')}
          action={
            <Button
              variant='outline'
              size='sm'
              onClick={() => {
                setQuery('')
                setType('all')
              }}
            >
              {t('Clear filters')}
            </Button>
          }
        />
      )
    }
    return (
      <div className='overflow-hidden rounded-lg border'>
        {visible.map((item, index) => (
          <div
            key={item.id ?? `${getAnnouncementReadKey(item)}`}
            className={index < visible.length - 1 ? 'border-b' : undefined}
          >
            <AnnouncementListItem
              announcement={item}
              unread={!readKeySet.has(getAnnouncementReadKey(item))}
              onOpen={handleOpen}
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <SectionPageLayout stackActionsOnMobile>
        <SectionPageLayout.Title>{t('Announcements')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          {enabled && unreadCount > 0 && (
            <Badge variant='secondary' data-testid='announcements-unread-count'>
              {t('{{count}} unread', { count: unreadCount })}
            </Badge>
          )}
          {enabled && (
            <Button
              variant='outline'
              size='sm'
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck aria-hidden='true' />
              {t('Mark all as read')}
            </Button>
          )}
        </SectionPageLayout.Actions>

        <SectionPageLayout.Content>
          <div className='flex flex-col gap-3'>
            {enabled && (
              <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                <InputGroup className='sm:max-w-xs'>
                  <InputGroupAddon>
                    <Search aria-hidden='true' />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('Search announcements')}
                    aria-label={t('Search announcements')}
                  />
                </InputGroup>

                <Select
                  items={typeItems}
                  value={type}
                  onValueChange={(value) => setType(value as TypeFilter)}
                >
                  <SelectTrigger
                    className='sm:w-44'
                    aria-label={t('Severity')}
                    data-testid='announcements-type-filter'
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {typeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {filtered && (
                  <p
                    className='text-muted-foreground text-xs'
                    data-testid='announcements-filter-summary'
                  >
                    {t('Showing {{shown}} of {{total}}', {
                      shown: visible.length,
                      total: all.length,
                    })}
                  </p>
                )}
              </div>
            )}

            {renderBody()}
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <AnnouncementDetailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        announcement={selected}
      />
    </>
  )
}
