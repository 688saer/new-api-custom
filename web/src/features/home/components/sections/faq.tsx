import { useTranslation } from 'react-i18next'

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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const FAQ_KEYS = [
  {
    question: 'What is an AI gateway?',
    answer:
      'An AI gateway is the single layer between your application and the model providers. This site exposes compatible endpoints, applies your key, group and channel settings, and records usage in one console.',
  },
  {
    question: 'How do I connect a client to this site?',
    answer:
      'Fill in the base URL, an API key and an available model name in your client. Different tools configure this differently; follow your client documentation and the integration notes in the console.',
  },
  {
    question: 'Which models and protocols are supported?',
    answer:
      'The gateway speaks OpenAI, Anthropic and Gemini protocols. Which models you can actually reach depends on your account, group and key configuration.',
  },
  {
    question: 'Where do I check cost and subscriptions?',
    answer:
      'Once signed in, usage records show per-request tokens and cost, while the wallet and subscription pages hold balance and service records.',
  },
  {
    question: 'How do I get started?',
    answer:
      'Create an account, sign in, issue an API key in the console, then point your client at this site with that key.',
  },
] as const

/**
 * Frequently asked questions as a collapsible list, so answers stay one click
 * away without stretching the landing page.
 */
export function Faq() {
  const { t } = useTranslation()

  return (
    <section
      id='faq'
      className='border-border/60 mx-auto w-full max-w-6xl scroll-mt-24 border-t px-6 py-12 md:py-16'
    >
      <div className='grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-12'>
        <div>
          <p className='text-muted-foreground font-mono text-xs tracking-[0.05em]'>
            {t('Help and guides')}
          </p>
          <h2 className='mt-4 text-2xl font-semibold tracking-tight md:text-3xl'>
            {t('Frequently asked questions')}
          </h2>
          <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
            {t(
              'From connecting a client to reading usage, start with these answers.'
            )}
          </p>
        </div>

        <Accordion className='min-w-0'>
          {FAQ_KEYS.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger className='text-left text-sm font-medium'>
                {t(item.question)}
              </AccordionTrigger>
              <AccordionContent className='text-muted-foreground text-sm leading-relaxed'>
                {t(item.answer)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
