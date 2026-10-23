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
import { Globe, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Skeleton } from '@/components/ui/skeleton'
import { useApiInfo } from '@/features/dashboard/hooks/use-status-data'
import { useStatus } from '@/hooks/use-status'

interface AddressRowProps {
  label: string
  url: string
  badge?: string
  description?: string
}

/** Hosts that are reachable only from the server itself. */
function isLoopbackHost(url: string) {
  try {
    const host = new URL(url).hostname
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0'
    )
  } catch {
    return false
  }
}

/**
 * Pick the address a client should actually call.
 *
 * The configured server address wins, except when it points at a loopback host
 * while the console is being served from a real domain: that combination means
 * the deployment was never given a public address, and showing `localhost` to
 * visitors hands them a URL that cannot work.
 *
 * `origin` is a parameter rather than read from `window` so the rule can be
 * tested for both the loopback and the public deployment.
 */
export function resolvePublicAddress(serverAddress: string, origin: string) {
  if (!serverAddress) return origin
  if (isLoopbackHost(serverAddress) && !isLoopbackHost(origin)) return origin
  return serverAddress
}

function AddressRow(props: AddressRowProps) {
  const { t } = useTranslation()
  return (
    <div className='bg-muted/50 flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2'>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-1.5'>
          <span className='text-muted-foreground shrink-0 text-xs font-medium'>
            {props.label}
          </span>
          {props.badge ? (
            <span className='shrink-0 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400'>
              {props.badge}
            </span>
          ) : null}
        </div>
        <code className='block truncate font-mono text-xs select-text'>
          {props.url}
        </code>
        {props.description ? (
          <span className='text-muted-foreground block truncate text-[11px]'>
            {props.description}
          </span>
        ) : null}
      </div>
      <CopyButton
        value={props.url}
        size='sm'
        tooltip={t('Copy API URL')}
        aria-label={`${t('Copy API URL')}: ${props.url}`}
        className='shrink-0'
      />
    </div>
  )
}

/**
 * Base URLs a client needs before any key is useful.
 *
 * Shown above the list because the address is the first thing a new user
 * looks for, and hiding it behind a menu made them copy the wrong origin.
 */
export function ApiEndpointsCard() {
  const { t } = useTranslation()
  const { status, loading } = useStatus()
  const { items } = useApiInfo()

  const serverAddress =
    (typeof status?.server_address === 'string' &&
      status.server_address.trim()) ||
    ''

  const addresses = items.length
    ? items
    : [
        {
          url: resolvePublicAddress(serverAddress, window.location.origin),
          route: serverAddress ? t('Default API address') : t('Current domain'),
          description: '',
        },
      ]

  return (
    <div className='bg-card min-w-0 overflow-hidden rounded-xl border shadow-xs'>
      <div className='flex flex-wrap items-center gap-2 border-b px-3 py-2.5'>
        <Globe className='text-muted-foreground size-4 shrink-0' aria-hidden='true' />
        <span className='text-sm font-semibold'>{t('API Endpoints')}</span>
        <span className='text-muted-foreground ml-auto flex items-center gap-1 text-xs'>
          <ShieldCheck className='size-3.5' aria-hidden='true' />
          {t('Use these as the base URL')}
        </span>
      </div>
      <div className='grid gap-2 p-3 sm:grid-cols-2'>
        {loading ? (
          <>
            <Skeleton className='h-14 w-full rounded-lg' />
            <Skeleton className='h-14 w-full rounded-lg' />
          </>
        ) : (
          addresses.map((address, index) => (
            <AddressRow
              key={address.url}
              label={address.route || t('Address {{index}}', { index: index + 1 })}
              url={address.url}
              badge={index === 0 ? t('Recommended') : undefined}
              description={address.description}
            />
          ))
        )}
      </div>
    </div>
  )
}
