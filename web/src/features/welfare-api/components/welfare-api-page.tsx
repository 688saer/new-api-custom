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
import { Gift, LogIn, Megaphone, ServerOff, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { useWelfareApis } from '../hooks/use-welfare-apis'
import { splitWelfareModels } from '../lib/welfare-api'
import { WelfareApiCard } from './welfare-api-card'

function HeroBackdrop() {
  return (
    <div
      aria-hidden
      className='pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-25 dark:opacity-[0.12]'
      style={{
        background: [
          'radial-gradient(ellipse 55% 45% at 18% 12%, oklch(0.74 0.16 195 / 85%) 0%, transparent 70%)',
          'radial-gradient(ellipse 45% 40% at 78% 8%, oklch(0.70 0.17 285 / 70%) 0%, transparent 72%)',
          'radial-gradient(ellipse 40% 32% at 50% 62%, oklch(0.76 0.13 150 / 45%) 0%, transparent 74%)',
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
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className='h-64 rounded-2xl' />
      ))}
    </div>
  )
}

export function WelfareApiPage() {
  const { t } = useTranslation()
  const query = useWelfareApis()
  const status = query.data?.data
  const apis = status?.apis ?? []

  const stats = useMemo(() => {
    const providers = new Set<string>()
    const models = new Set<string>()
    for (const api of apis) {
      if (api.provider) providers.add(api.provider)
      for (const model of splitWelfareModels(api.model)) {
        models.add(model)
      }
    }
    return { apis: apis.length, providers: providers.size, models: models.size }
  }, [apis])

  const title = status?.title || t('Welfare API')
  const subtitle =
    status?.subtitle ||
    t(
      'Free APIs published by the site operator, with endpoints and models ready to call.'
    )

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition>
        <div className='relative min-h-svh'>
          <HeroBackdrop />

          <div className='relative container px-4 pt-24 pb-20'>
            <section className='max-w-3xl space-y-4'>
              <Badge variant='outline' className='gap-1.5'>
                <Sparkles aria-hidden='true' />
                {t('Free to use')}
              </Badge>
              <h1 className='text-[clamp(2rem,5vw,3rem)] leading-[1.1] font-bold tracking-tight'>
                {title}
              </h1>
              <p className='text-muted-foreground/85 max-w-2xl text-sm leading-relaxed md:text-base'>
                {subtitle}
              </p>

              {apis.length > 0 ? (
                <dl className='flex flex-wrap items-center gap-x-8 gap-y-3 pt-2'>
                  {[
                    { label: t('APIs'), value: stats.apis },
                    { label: t('Providers'), value: stats.providers },
                    { label: t('Models'), value: stats.models },
                  ].map((entry) => (
                    <div key={entry.label} className='space-y-0.5'>
                      <dd className='text-2xl leading-none font-semibold tabular-nums'>
                        {entry.value}
                      </dd>
                      <dt className='text-muted-foreground text-xs'>
                        {entry.label}
                      </dt>
                    </div>
                  ))}
                </dl>
              ) : null}
            </section>

            {status?.notice ? (
              <Alert className='mt-8 max-w-3xl'>
                <Megaphone aria-hidden='true' />
                <AlertTitle>{t('Notice')}</AlertTitle>
                <AlertDescription className='whitespace-pre-wrap'>
                  {status.notice}
                </AlertDescription>
              </Alert>
            ) : null}

            <section className='mt-10' aria-live='polite'>
              {query.isLoading ? <LoadingGrid /> : null}

              {!query.isLoading && status?.code === 'NOT_ENABLED' ? (
                <EmptyState
                  icon={ServerOff}
                  title={t('Welfare API is not available')}
                  description={t(
                    'The operator has not enabled this page yet. Please check back later.'
                  )}
                />
              ) : null}

              {!query.isLoading && status?.code === 'LOGIN_REQUIRED' ? (
                <EmptyState
                  icon={LogIn}
                  title={t('Sign in to view')}
                  description={t(
                    'The welfare API list is only visible to signed-in accounts.'
                  )}
                  action={
                    <Button render={<Link to='/sign-in' />}>{t('Sign in')}</Button>
                  }
                />
              ) : null}

              {!query.isLoading &&
              !status?.code &&
              status?.enabled &&
              apis.length === 0 ? (
                <EmptyState
                  icon={Gift}
                  title={t('No welfare APIs published yet')}
                  description={t(
                    'The operator has not published any free API. Please check back later.'
                  )}
                />
              ) : null}

              {apis.length > 0 ? (
                <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
                  {apis.map((api) => (
                    <WelfareApiCard key={api.id || api.name} item={api} />
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
