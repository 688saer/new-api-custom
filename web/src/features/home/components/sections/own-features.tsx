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
  ArrowUpRight,
  Brush,
  Gift,
  LifeBuoy,
  Megaphone,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  Ticket,
  Webhook,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface OwnFeature {
  key: string
  title: string
  description: string
  icon: LucideIcon
  /** Omitted for features configured inside other pages rather than a route. */
  to?: string
}

const OWN_FEATURES: OwnFeature[] = [
  {
    key: 'lottery',
    title: 'Lucky draw',
    description: 'Daily free draws with configurable prizes and quotas.',
    icon: PartyPopper,
    to: '/lottery',
  },
  {
    key: 'welfare-chests',
    title: 'Welfare chests',
    description: 'Weekly chests that hand out quota and log the result.',
    icon: Gift,
    to: '/welfare-chests',
  },
  {
    key: 'welfare-apis',
    title: 'Welfare API',
    description: 'A public endpoint listing the free models on offer.',
    icon: Webhook,
    to: '/welfare-apis',
  },
  {
    key: 'service-status',
    title: 'Channel availability',
    description: 'Scheduled probes with latency history for every channel.',
    icon: ShieldCheck,
    to: '/service-status',
  },
  {
    key: 'canvas',
    title: 'Infinite canvas',
    description: 'An unbounded board for arranging prompts and results.',
    icon: Brush,
    to: '/canvas',
  },
  {
    key: 'announcements',
    title: 'Announcement centre',
    description: 'Operator notices, pinned and archived in one timeline.',
    icon: Megaphone,
    to: '/announcements',
  },
  {
    key: 'rewards',
    title: 'My rewards',
    description: 'Reward tickets with a claim window, redeemed to balance.',
    icon: Ticket,
    to: '/rewards',
  },
  {
    key: 'tickets',
    title: 'Support tickets',
    description: 'Ask for help in threads, with a separate console for staff.',
    icon: LifeBuoy,
    to: '/tickets',
  },
  {
    key: 'geetest',
    title: 'Geetest verification',
    description: 'Slide verification on login, registration and reset.',
    icon: ShieldCheck,
  },
  {
    key: 'mascot',
    title: 'Site mascot',
    description: 'An animated companion docked beside the console.',
    icon: Sparkles,
    to: '/profile',
  },
]

/**
 * Entries for the features this deployment adds on top of the upstream
 * gateway, so they stay discoverable from the landing page.
 */
export function OwnFeatures() {
  const { t } = useTranslation()

  return (
    <section
      id='own-features'
      className='mx-auto w-full max-w-6xl scroll-mt-24 px-6 py-12 md:py-16'
    >
      <div className='max-w-2xl'>
        <p className='text-muted-foreground font-mono text-xs tracking-[0.05em]'>
          {t('Beyond the gateway')}
        </p>
        <h2 className='mt-4 text-2xl font-semibold tracking-tight md:text-3xl'>
          {t('Features this site adds')}
        </h2>
        <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
          {t(
            'Extra modules maintained for this deployment, each reachable from the sidebar.'
          )}
        </p>
      </div>

      <ul className='mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {OWN_FEATURES.map((feature) => {
          const Icon = feature.icon
          const body = (
            <>
              <span className='bg-muted/60 text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-xl'>
                <Icon className='size-4' aria-hidden='true' />
              </span>
              <span className='min-w-0'>
                <span className='flex items-center gap-1 text-sm font-semibold tracking-tight'>
                  {t(feature.title)}
                  {feature.to ? (
                    <ArrowUpRight
                      className='text-muted-foreground size-3.5'
                      aria-hidden='true'
                    />
                  ) : null}
                </span>
                <span className='text-muted-foreground mt-1 block text-xs leading-relaxed'>
                  {t(feature.description)}
                </span>
              </span>
            </>
          )

          return (
            <li key={feature.key}>
              {feature.to ? (
                <Link
                  to={feature.to}
                  className='border-border/60 hover:border-border hover:bg-muted/30 flex items-start gap-3 rounded-xl border p-4 transition-colors'
                >
                  {body}
                </Link>
              ) : (
                <div className='border-border/60 flex items-start gap-3 rounded-xl border p-4'>
                  {body}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
