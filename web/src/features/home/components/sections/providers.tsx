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

import { getLobeIcon } from '@/lib/lobe-icon'

/** Provider ids resolved through the shared LobeHub icon registry. */
const PROVIDERS = [
  'OpenAI',
  'Claude',
  'Gemini',
  'DeepSeek',
  'Qwen',
  'Doubao',
  'Mistral',
  'Grok',
  'Groq',
  'Nvidia',
  'Perplexity',
  'Meta',
  'Google',
  'Moonshot',
  'Minimax',
  'Zhipu',
  'Hunyuan',
  'Baichuan',
  'Cohere',
  'Jina',
] as const

function ProviderChip(props: { name: string }) {
  return (
    <span className='text-muted-foreground inline-flex shrink-0 items-center gap-2.5 text-sm font-medium'>
      <span className='inline-flex size-6 shrink-0 items-center justify-center'>
        {getLobeIcon(props.name, 24)}
      </span>
      <span className='whitespace-nowrap'>{props.name}</span>
    </span>
  )
}

/**
 * Provider ecosystem strip: one heading plus an endless marquee of the model
 * vendors the gateway can route to.
 */
export function Providers() {
  const { t } = useTranslation()

  return (
    <section className='mx-auto w-full max-w-6xl px-6 py-12 md:py-16'>
      <h2 className='text-center text-xl font-semibold tracking-tight md:text-2xl'>
        {t('Mainstream AI models and provider ecosystem')}
      </h2>

      <div className='marquee-container relative mt-8 overflow-hidden'>
        <div
          aria-hidden='true'
          className='from-background pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r to-transparent'
        />
        <div
          aria-hidden='true'
          className='from-background pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l to-transparent'
        />
        <div className='animate-marquee-left flex w-max items-center gap-10'>
          <div className='flex shrink-0 items-center gap-10'>
            {PROVIDERS.map((name) => (
              <ProviderChip key={name} name={name} />
            ))}
          </div>
          <div aria-hidden='true' className='flex shrink-0 items-center gap-10'>
            {PROVIDERS.map((name) => (
              <ProviderChip key={`duplicate-${name}`} name={name} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
