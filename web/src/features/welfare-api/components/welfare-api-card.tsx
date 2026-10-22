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
import { BookOpen, Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { MaskedValueDisplay } from '@/components/masked-value-display'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  buildCurlSample,
  maskWelfareKey,
  splitWelfareModels,
  welfareAccentFor,
} from '../lib/welfare-api'
import type { WelfareApiItem } from '../types'

function FieldRow(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 py-2'>
      <span className='text-muted-foreground text-xs font-medium tracking-wide'>
        {props.label}
      </span>
      <div className='min-w-0'>{props.children}</div>
    </div>
  )
}

export function WelfareApiCard(props: { item: WelfareApiItem }) {
  const { t } = useTranslation()
  const models = splitWelfareModels(props.item.model)
  const accent = welfareAccentFor(props.item.id || props.item.name)
  const accentParts = accent.split(' ')
  const initial = (props.item.provider || props.item.name || '?')
    .trim()
    .slice(0, 1)
    .toUpperCase()

  return (
    <article
      className={cn(
        'group bg-card relative flex flex-col overflow-hidden rounded-2xl border',
        'transition-[box-shadow,transform,border-color] duration-200',
        'hover:border-foreground/15 hover:shadow-lg hover:shadow-black/[0.04] dark:hover:shadow-black/20'
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-70',
          accentParts.slice(0, 2).join(' ')
        )}
      />

      <header className='relative flex items-start gap-3 px-5 pt-5'>
        <span
          aria-hidden
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-white/70 text-base font-semibold backdrop-blur-sm dark:border-white/10 dark:bg-white/10',
            accentParts.slice(2).join(' ')
          )}
        >
          {initial}
        </span>

        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='truncate text-base font-semibold tracking-tight'>
              {props.item.name || t('Untitled API')}
            </h3>
            {props.item.badge ? (
              <Badge variant='secondary'>{props.item.badge}</Badge>
            ) : null}
          </div>
          {props.item.provider ? (
            <p className='text-muted-foreground mt-0.5 truncate text-xs'>
              {props.item.provider}
            </p>
          ) : null}
        </div>
      </header>

      {props.item.description ? (
        <p className='text-muted-foreground/90 relative px-5 pt-3 text-sm leading-relaxed'>
          {props.item.description}
        </p>
      ) : null}

      <div className='divide-border/60 relative mx-5 mt-4 mb-1 divide-y border-t border-b'>
        <FieldRow label={t('Endpoint')}>
          <div className='flex items-center gap-1'>
            <code className='bg-muted/60 min-w-0 flex-1 truncate rounded-md px-2 py-1 font-mono text-xs'>
              {props.item.base_url || '—'}
            </code>
            {props.item.base_url ? (
              <CopyButton
                value={props.item.base_url}
                size='icon'
                className='size-7'
                iconClassName='size-3.5'
                tooltip={t('Copy endpoint')}
              />
            ) : null}
          </div>
        </FieldRow>

        <FieldRow label={t('Model')}>
          {models.length > 0 ? (
            <div className='flex flex-wrap gap-1.5'>
              {models.map((model) => (
                <code
                  key={model}
                  className='bg-muted/60 rounded-md px-2 py-0.5 font-mono text-xs'
                >
                  {model}
                </code>
              ))}
            </div>
          ) : (
            <span className='text-muted-foreground text-xs'>—</span>
          )}
        </FieldRow>

        {props.item.api_key ? (
          <FieldRow label={t('API key')}>
            <MaskedValueDisplay
              label={t('Full API key')}
              fullValue={props.item.api_key}
              maskedValue={maskWelfareKey(props.item.api_key)}
              copyTooltip={t('Copy API key')}
              copyAriaLabel={t('Copy API key')}
            />
          </FieldRow>
        ) : null}
      </div>

      <footer className='mt-auto flex flex-wrap items-center gap-2 px-5 py-4'>
        <CopyButton
          value={buildCurlSample(props.item)}
          variant='outline'
          size='sm'
          tooltip={t('Copy cURL sample')}
        >
          <Terminal aria-hidden='true' />
          <span>{t('Copy cURL')}</span>
        </CopyButton>

        {props.item.docs_url ? (
          <Button
            variant='ghost'
            size='sm'
            render={
              <a
                href={props.item.docs_url}
                target='_blank'
                rel='noopener noreferrer'
              />
            }
          >
            <BookOpen aria-hidden='true' />
            <span>{t('Docs')}</span>
          </Button>
        ) : null}
      </footer>
    </article>
  )
}
