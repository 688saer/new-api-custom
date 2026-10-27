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
import { ArrowRight, Terminal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { cn } from '@/lib/utils'

const PROTOCOLS = ['OpenAI', 'Anthropic', 'Gemini'] as const
type Protocol = (typeof PROTOCOLS)[number]
type SnippetLanguage = 'Python' | 'cURL'

function buildSnippets(baseUrl: string): Record<Protocol, string> {
  return {
    OpenAI: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="YOUR_API_KEY",
)

response = client.chat.completions.create(
    model="YOUR_MODEL",
    messages=[{"role": "user", "content": "Hello"}],
)
print(response.choices[0].message.content)`,
    Anthropic: `from anthropic import Anthropic

client = Anthropic(
    base_url="${baseUrl.replace(/\/v1$/, '')}",
    api_key="YOUR_API_KEY",
)

message = client.messages.create(
    model="YOUR_MODEL",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
print(message.content[0].text)`,
    Gemini: `curl "${baseUrl.replace(/\/v1$/, '')}/v1beta/models/YOUR_MODEL:generateContent" \\
  -H "x-goog-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'`,
  }
}

function buildCurlSnippets(baseUrl: string): Record<Protocol, string> {
  return {
    OpenAI: `curl "${baseUrl}/chat/completions" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "YOUR_MODEL",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
    Anthropic: `curl "${baseUrl.replace(/\/v1$/, '')}/v1/messages" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "YOUR_MODEL",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
    Gemini: `curl "${baseUrl.replace(/\/v1$/, '')}/v1beta/models/YOUR_MODEL:generateContent" \\
  -H "x-goog-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'`,
  }
}

/**
 * Developer entry point: the site's base URL, three setup steps, and a code
 * sample switchable by protocol and language.
 */
export function Integration(props: { baseUrl: string; docsUrl: string }) {
  const { t } = useTranslation()
  const [protocol, setProtocol] = useState<Protocol>('OpenAI')
  const [language, setLanguage] = useState<SnippetLanguage>('Python')

  const snippet = useMemo(() => {
    const python = buildSnippets(props.baseUrl)
    const curl = buildCurlSnippets(props.baseUrl)
    return language === 'Python' ? python[protocol] : curl[protocol]
  }, [language, protocol, props.baseUrl])

  const steps: Array<{
    title: string
    description: string
    actionLabel: string
    to?: string
    href?: string
  }> = [
    {
      title: 'Create a dedicated key',
      description:
        'Issue one API key per application or tool. Its group decides which models it can reach.',
      actionLabel: 'Manage API keys',
      to: '/keys',
    },
    {
      title: 'Point your client at this site',
      description:
        'Set the base URL, the key and a model name, then keep using your familiar SDK.',
      actionLabel: 'Read the docs',
      href: props.docsUrl,
    },
    {
      title: 'Review calls and cost',
      description:
        'Every request is logged with its model, tokens and cost so spend stays explainable.',
      actionLabel: 'View usage records',
      to: '/usage-logs',
    },
  ]

  return (
    <section
      id='integration'
      className='border-border/60 mx-auto w-full max-w-6xl scroll-mt-24 border-t px-6 py-12 md:py-16'
    >
      <div className='grid grid-cols-1 items-start gap-10 lg:grid-cols-2'>
        <div className='min-w-0'>
          <p className='text-muted-foreground font-mono text-xs tracking-[0.05em]'>
            {t('Developer first')}
          </p>
          <h2 className='mt-4 text-2xl font-semibold tracking-tight md:text-3xl'>
            {t('Change one base URL, keep your protocol')}
          </h2>
          <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
            {t(
              'OpenAI, Anthropic or Gemini: pick one, point the base URL here and keep the SDK you already use.'
            )}
          </p>

          <div className='border-border/60 bg-muted/30 mt-6 rounded-2xl border p-4'>
            <span className='text-muted-foreground text-[11px] font-medium tracking-wide uppercase'>
              {t('API base URL')}
            </span>
            <div className='mt-2 flex items-center gap-2'>
              <code className='bg-background border-border/60 min-w-0 flex-1 truncate rounded-lg border px-3 py-2 font-mono text-xs'>
                {props.baseUrl}
              </code>
              <CopyButton
                value={props.baseUrl}
                variant='outline'
                aria-label={t('Copy base URL')}
              />
            </div>
            <p className='text-muted-foreground mt-2 text-xs'>
              {t('Copy the address, then paste it into your client config.')}
            </p>
            <div className='mt-3 flex flex-wrap gap-1.5'>
              {PROTOCOLS.map((item) => (
                <span
                  key={item}
                  className='border-border/60 bg-background text-muted-foreground rounded-full border px-2.5 py-1 text-[11px] font-medium'
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className='border-border/60 bg-muted/20 min-w-0 rounded-2xl border p-2'>
          <div className='flex items-center justify-between gap-3 px-3 py-2'>
            <span className='text-muted-foreground inline-flex items-center gap-2 text-xs font-semibold'>
              <Terminal className='size-4' aria-hidden='true' />
              {t('Request example')}
            </span>
            <div
              className='flex gap-1'
              role='tablist'
              aria-label={t('Protocol')}
            >
              {PROTOCOLS.map((item) => (
                <button
                  key={item}
                  type='button'
                  role='tab'
                  aria-selected={protocol === item}
                  onClick={() => setProtocol(item)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                    protocol === item
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className='border-border/60 bg-background overflow-hidden rounded-xl border'>
            <div className='border-border/60 flex items-center justify-between gap-3 border-b px-3 py-2'>
              <span className='text-muted-foreground font-mono text-[11px]'>
                {language === 'Python' ? 'request.py' : 'request.sh'}
              </span>
              <div className='flex items-center gap-1'>
                {(['Python', 'cURL'] as const).map((item) => (
                  <button
                    key={item}
                    type='button'
                    aria-pressed={language === item}
                    onClick={() => setLanguage(item)}
                    className={cn(
                      'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                      language === item
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {item}
                  </button>
                ))}
                <CopyButton
                  value={snippet}
                  aria-label={t('Copy code sample')}
                />
              </div>
            </div>
            <pre className='overflow-x-auto px-3 py-3 font-mono text-[11px] leading-relaxed'>
              <code>{snippet}</code>
            </pre>
          </div>
          <p className='text-muted-foreground px-3 py-2 text-[11px]'>
            {t(
              'Replace the key and model name with your own to start calling.'
            )}
          </p>
        </div>
      </div>

      <ol className='mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3'>
        {steps.map((step, index) => (
          <li
            key={step.title}
            className='border-border/60 rounded-xl border p-5'
          >
            <span className='text-muted-foreground font-mono text-xs tabular-nums'>
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className='mt-3 text-sm font-semibold tracking-tight'>
              {t(step.title)}
            </h3>
            <p className='text-muted-foreground mt-1.5 text-xs leading-relaxed'>
              {t(step.description)}
            </p>
            {step.href ? (
              <a
                href={step.href}
                target='_blank'
                rel='noopener noreferrer'
                className='text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1 text-xs font-medium transition-colors'
              >
                {t(step.actionLabel)}
                <ArrowRight className='size-3.5' aria-hidden='true' />
              </a>
            ) : (
              <Link
                to={step.to ?? '/'}
                className='text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1 text-xs font-medium transition-colors'
              >
                {t(step.actionLabel)}
                <ArrowRight className='size-3.5' aria-hidden='true' />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
