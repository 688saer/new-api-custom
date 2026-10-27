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
import { ArrowRight, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'

import { PlanetGlobe } from '../planet-globe'

interface HeroProps {
  isAuthenticated?: boolean
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  const docsIsExternal = docsUrl.startsWith('http')

  return (
    <section className='mx-auto w-full max-w-6xl px-6 pt-10 pb-12 md:pt-14 md:pb-16'>
      <div className='grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-10'>
        <div className='landing-animate-fade-up min-w-0'>
          <p className='text-muted-foreground font-mono text-xs tracking-[0.05em]'>
            {t('AI Gateway · Unified Access')}
          </p>

          <h1 className='mt-6 text-[clamp(2.25rem,4.4vw,3.75rem)] leading-[1.04] font-bold tracking-[-0.05em]'>
            <span className='block text-[#5b8ff9]'>
              {t('One endpoint for')}
            </span>
            <span className='block text-balance'>
              {t('every mainstream model')}
            </span>
          </h1>

          <p className='text-muted-foreground mt-6 max-w-[30rem] text-[15px] leading-[1.75]'>
            {t(
              'One API to reach a wide range of AI models. Simpler integration, clearer usage and subscription management.'
            )}
          </p>

          <div className='mt-8 flex flex-wrap items-center gap-3'>
            {props.isAuthenticated ? (
              <Button
                className='h-11 rounded-full px-5 text-sm font-medium'
                render={<Link to='/dashboard' />}
              >
                {t('Go to Dashboard')}
                <ArrowRight className='ml-1.5 size-4' />
              </Button>
            ) : (
              <Button
                className='h-11 rounded-full px-5 text-sm font-medium'
                render={<Link to='/sign-up' />}
              >
                {t('Get Started')}
                <ArrowRight className='ml-1.5 size-4' />
              </Button>
            )}
            <Button
              variant='outline'
              className='h-11 rounded-full px-5 text-sm font-medium'
              render={<Link to='/pricing' />}
            >
              {t('View Pricing')}
            </Button>
            <Button
              variant='ghost'
              className='text-muted-foreground hover:text-foreground h-11 rounded-full px-4 text-sm font-medium'
              render={
                docsIsExternal ? (
                  <a href={docsUrl} target='_blank' rel='noopener noreferrer' />
                ) : (
                  <Link to={docsUrl} />
                )
              }
            >
              <BookOpen className='mr-1.5 size-4' aria-hidden='true' />
              {t('Docs')}
            </Button>
          </div>
        </div>

        <div
          className='landing-animate-fade-up relative mx-auto aspect-square w-full max-w-[460px] min-w-0'
          style={{ animationDelay: '120ms' }}
        >
          <PlanetGlobe
            label={t(
              'Rotating globe illustrating worldwide access to the model gateway'
            )}
          />
        </div>
      </div>
    </section>
  )
}
