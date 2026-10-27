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
import { Inbox, LifeBuoy, Loader2, LogOut, Settings, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  signOutConsole,
  useConsoleCounts,
  useConsoleSession,
} from '../hooks/use-console'
import type { TicketPermission } from '../types'
import { ConsoleAgentsPage } from './console-agents-page'
import { ConsoleLogin } from './console-login'
import { ConsoleQueuePage } from './console-queue-page'
import { ConsoleSettingsPage } from './console-settings-page'

type ConsoleTab = 'queue' | 'agents' | 'settings'

/**
 * 工单后台入口：自带登录、自带导航的独立面板。
 * 它不渲染站点侧边栏，也不依赖站点会话。
 */
export function TicketConsoleApp() {
  const { t } = useTranslation()
  const session = useConsoleSession()
  const [tab, setTab] = useState<ConsoleTab>('queue')
  const counts = useConsoleCounts(session.identity != null)

  if (!session.signedIn) {
    return (
      <ConsoleLogin
        onSignedIn={() => {
          session.markSignedIn()
          void session.refresh()
        }}
      />
    )
  }

  if (session.loading || (!session.identity && session.signedIn)) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <Loader2
          className='text-muted-foreground size-6 animate-spin'
          aria-hidden='true'
        />
        <span className='sr-only'>{t('Loading…')}</span>
      </div>
    )
  }

  const identity = session.identity
  if (!identity) {
    return (
      <ConsoleLogin
        onSignedIn={() => {
          session.markSignedIn()
          void session.refresh()
        }}
      />
    )
  }

  const permissions: TicketPermission[] = identity.permissions
  const isOwner = identity.agent.role === 'owner'
  const canManageAgents = isOwner || permissions.includes('agents.manage')
  const canManageSettings = isOwner || permissions.includes('settings.manage')

  const tabs: {
    id: ConsoleTab
    label: string
    icon: typeof Inbox
    badge?: number
  }[] = [{ id: 'queue', label: t('Queue'), icon: Inbox }]
  if (canManageAgents) {
    tabs.push({ id: 'agents', label: t('Accounts'), icon: Users })
  }
  if (canManageSettings) {
    tabs.push({ id: 'settings', label: t('Settings'), icon: Settings })
  }

  return (
    <div className='bg-muted/20 flex min-h-screen flex-col'>
      <header className='bg-background flex items-center justify-between gap-3 border-b px-4 py-2'>
        <div className='flex items-center gap-2'>
          <div className='bg-primary/10 text-primary flex size-8 items-center justify-center rounded-md'>
            <LifeBuoy className='size-4' aria-hidden='true' />
          </div>
          <div>
            <p className='text-sm font-semibold'>{t('Ticket console')}</p>
            <p className='text-muted-foreground text-xs'>
              {identity.agent.display_name || identity.agent.username}
              {identity.site_admin && (
                <span className='ml-1'>({t('site administrator')})</span>
              )}
            </p>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <Badge variant='outline'>
            {t('Pending')}
            <span className='ml-1 font-semibold'>
              {counts.data?.pending ?? 0}
            </span>
          </Badge>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => {
              void signOutConsole().finally(() => session.markSignedOut())
            }}
          >
            <LogOut className='size-4' aria-hidden='true' />
            {t('Sign out')}
          </Button>
        </div>
      </header>

      <div className='flex items-center gap-1 border-b px-3 py-1.5'>
        {tabs.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type='button'
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
              className={cn(
                'hover:bg-muted flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
                tab === item.id
                  ? 'bg-muted font-medium'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className='size-4' aria-hidden='true' />
              {item.label}
            </button>
          )
        })}
      </div>

      <main className='flex min-h-0 flex-1 flex-col p-3'>
        {tab === 'queue' && (
          <ConsoleQueuePage agents={[]} permissions={identity.permissions} />
        )}
        {tab === 'agents' && canManageAgents && <ConsoleAgentsPage />}
        {tab === 'settings' && canManageSettings && <ConsoleSettingsPage />}
      </main>
    </div>
  )
}
