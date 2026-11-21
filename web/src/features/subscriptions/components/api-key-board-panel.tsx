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
import { KeyRound, Search, UserRound } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { StaticDataTable } from '@/components/data-table'
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
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  SecureVerificationDialog,
  useSecureVerification,
} from '@/features/auth/secure-verification'
import { useDebounce } from '@/hooks'
import { formatQuota, formatTimestamp } from '@/lib/format'
import { requireServerSuccess } from '@/lib/server-error-message'

import { listAdminEnabledApiKeys, revealAdminApiKey } from '../api'
import {
  formatKeyInfo,
  formatUserKeysInfo,
  isKeyUsable,
  maskedKeyText,
} from '../lib/api-key-board'
import type { AdminEnabledApiKey, AdminEnabledApiKeyUser } from '../types'

const PAGE_SIZE = 10

const SKELETON_ROWS = ['first', 'second', 'third', 'fourth']

type SummaryTile = {
  key: string
  label: string
  value: string
  icon: typeof KeyRound
  tone: 'primary' | 'success' | 'info'
}

function KeyQuotaCell(props: { apiKey: AdminEnabledApiKey }) {
  const { t } = useTranslation()
  if (props.apiKey.unlimited_quota) {
    return (
      <span className='text-muted-foreground text-xs'>{t('Unlimited')}</span>
    )
  }
  return (
    <div className='flex flex-col items-end tabular-nums'>
      <span className='text-xs'>{formatQuota(props.apiKey.remain_quota)}</span>
      <span className='text-muted-foreground text-xs'>
        {t('Used')} {formatQuota(props.apiKey.used_quota)}
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
      className={
        isPast
          ? 'text-destructive text-xs tabular-nums'
          : 'text-muted-foreground text-xs tabular-nums'
      }
    >
      {formatTimestamp(props.apiKey.expired_time)}
    </span>
  )
}

function KeyModelsCell(props: { apiKey: AdminEnabledApiKey }) {
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
    <StatusBadge
      label={t('{{count}} models', { count: models.length })}
      variant='neutral'
      copyable={false}
    />
  )
}

