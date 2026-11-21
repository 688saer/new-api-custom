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
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, KeyRound, Search, UserRound } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BadgeCell } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { GroupBadge } from '@/components/group-badge'
import { StatusBadge } from '@/components/status-badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDebounce } from '@/hooks'
import { formatQuota, formatTimestamp } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import { listAdminEnabledApiKeys } from '../api'
import type { AdminEnabledApiKey, AdminEnabledApiKeyUser } from '../types'

const PAGE_SIZE = 10

// Stable placeholders so the loading skeleton keeps the same keys across renders.
const SKELETON_ROWS = ['first', 'second', 'third', 'fourth']

/** Whether a key can still serve requests: enabled, within its expiry, funded. */
function keyIsUsable(key: AdminEnabledApiKey, nowSeconds: number): boolean {
  if (key.expired_time !== -1 && key.expired_time <= nowSeconds) {
    return false
  }
  if (key.unlimited_quota) return true
  return key.remain_quota > 0
}

function KeyQuotaCell(props: { apiKey: AdminEnabledApiKey }) {
  const { t } = useTranslation()
  if (props.apiKey.unlimited_quota) {
    return (
      <span className='text-muted-foreground text-xs'>{t('Unlimited')}</span>
    )
  }
  return (
    <div className='flex flex-col'>
      <span className='text-xs tabular-nums'>
        {formatQuota(props.apiKey.remain_quota)}
      </span>
      <span className='text-muted-foreground text-xs tabular-nums'>
        {t('Used amount')} {formatQuota(props.apiKey.used_quota)}
      </span>
    </div>
  )
}

function KeyExpiryCell(props: { apiKey: AdminEnabledApiKey; now: number }) {
  const { t } = useTranslation()
  if (props.apiKey.expired_time === -1) {
    return (
      <StatusBadge
        label={t('Never')}
        variant='neutral'
        copyable={false}
        className='-ml-1.5'
      />
    )
  }
  const isPast = props.apiKey.expired_time <= props.now
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        isPast ? 'text-destructive' : 'text-muted-foreground'
      )}
    >
      {formatTimestamp(props.apiKey.expired_time)}
    </span>
  )
}

function KeyModelCell(props: { apiKey: AdminEnabledApiKey }) {
  const { t } = useTranslation()
  const models = props.apiKey.model_limits_enabled
    ? (props.apiKey.model_limits || '').split(',').filter(Boolean)
    : []
  if (!models.length) {
    return (
      <span className='text-muted-foreground text-xs'>{t('All models')}</span>
    )
  }
  return (
    <BadgeCell>
      <StatusBadge
        label={t('{{count}} models', { count: models.length })}
        variant='neutral'
        copyable={false}
      />
    </BadgeCell>
  )
}

