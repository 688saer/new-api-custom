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
import {
  ArrowRight,
  Gift,
  KeyRound,
  Plug,
  ReceiptText,
  Signal,
  Ticket,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface FeatureCard {
  number: string
  title: string
  description: string
  actionLabel: string
  icon: ReactNode
  /** Route targets use the router; in-page anchors use a plain hash link. */
  to?: string
  hash?: string
}

function buildCards(): FeatureCard[] {
  return [
    {
      number: '01',
      title: 'Unified integration',
      description:
        'Keep OpenAI, Anthropic or Gemini protocols and point existing clients at one gateway.',
      actionLabel: 'See how to connect',
      icon: <Plug className='size-4' aria-hidden='true' />,
      hash: '#integration',
    },
    {
      number: '02',
      title: 'Keys and permissions',
      description:
        'Issue a key per application, each with its own quota, expiry and access scope.',
      actionLabel: 'Manage API keys',
      icon: <KeyRound className='size-4' aria-hidden='true' />,
      to: '/keys',
    },
    {
      number: '03',
      title: 'Usage and billing',
      description:
        'Inspect model, token and cost per request, and review each day of usage.',
      actionLabel: 'View usage records',
      icon: <ReceiptText className='size-4' aria-hidden='true' />,
      to: '/usage-logs',
    },
    {
      number: '04',
      title: 'Rewards and subscriptions',
      description:
        'Collect reward tickets from the operator and track subscriptions and remaining quota.',
      actionLabel: 'Open my rewards',
      icon: <Ticket className='size-4' aria-hidden='true' />,
      to: '/rewards',
    },
    {
      number: '05',
      title: 'Lottery and chests',
      description:
        'Daily draws and weekly chests turn spare quota into a small surprise.',
      actionLabel: 'Try the lottery',
      icon: <Gift className='size-4' aria-hidden='true' />,
      to: '/lottery',
    },
    {
      number: '06',
      title: 'Channel availability',
      description:
        'Live probes show which upstream channels are healthy before you send traffic.',
      actionLabel: 'Check status',
      icon: <Signal className='size-4' aria-hidden='true' />,
      to: '/service-status',
    },
  ]
}

function CardAction(props: { card: FeatureCard; label: string }) {
  const content = (
    <>
      <span>{props.label}</span>
      <ArrowRight
        className='size-3.5 transition-transform duration-200 group-hover/card:translate-x-0.5'
        aria-hidden='true'
      />
    </>
  )

  if (props.card.to) {
    return (
      <Link
        to={props.card.to}
        className='text-muted-foreground group-hover/card:text-foreground mt-4 inline-flex items-center gap-1.5 text-xs font-medium transition-colors'
      >
        {content}
      </Link>
    )
  }

  return (
    <a
      href={props.card.hash}
      className='text-muted-foreground group-hover/card:text-foreground mt-4 inline-flex items-center gap-1.5 text-xs font-medium transition-colors'
    >
      {content}
    </a>
  )
}

/**
 * Six capability cards, mirroring the reference "from integration to daily
 * operations" grid while pointing at this deployment's own routes.
 */
export function FeatureGrid() {
  const { t } = useTranslation()
  const cards = buildCards()

  return (
    <section
      id='features'
      className='mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-12 md:py-16'
    >
      <div className='max-w-2xl'>
        <p className='text-muted-foreground font-mono text-xs tracking-[0.05em]'>
          {t('Around every request')}
        </p>
        <h2 className='mt-4 text-2xl font-semibold tracking-tight md:text-3xl'>
          {t('From integration to daily operations')}
        </h2>
        <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
          {t(
            'Keys, requests and usage live in one workspace, so every step stays traceable.'
          )}
        </p>
      </div>

      <div className='mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {cards.map((card) => (
          <article
            key={card.number}
            className='group/card border-border/60 bg-card/40 hover:border-border relative overflow-hidden rounded-2xl border p-6 transition-colors'
          >
            <div className='text-muted-foreground flex items-center justify-between'>
              <span className='border-border/60 bg-background inline-flex size-9 items-center justify-center rounded-xl border'>
                {card.icon}
              </span>
              <span className='font-mono text-xs tabular-nums'>
                {card.number}
              </span>
            </div>
            <h3 className='mt-5 text-base font-semibold tracking-tight'>
              {t(card.title)}
            </h3>
            <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
              {t(card.description)}
            </p>
            <CardAction card={card} label={t(card.actionLabel)} />
          </article>
        ))}
      </div>
    </section>
  )
}