export function ApiKeyBoardPanel() {
  const { t } = useTranslation()
  // One reading of the clock per mount keeps "usable now" stable while the
  // operator searches and pages.
  const [nowSeconds] = useState(() => Math.floor(Date.now() / 1000))
  const [keyword, setKeyword] = useState('')
  const debouncedKeyword = useDebounce(keyword, 400)
  const [page, setPage] = useState(1)
  const [revealed, setRevealed] = useState<Record<number, string>>({})
  const [revealingId, setRevealingId] = useState<number | null>(null)
  const verification = useSecureVerification()

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

  // The page payload is the single source of rows; a stable fallback keeps the
  // derived counts below from recomputing on every render.
  const users = useMemo(() => data?.data?.items ?? [], [data])
  const total = data?.data?.total || 0
  const keyTotal = data?.data?.key_total || 0
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1)

  // A filter change starts the list over, so the operator never lands on an
  // empty page of a narrower result set.
  const handleKeywordChange = useCallback((value: string) => {
    setKeyword(value)
    setPage(1)
  }, [])

  const usableTotal = useMemo(
    () =>
      users.reduce(
        (count, user) =>
          count +
          user.keys.filter((key) => isKeyUsable(key, nowSeconds)).length,
        0
      ),
    [users, nowSeconds]
  )

  const tiles = useMemo((): SummaryTile[] => {
    return [
      {
        key: 'users',
        label: t('Users with keys'),
        value: String(total),
        icon: UserRound,
        tone: 'primary',
      },
      {
        key: 'keys',
        label: t('Enabled keys'),
        value: String(keyTotal),
        icon: KeyRound,
        tone: 'info',
      },
      {
        key: 'usable',
        label: t('Usable now'),
        value: String(usableTotal),
        icon: KeyRound,
        tone: 'success',
      },
    ]
  }, [total, keyTotal, usableTotal, t])

  /** Reveals one key behind a step-up proof, then shows the full value. */
  const handleReveal = useCallback(
    async (apiKey: AdminEnabledApiKey, userId: number, username: string) => {
      const proof = await verification.requestVerification({
        scope: 'admin.user.api_key.read',
        context: { user_id: userId, key_id: apiKey.id },
        title: t('Verify to reveal an API key'),
        description: t(
          'Confirm your identity before revealing the key {{name}} of user {{username}}.',
          { name: apiKey.name || `#${apiKey.id}`, username }
        ),
      })
      if (!proof) return
      setRevealingId(apiKey.id)
      try {
        const result = requireServerSuccess(
          await revealAdminApiKey(apiKey.id, proof.proof_token)
        )
        const fullKey = result.data?.key
        if (!fullKey) return
        setRevealed((previous) => ({ ...previous, [apiKey.id]: fullKey }))
      } finally {
        setRevealingId(null)
      }
    },
    [verification, t]
  )

  const renderKeysTable = (user: AdminEnabledApiKeyUser) => {
    return (
      <StaticDataTable
        data={user.keys}
        getRowKey={(key) => key.id}
        containerProps={{ 'aria-label': t('Enabled keys') }}
        columns={[
          {
            id: 'name',
            header: t('Name'),
            cell: (key) => (
              <span className='text-sm font-medium'>{key.name || '-'}</span>
            ),
          },
          {
            id: 'key',
            header: t('Key'),
            cell: (key) => {
              const fullKey = revealed[key.id]
              return (
                <div className='flex min-w-0 items-center gap-1'>
                  <code className='text-muted-foreground truncate font-mono text-xs'>
                    {fullKey ?? maskedKeyText(key)}
                  </code>
                  {fullKey ? (
                    <CopyButton
                      value={fullKey}
                      size='icon'
                      className='size-7'
                      iconClassName='size-3.5'
                      tooltip={t('Copy to clipboard')}
                      successTooltip={t('Copied!')}
                      aria-label={t('Full API key copied')}
                    />
                  ) : (
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 px-2 text-xs'
                      disabled={revealingId === key.id}
                      onClick={() => {
                        void handleReveal(key, user.user_id, user.username)
                      }}
                    >
                      {t('Reveal')}
                    </Button>
                  )}
                </div>
              )
            },
          },
          {
            id: 'status',
            header: t('Status'),
            cell: (key) =>
              isKeyUsable(key, nowSeconds) ? (
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
              ),
          },
          {
            id: 'quota',
            header: t('Quota'),
            className: 'text-right',
            cellClassName: 'text-right',
            cell: (key) => <KeyQuotaCell apiKey={key} />,
          },
          {
            id: 'group',
            header: t('Group'),
            cell: (key) =>
              key.group ? (
                <GroupBadge group={key.group} />
              ) : (
                <span className='text-muted-foreground'>-</span>
              ),
          },
          {
            id: 'models',
            header: t('Models'),
            cell: (key) => <KeyModelsCell apiKey={key} />,
          },
          {
            id: 'expires',
            header: t('Expires'),
            cell: (key) => <KeyExpiryCell apiKey={key} now={nowSeconds} />,
          },
          {
            id: 'accessed',
            header: t('Last Used'),
            cell: (key) => (
              <span className='text-muted-foreground text-xs tabular-nums'>
                {key.accessed_time > 0
                  ? formatTimestamp(key.accessed_time)
                  : t('Never used')}
              </span>
            ),
          },
          {
            id: 'copy',
            header: t('Actions'),
            className: 'text-right',
            cellClassName: 'text-right',
            cell: (key) => (
              <CopyButton
                value={formatKeyInfo(key, {
                  t,
                  nowSeconds,
                  keyValue: revealed[key.id],
                })}
                size='icon'
                className='size-7'
                iconClassName='size-3.5'
                tooltip={t('Copy key information')}
                successTooltip={t('Key information copied')}
                aria-label={t('Copy key information')}
              />
            ),
          },
        ]}
      />
    )
  }

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
                <div className='flex min-w-0 flex-1 flex-col gap-1'>
                  <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
                    <span className='truncate text-sm font-semibold'>
                      {user.display_name || user.username}
                    </span>
                    <span className='text-muted-foreground truncate text-xs'>
                      {user.username} · #{user.user_id}
                    </span>
                    {user.user_group ? (
                      <GroupBadge group={user.user_group} />
                    ) : null}
                  </div>
                  <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
                    <span className='tabular-nums'>
                      {t('Enabled keys')}: {user.key_count}
                    </span>
                    <span className='text-success tabular-nums'>
                      {t('Usable now')}:{' '}
                      {
                        user.keys.filter((key) => isKeyUsable(key, nowSeconds))
                          .length
                      }
                    </span>
                    {user.email ? (
                      <span className='truncate'>{user.email}</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className='pt-2'>
              {renderKeysTable(user)}
              <div className='mt-2 flex flex-wrap items-center justify-between gap-2'>
                <p className='text-muted-foreground text-xs'>
                  {user.keys.length < user.key_count
                    ? t('Showing the newest {{shown}} of {{total}} keys', {
                        shown: user.keys.length,
                        total: user.key_count,
                      })
                    : null}
                </p>
                <CopyButton
                  value={formatUserKeysInfo(user, { t, nowSeconds })}
                  variant='outline'
                  size='sm'
                  className='h-7 px-2 text-xs'
                  iconClassName='size-3.5'
                  tooltip={t('Copy all key information of this user')}
                  successTooltip={t('Key information copied')}
                  aria-label={t('Copy all key information of this user')}
                >
                  {t('Copy all')}
                </CopyButton>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    )
  }

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className='flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5'
          >
            <IconBadge tone={tile.tone} size='sm'>
              <tile.icon />
            </IconBadge>
            <div className='min-w-0'>
              <p className='text-muted-foreground truncate text-xs'>
                {tile.label}
              </p>
              <p className='truncate text-lg font-semibold tabular-nums'>
                {isLoading && total === 0 ? '-' : tile.value}
              </p>
            </div>
          </div>
        ))}
      </div>

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
        <div className='text-muted-foreground ml-auto text-xs tabular-nums'>
          {t('Page {{page}} of {{total}}', { page, total: totalPages })}
          {isFetching ? <span className='ms-2'>{t('Loading...')}</span> : null}
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>{renderBody()}</div>

      {total > PAGE_SIZE ? (
        <div className='flex items-center justify-end gap-2'>
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
      ) : null}

      <SecureVerificationDialog {...verification.dialogProps} />
    </div>
  )
}