function UserKeysTable(props: { user: AdminEnabledApiKeyUser; now: number }) {
  const { t } = useTranslation()
  return (
    <div className='overflow-x-auto'>
      <Table>
        <TableHeader>
          <TableRow className='hover:bg-transparent'>
            <TableHead>{t('Name')}</TableHead>
            <TableHead>{t('Key')}</TableHead>
            <TableHead>{t('Status')}</TableHead>
            <TableHead>{t('Quota')}</TableHead>
            <TableHead>{t('Group')}</TableHead>
            <TableHead>{t('Models')}</TableHead>
            <TableHead>{t('Expires')}</TableHead>
            <TableHead>{t('Last Used')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.user.keys.map((key) => (
            <TableRow key={key.id}>
              <TableCell className='font-medium'>{key.name || '-'}</TableCell>
              <TableCell className='text-muted-foreground font-mono text-xs'>
                {`sk-${key.masked_key}`}
              </TableCell>
              <TableCell>
                {keyIsUsable(key, props.now) ? (
                  <StatusBadge
                    label={t('Usable')}
                    variant='success'
                    copyable={false}
                  />
                ) : (
                  <StatusBadge
                    label={t('Not usable')}
                    variant='neutral'
                    copyable={false}
                  />
                )}
              </TableCell>
              <TableCell>
                <KeyQuotaCell apiKey={key} />
              </TableCell>
              <TableCell>
                {key.group ? (
                  <GroupBadge group={key.group} />
                ) : (
                  <span className='text-muted-foreground'>-</span>
                )}
              </TableCell>
              <TableCell>
                <KeyModelCell apiKey={key} />
              </TableCell>
              <TableCell>
                <KeyExpiryCell apiKey={key} now={props.now} />
              </TableCell>
              <TableCell className='text-muted-foreground text-xs'>
                {key.accessed_time > 0
                  ? formatTimestamp(key.accessed_time)
                  : t('Never used')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function UserSummary(props: { user: AdminEnabledApiKeyUser; now: number }) {
  const { t } = useTranslation()
  const usableCount = props.user.keys.filter((key) =>
    keyIsUsable(key, props.now)
  ).length
  return (
    <div className='flex min-w-0 flex-1 flex-col gap-1'>
      <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
        <span className='truncate text-sm font-semibold'>
          {props.user.display_name || props.user.username}
        </span>
        <span className='text-muted-foreground truncate text-xs'>
          {props.user.username} · #{props.user.user_id}
        </span>
        {props.user.user_group ? (
          <GroupBadge group={props.user.user_group} />
        ) : null}
      </div>
      <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
        <span className='tabular-nums'>
          {t('Enabled keys')}: {props.user.key_count}
        </span>
        <span className='text-success tabular-nums'>
          {t('Usable now')}: {usableCount}
        </span>
        {props.user.email ? (
          <span className='truncate'>{props.user.email}</span>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Every user's enabled API keys, one collapsible group per user. Keys are
 * masked: the board answers what a user can call with, not how to call.
 */
export function ApiKeyBoardPanel() {
  const { t } = useTranslation()
  // One reading of the clock per mount keeps "usable now" stable while the
  // operator searches and pages.
  const [nowSeconds] = useState(() => Math.floor(Date.now() / 1000))
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebounce(keyword, 400)
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'admin-enabled-api-keys',
      { keyword: debouncedKeyword, page, pageSize: PAGE_SIZE },
    ],
    queryFn: async () =>
      requireServerSuccess(
        await listAdminEnabledApiKeys({
          keyword: debouncedKeyword,
          page,
          pageSize: PAGE_SIZE,
        })
      ),
    placeholderData: (previous) => previous,
  })

  const users = data?.data?.items || []
  const total = data?.data?.total || 0
  const keyTotal = data?.data?.key_total || 0
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1)

  // A filter change starts the list over, so the operator never lands on an
  // empty page of a narrower result set.
  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value)
    setPage(1)
  }, [])

  const renderBody = () => {
    if (isLoading && users.length === 0) {
      return (
        <div className='space-y-2'>
          {SKELETON_ROWS.map((row) => (
            <Skeleton key={row} className='h-16 w-full' />
          ))}
        </div>
      )
    }
    if (users.length === 0) {
      return (
        <EmptyState
          icon={KeyRound}
          title={t('No user has an enabled API key yet')}
          description={t(
            'A user appears here once they keep at least one API key enabled'
          )}
        />
      )
    }
    return (
      <Accordion className='w-full' multiple>
        {users.map((user) => (
          <AccordionItem key={user.user_id} value={String(user.user_id)}>
            <AccordionTrigger className='hover:no-underline'>
              <div className='flex min-w-0 flex-1 items-center gap-2 text-left'>
                <UserRound
                  aria-hidden='true'
                  className='text-muted-foreground size-4 shrink-0'
                />
                <UserSummary user={user} now={nowSeconds} />
              </div>
            </AccordionTrigger>
            <AccordionContent className='pt-2'>
              <UserKeysTable user={user} now={nowSeconds} />
              {user.keys.length < user.key_count ? (
                <p className='text-muted-foreground mt-2 text-xs'>
                  {t('Showing the newest {{shown}} of {{total}} keys', {
                    shown: user.keys.length,
                    total: user.key_count,
                  })}
                </p>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    )
  }

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
        <div className='relative w-full max-w-sm'>
          <Search
            aria-hidden='true'
            className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2'
          />
          <Input
            value={keyword}
            placeholder={t('Search user, key name, or ID...')}
            aria-label={t('Search user, key name, or ID...')}
            className='pl-9'
            onChange={(event) => handleKeywordChange(event.target.value)}
          />
        </div>
        <div className='text-muted-foreground ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums'>
          <span>
            {t('Users with keys')}: {total}
          </span>
          <span>
            {t('Enabled keys')}: {keyTotal}
          </span>
          {isFetching ? (
            <ChevronDown
              aria-hidden='true'
              className='size-3.5 animate-pulse'
            />
          ) : null}
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>{renderBody()}</div>

      {total > PAGE_SIZE ? (
        <div className='flex items-center justify-between'>
          <p className='text-muted-foreground text-xs'>
            {t('Page {{page}} of {{total}}', { page, total: totalPages })}
          </p>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((previous) => Math.max(1, previous - 1))}
            >
              {t('Previous')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= totalPages}
              onClick={() =>
                setPage((previous) => Math.min(totalPages, previous + 1))
              }
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
