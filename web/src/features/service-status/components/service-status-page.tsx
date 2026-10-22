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
import { Link } from '@tanstack/react-router'
import { Activity, LogIn, ServerOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { useServiceStatus } from '../hooks/use-service-status'
import {
  SERVICE_STATUS_RANGES,
  SERVICE_STATUS_RANGE_LABELS,
} from '../lib/service-status'
import type { ServiceStatusRange } from '../types'
import { ServiceStatusCard } from './service-status-card'

function HeroBackdrop() {
  return (
    <div
      aria-hidden
      className='pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-25 dark:opacity-[0.12]'
      style={{
        background: [
          'radial-gradient(ellipse 55% 45% at 20% 10%, oklch(0.74 0.16 195 / 85%) 0%, transparent 70%)',
          'radial-gradient(ellipse 45% 40% at 80% 6%, oklch(0.72 0.15 155 / 70%) 0%, transparent 72%)',
          'radial-gradient(ellipse 40% 32% at 48% 60%, oklch(0.70 0.17 285 / 40%) 0%, transparent 74%)',
        ].join(', '),
        maskImage:
          'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0) 100%)',
      }}
    />
  )
}

function LoadingGrid() {
  return (
    <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className='h-56 rounded-xl' />
      ))}
    </div>
  )
}

interface RangeSwitcherProps {
  value: ServiceStatusRange
  onChange: (range: ServiceStatusRange) => void
}

function RangeSwitcher(props: RangeSwitcherProps) {
  const { t } = useTranslation()

  return (
    <div
      className='bg-muted/50 inline-flex items-center gap-1 rounded-lg p-1'
      role='tablist'
      aria-label={t('Monitoring time range')}
    >
      {SERVICE_STATUS_RANGES.map((range) => (
        <button
          key={range}
          type='button'
          role='tab'
          aria-selected={props.value === range}
          onClick={() => props.onChange(range)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            props.value === range
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t(SERVICE_STATUS_RANGE_LABELS[range])}
        </button>
      ))}
    </div>
  )
}

export function ServiceStatusPage() {
  const { t } = useTranslation()
  const [range, setRange] = useState<ServiceStatusRange>('24h')
  const query = useServiceStatus(range)

  const payload = query.payload
  const groups = payload?.groups ?? []
  const title = payload?.title || t('Channel availability')
  const description =
    payload?.description ||
    t('Live probe results for every channel published by this site.')

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition>
        <div className='relative min-h-svh'>
          <HeroBackdrop />

          <div className='relative container px-4 pt-24 pb-20'>
            <section className='max-w-3xl space-y-4'>
              <Badge variant='outline' className='gap-1.5'>
                <Activity aria-hidden='true' />
                {t('Service availability')}
              </Badge>
              <h1 className='text-[clamp(2rem,5vw,3rem)] leading-[1.1] font-bold tracking-tight'>
                {title}
              </h1>
              <p className='text-muted-foreground/85 max-w-2xl text-sm leading-relaxed md:text-base'>
                {description}
              </p>
            </section>

            {query.status === 'ready' && groups.length > 0 ? (
              <div className='mt-8 flex flex-wrap items-center justify-between gap-3'>
                <RangeSwitcher value={range} onChange={setRange} />
                <p className='text-muted-foreground text-xs'>
                  {t('Successful probes divided by total probes')}
                </p>
              </div>
            ) : null}

            <section className='mt-8' aria-live='polite'>
              {query.isLoading ? <LoadingGrid /> : null}

              {!query.isLoading && query.status === 'disabled' ? (
                <EmptyState
                  icon={ServerOff}
                  title={t('Service status is not currently available.')}
                  description={t(
                    'The operator has not enabled this page yet. Please check back later.'
                  )}
                />
              ) : null}

              {!query.isLoading && query.status === 'login-required' ? (
                <EmptyState
                  icon={LogIn}
                  title={t('Sign in to view')}
                  description={t(
                    'The channel availability list is only visible to signed-in accounts.'
                  )}
                  action={
                    <Button render={<Link to='/sign-in' />}>{t('Sign in')}</Button>
                  }
                />
              ) : null}

              {!query.isLoading && query.status === 'error' ? (
                <EmptyState
                  icon={ServerOff}
                  title={t('Unable to load service status.')}
                  description={t('Please try again in a moment.')}
                  action={
                    <Button variant='outline' onClick={() => query.refetch()}>
                      {t('Retry')}
                    </Button>
                  }
                />
              ) : null}

              {!query.isLoading &&
              query.status === 'ready' &&
              groups.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title={t('No service groups are currently published.')}
                  description={t(
                    'The operator has not published any channel yet. Please check back later.'
                  )}
                />
              ) : null}

              {groups.length > 0 ? (
                <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
                  {groups.map((group) => (
                    <ServiceStatusCard
                      key={group.id}
                      group={group}
                      showLatency={payload?.show_latency ?? true}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </PageTransition>
    </PublicLayout>
  )
}
