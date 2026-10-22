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

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import {
  formatServiceStatusLatency,
  formatServiceStatusPercent,
  serviceStatusBillingLabel,
  serviceStatusColorLabel,
  serviceStatusDotClass,
  serviceStatusTextClass,
} from '../lib/service-status'
import type { ServiceStatusGroup } from '../types'
import { ServiceStatusUptimeBar } from './service-status-uptime-bar'

interface ServiceStatusCardProps {
  group: ServiceStatusGroup
  showLatency: boolean
}

/** One channel card: identity, live statistics, and the uptime ribbon. */
export function ServiceStatusCard(props: ServiceStatusCardProps) {
  const { t } = useTranslation()
  const group = props.group

  return (
    <article className='bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-xs transition-shadow hover:shadow-sm'>
      <header className='flex items-start justify-between gap-3'>
        <div className='min-w-0 space-y-1'>
          <div className='flex items-center gap-2'>
            <span
              className={cn(
                'size-2.5 shrink-0 rounded-full',
                serviceStatusDotClass(group.status)
              )}
              aria-hidden='true'
            />
            <h3 className='truncate text-sm font-semibold'>
              {group.display_name || group.group}
            </h3>
          </div>
          {group.description && (
            <p className='text-muted-foreground line-clamp-2 text-xs'>
              {group.description}
            </p>
          )}
        </div>
        <span
          className={cn(
            'shrink-0 text-xs font-medium',
            serviceStatusTextClass(group.status)
          )}
        >
          {t(serviceStatusColorLabel(group.status))}
        </span>
      </header>

      <ServiceStatusUptimeBar cells={group.cells} />

      <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3'>
        <div>
          <dt className='text-muted-foreground'>{t('Success rate')}</dt>
          <dd className='font-medium tabular-nums'>
            {formatServiceStatusPercent(group.success_rate)}
          </dd>
        </div>
        {props.showLatency && (
          <>
            <div>
              <dt className='text-muted-foreground'>
                {t('First response latency')}
              </dt>
              <dd className='font-medium tabular-nums'>
                {formatServiceStatusLatency(group.first_token_latency)}
              </dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>
                {t('Successful probe duration')}
              </dt>
              <dd className='font-medium tabular-nums'>
                {formatServiceStatusLatency(group.p50_latency)}
              </dd>
            </div>
          </>
        )}
      </dl>

      <footer className='flex flex-wrap items-center gap-1.5'>
        {group.category && (
          <Badge variant='secondary' className='text-[11px]'>
            {group.category}
          </Badge>
        )}
        {group.model && (
          <Badge variant='outline' className='font-mono text-[11px]'>
            {group.model}
          </Badge>
        )}
        <Badge variant='outline' className='text-[11px]'>
          {t(serviceStatusBillingLabel(group.billing_mode))}
        </Badge>
      </footer>
    </article>
  )
}
