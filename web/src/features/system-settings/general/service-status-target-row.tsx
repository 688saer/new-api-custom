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
import { CheckCircle2, Pencil, RefreshCw, Trash2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ServiceStatusTargetStatus } from '@/features/service-status/api-admin'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative } from '@/lib/format'

import type { ServiceStatusTargetValues } from './service-status-target-dialog'

/** One row in the probe-target list, with its latest probe outcome. */
export function ServiceStatusTargetRow(props: {
  target: ServiceStatusTargetValues
  status?: ServiceStatusTargetStatus
  probing: boolean
  onEdit: () => void
  onProbe: () => void
  onRemove: () => void
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const status = props.status

  return (
    <li className='bg-background/70 flex items-start gap-3 rounded-lg border px-3 py-2.5'>
      <div className='min-w-0 flex-1 space-y-1'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='truncate text-sm font-medium'>
            {props.target.name || t('Untitled target')}
          </span>
          {props.target.category ? (
            <Badge variant='secondary'>{props.target.category}</Badge>
          ) : null}
          {!props.target.enabled ? (
            <Badge variant='outline'>{t('Disabled')}</Badge>
          ) : null}
        </div>
        <p className='text-muted-foreground truncate font-mono text-xs'>
          {props.target.baseUrl || '—'}
        </p>
        {props.target.model ? (
          <p className='text-muted-foreground truncate font-mono text-xs'>
            {props.target.model}
          </p>
        ) : null}
        <div className='flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'>
          {status?.probed ? (
            <>
              {status.success ? (
                <span className='text-emerald-600 dark:text-emerald-400 flex items-center gap-1'>
                  <CheckCircle2 className='size-3.5' aria-hidden='true' />
                  {t('Probe succeeded')}
                </span>
              ) : (
                <span className='text-destructive flex items-center gap-1'>
                  <XCircle className='size-3.5' aria-hidden='true' />
                  {t('Probe failed')}
                </span>
              )}
              {status.success ? (
                <span className='text-muted-foreground'>
                  {t('{{ms}} ms', { ms: status.latency_ms })}
                </span>
              ) : null}
              <span className='text-muted-foreground'>
                {formatTimestampRelative(status.timestamp, 'seconds', locale)}
              </span>
            </>
          ) : (
            <span className='text-muted-foreground'>{t('Not probed yet')}</span>
          )}
        </div>
        {status?.probed && !status.success && status.error_message ? (
          <p className='text-destructive line-clamp-2 font-mono text-xs'>
            {status.error_message}
          </p>
        ) : null}
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        <Button
          type='button'
          size='icon-sm'
          variant='ghost'
          aria-label={t('Probe now')}
          disabled={props.probing || !props.target.enabled}
          onClick={props.onProbe}
        >
          <RefreshCw
            aria-hidden='true'
            className={props.probing ? 'animate-spin' : undefined}
          />
        </Button>
        <Button
          type='button'
          size='icon-sm'
          variant='ghost'
          aria-label={t('Edit entry')}
          onClick={props.onEdit}
        >
          <Pencil aria-hidden='true' />
        </Button>
        <Button
          type='button'
          size='icon-sm'
          variant='ghost'
          aria-label={t('Delete entry')}
          onClick={props.onRemove}
        >
          <Trash2 aria-hidden='true' />
        </Button>
      </div>
    </li>
  )
}
