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
import { ArrowRight, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/**
 * A short prompt box that hands the question over to the playground, matching
 * the reference site's "try it in the chat console" section.
 */
export function PlaygroundTeaser() {
  const { t } = useTranslation()
  const [question, setQuestion] = useState('')

  return (
    <section className='border-border/60 mx-auto w-full max-w-6xl border-t px-6 py-12 md:py-16'>
      <div className='border-border/60 bg-muted/20 rounded-2xl border p-6 md:p-8'>
        <p className='text-muted-foreground font-mono text-xs tracking-[0.05em]'>
          {t('Playground')}
        </p>
        <h2 className='mt-4 text-2xl font-semibold tracking-tight'>
          {t('Try it in the chat console')}
        </h2>
        <p className='text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed'>
          {t(
            'Write a question, then pick a key and model in the playground to continue.'
          )}
        </p>

        <div className='border-border/60 bg-background mt-6 rounded-xl border p-3'>
          <label className='sr-only' htmlFor='home-playground-question'>
            {t('Ask something')}
          </label>
          <Textarea
            id='home-playground-question'
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t('Ask something, then continue in the playground')}
            className='min-h-20 resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0'
          />
          <div className='mt-2 flex items-center justify-between gap-3'>
            <span className='text-muted-foreground inline-flex items-center gap-1.5 text-xs'>
              <MessageSquare className='size-3.5' aria-hidden='true' />
              {t('Continues in the playground')}
            </span>
            <Button
              className='h-9 rounded-full px-4 text-xs font-medium'
              render={<Link to='/playground' />}
            >
              {t('Open playground')}
              <ArrowRight className='ml-1 size-3.5' aria-hidden='true' />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
