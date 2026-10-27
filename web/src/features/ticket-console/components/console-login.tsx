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
import { Headset, Loader2, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { consoleBootstrap } from '../api'
import { useConsoleLogin } from '../hooks/use-console'

type ConsoleLoginProps = {
  onSignedIn: () => void
}

/** 工单后台登录：独立账号体系，与站点用户完全分离。 */
export function ConsoleLogin(props: ConsoleLoginProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [setupOpen, setSetupOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [bootstrapping, setBootstrapping] = useState(false)
  const login = useConsoleLogin(props.onSignedIn)

  const submitting = login.isPending || bootstrapping

  async function handleBootstrap() {
    setError('')
    setBootstrapping(true)
    try {
      await consoleBootstrap({
        username: username.trim(),
        display_name: displayName.trim() || username.trim(),
        password,
      })
      login.mutate({ username: username.trim(), password })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Action failed'))
    } finally {
      setBootstrapping(false)
    }
  }

  return (
    <div className='bg-muted/30 flex min-h-screen items-center justify-center px-4 py-10'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <div className='bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-lg'>
            <Headset className='size-5' aria-hidden='true' />
          </div>
          <CardTitle>{t('Ticket console')}</CardTitle>
          <CardDescription>
            {t(
              'Sign in with a console account. These accounts are separate from site users.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className='space-y-4'
            onSubmit={(event) => {
              event.preventDefault()
              setError('')
              login.mutate(
                { username: username.trim(), password },
                {
                  onError: (cause) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : t('Action failed')
                    ),
                }
              )
            }}
          >
            <div className='space-y-2'>
              <Label htmlFor='console-username'>{t('Username')}</Label>
              <Input
                id='console-username'
                autoComplete='username'
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>

            {setupOpen && (
              <div className='space-y-2'>
                <Label htmlFor='console-display-name'>
                  {t('Display name')}
                </Label>
                <Input
                  id='console-display-name'
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={t('Shown on replies to users')}
                />
              </div>
            )}

            <div className='space-y-2'>
              <Label htmlFor='console-password'>{t('Password')}</Label>
              <Input
                id='console-password'
                type='password'
                autoComplete={setupOpen ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {error !== '' && (
              <p className='text-destructive text-sm' role='alert'>
                {error}
              </p>
            )}

            <Button
              type={setupOpen ? 'button' : 'submit'}
              className='w-full'
              disabled={submitting}
              onClick={setupOpen ? handleBootstrap : undefined}
            >
              {submitting && (
                <Loader2 className='size-4 animate-spin' aria-hidden='true' />
              )}
              {setupOpen ? t('Create the first owner') : t('Sign in')}
            </Button>
          </form>

          <div className='mt-6 border-t pt-4'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-muted-foreground w-full'
              onClick={() => {
                setSetupOpen((previous) => !previous)
                setError('')
              }}
            >
              <ShieldCheck className='size-4' aria-hidden='true' />
              {setupOpen
                ? t('Back to sign in')
                : t('First time here? Create the owner account')}
            </Button>
            {setupOpen && (
              <p className='text-muted-foreground mt-2 text-xs'>
                {t(
                  'This only works while no console account exists. Once one exists, an owner creates the rest inside the console.'
                )}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
