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
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

interface CTAProps {
  isAuthenticated?: boolean
}

export function CTA(props: CTAProps) {
  const { t } = useTranslation()

  return (
    <section className='border-border/60 mx-auto w-full max-w-6xl border-t px-6 py-16 text-center md:py-24'>
      <h2 className='mx-auto max-w-2xl text-2xl leading-tight font-bold tracking-tight md:text-4xl'>
        {t('Connect in minutes, start calling')}
      </h2>
      <p className='text-muted-foreground mx-auto mt-4 max-w-md text-sm leading-relaxed'>
        {t(
          'Create an API key and connect your project. Available models follow the console configuration.'
        )}
      </p>
      <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
        {props.isAuthenticated ? (
          <Button
            className='h-11 rounded-full px-5 text-sm font-medium'
            render={<Link to='/dashboard' />}
          >
            {t('Go to Dashboard')}
            <ArrowRight className='ml-1.5 size-4' aria-hidden='true' />
          </Button>
        ) : (
          <>
            <Button
              className='h-11 rounded-full px-5 text-sm font-medium'
              render={<Link to='/sign-up' />}
            >
              {t('Get Started')}
              <ArrowRight className='ml-1.5 size-4' aria-hidden='true' />
            </Button>
            <Button
              variant='outline'
              className='h-11 rounded-full px-5 text-sm font-medium'
              render={<Link to='/sign-in' />}
            >
              {t('Sign in')}
            </Button>
          </>
        )}
      </div>
    </section>
  )
}
