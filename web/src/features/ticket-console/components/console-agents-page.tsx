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
import { KeyRound, Loader2, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatTimestampToDate } from '@/lib/format'

import {
  useConsoleAgentMutations,
  useConsoleAgents,
} from '../hooks/use-console'
import {
  TICKET_AGENT_ROLES,
  permissionLabelKey,
  roleLabelKey,
  type TicketAgentAccount,
  type TicketAgentRole,
  type TicketPermission,
} from '../types'

const ALL_PERMISSIONS: TicketPermission[] = [
  'tickets.view_all',
  'tickets.reply',
  'tickets.assign',
  'tickets.close',
  'agents.manage',
  'settings.manage',
]

type AgentDraft = {
  username: string
  display_name: string
  password: string
  role: TicketAgentRole
  permissions: TicketPermission[]
  enabled: boolean
}

const EMPTY_DRAFT: AgentDraft = {
  username: '',
  display_name: '',
  password: '',
  role: 'agent',
  permissions: ['tickets.reply'],
  enabled: true,
}

/** 后台账号管理：独立账号、角色与权限点。 */
export function ConsoleAgentsPage() {
  const { t } = useTranslation()
  const agentsQuery = useConsoleAgents(true)
  const mutations = useConsoleAgentMutations()

  const [editing, setEditing] = useState<TicketAgentAccount | null>(null)
  const [draft, setDraft] = useState<AgentDraft>(EMPTY_DRAFT)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [passwordTarget, setPasswordTarget] =
    useState<TicketAgentAccount | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<TicketAgentAccount | null>(
    null
  )

  const accounts = agentsQuery.data?.items ?? []
  const saving = mutations.create.isPending || mutations.update.isPending

  function reportError(error: unknown) {
    toast.error(error instanceof Error ? error.message : t('Action failed'))
  }

  function openCreate() {
    setEditing(null)
    setDraft(EMPTY_DRAFT)
    setDialogOpen(true)
  }

  function openEdit(account: TicketAgentAccount) {
    setEditing(account)
    setDraft({
      username: account.username,
      display_name: account.display_name,
      password: '',
      role: account.role,
      permissions: account.permissions,
      enabled: account.enabled,
    })
    setDialogOpen(true)
  }

  function togglePermission(permission: TicketPermission) {
    setDraft((previous) => {
      const has = previous.permissions.includes(permission)
      return {
        ...previous,
        permissions: has
          ? previous.permissions.filter((item) => item !== permission)
          : [...previous.permissions, permission],
      }
    })
  }

  function save() {
    if (editing) {
      mutations.update.mutate(
        {
          id: editing.id,
          display_name: draft.display_name.trim(),
          role: draft.role,
          permissions: draft.permissions,
          enabled: draft.enabled,
        },
        {
          onSuccess: () => {
            setDialogOpen(false)
            toast.success(t('Account updated'))
          },
          onError: reportError,
        }
      )
      return
    }

    mutations.create.mutate(
      {
        username: draft.username.trim(),
        display_name: draft.display_name.trim() || draft.username.trim(),
        password: draft.password,
        role: draft.role,
        permissions: draft.permissions,
      },
      {
        onSuccess: () => {
          setDialogOpen(false)
          toast.success(t('Account created'))
        },
        onError: reportError,
      }
    )
  }

  const canSave = editing
    ? draft.display_name.trim().length > 0
    : draft.username.trim().length > 0 && draft.password.length >= 8

  // Base UI 的 Select 需要 items 才能把值渲染成标签
  const roleItems = useMemo(
    () =>
      TICKET_AGENT_ROLES.map((role) => ({
        value: role as string,
        label: t(roleLabelKey(role)),
      })),
    [t]
  )

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3'>
      <div className='flex items-center justify-between gap-2'>
        <div>
          <h2 className='text-base font-semibold'>{t('Console accounts')}</h2>
          <p className='text-muted-foreground text-xs'>
            {t(
              'These accounts only open this console. They cannot sign in to the site, and site users cannot sign in here.'
            )}
          </p>
        </div>
        <Button type='button' size='sm' onClick={openCreate}>
          <Plus className='size-4' aria-hidden='true' />
          {t('New account')}
        </Button>
      </div>

      <div className='min-h-0 flex-1 overflow-auto rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Account')}</TableHead>
              <TableHead>{t('Role')}</TableHead>
              <TableHead>{t('Permissions')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Last sign-in')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => (
              <TableRow key={account.id}>
                <TableCell>
                  <div className='font-medium'>
                    {account.display_name || account.username}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {account.username}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant='outline'>
                    {t(roleLabelKey(account.role))}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className='flex max-w-72 flex-wrap gap-1'>
                    {account.role === 'owner' ? (
                      <Badge variant='secondary'>{t('All permissions')}</Badge>
                    ) : (
                      account.permissions.map((permission) => (
                        <Badge key={permission} variant='ghost'>
                          {t(permissionLabelKey(permission))}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {account.enabled ? (
                    <Badge variant='secondary'>{t('Enabled')}</Badge>
                  ) : (
                    <Badge variant='outline'>{t('Disabled')}</Badge>
                  )}
                </TableCell>
                <TableCell className='text-muted-foreground text-xs'>
                  {formatTimestampToDate(account.last_login_at)}
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-1'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      onClick={() => openEdit(account)}
                    >
                      {t('Edit')}
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      aria-label={t('Reset password')}
                      onClick={() => {
                        setPasswordTarget(account)
                        setNewPassword('')
                      }}
                    >
                      <KeyRound className='size-4' aria-hidden='true' />
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      aria-label={t('Delete account')}
                      disabled={account.role === 'owner'}
                      onClick={() => setDeleteTarget(account)}
                    >
                      <Trash2 className='size-4' aria-hidden='true' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>
              {editing ? t('Edit account') : t('New console account')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'Console accounts are stored separately from site users and sign in only here.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='agent-username'>{t('Username')}</Label>
              <Input
                id='agent-username'
                value={draft.username}
                disabled={editing != null}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    username: event.target.value,
                  }))
                }
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='agent-display-name'>{t('Display name')}</Label>
              <Input
                id='agent-display-name'
                value={draft.display_name}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    display_name: event.target.value,
                  }))
                }
                placeholder={t('Shown on replies to users')}
              />
            </div>

            {!editing && (
              <div className='space-y-2'>
                <Label htmlFor='agent-password'>{t('Password')}</Label>
                <Input
                  id='agent-password'
                  type='password'
                  autoComplete='new-password'
                  value={draft.password}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      password: event.target.value,
                    }))
                  }
                />
                <p className='text-muted-foreground text-xs'>
                  {t('At least 8 characters.')}
                </p>
              </div>
            )}

            <div className='space-y-2'>
              <Label htmlFor='agent-role'>{t('Role')}</Label>
              <Select
                items={roleItems}
                value={draft.role}
                onValueChange={(value) =>
                  setDraft((previous) => ({
                    ...previous,
                    role: value as TicketAgentRole,
                  }))
                }
              >
                <SelectTrigger id='agent-role' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label>{t('Permissions')}</Label>
              <div className='grid gap-2 sm:grid-cols-2'>
                {ALL_PERMISSIONS.map((permission) => (
                  <label
                    key={permission}
                    className='flex items-center gap-2 text-sm'
                  >
                    <Switch
                      checked={draft.permissions.includes(permission)}
                      onCheckedChange={() => togglePermission(permission)}
                      disabled={draft.role === 'owner'}
                    />
                    {t(permissionLabelKey(permission))}
                  </label>
                ))}
              </div>
              {draft.role === 'owner' && (
                <p className='text-muted-foreground text-xs'>
                  {t('Owners always have every permission.')}
                </p>
              )}
            </div>

            {editing && (
              <label className='flex items-center gap-2 text-sm'>
                <Switch
                  checked={draft.enabled}
                  onCheckedChange={(checked) =>
                    setDraft((previous) => ({ ...previous, enabled: checked }))
                  }
                />
                {t('Account enabled')}
              </label>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              {t('Cancel')}
            </Button>
            <Button type='button' disabled={!canSave || saving} onClick={save}>
              {saving && (
                <Loader2 className='size-4 animate-spin' aria-hidden='true' />
              )}
              {t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordTarget != null}
        onOpenChange={(open) => {
          if (!open) setPasswordTarget(null)
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('Reset password')}</DialogTitle>
            <DialogDescription>
              {t('Set a new password for {{name}}.', {
                name:
                  passwordTarget?.display_name ||
                  passwordTarget?.username ||
                  '',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='agent-new-password'>{t('New password')}</Label>
            <Input
              id='agent-new-password'
              type='password'
              autoComplete='new-password'
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setPasswordTarget(null)}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              disabled={
                newPassword.length < 8 || mutations.resetPassword.isPending
              }
              onClick={() => {
                if (!passwordTarget) return
                mutations.resetPassword.mutate(
                  { id: passwordTarget.id, password: newPassword },
                  {
                    onSuccess: () => {
                      setPasswordTarget(null)
                      toast.success(t('Password updated'))
                    },
                    onError: reportError,
                  }
                )
              }}
            >
              {t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('Delete this account?')}
        desc={t(
          'The account loses access immediately. Tickets it replied to stay intact.'
        )}
        destructive
        confirmText={t('Delete')}
        isLoading={mutations.remove.isPending}
        handleConfirm={() => {
          if (!deleteTarget) return
          mutations.remove.mutate(deleteTarget.id, {
            onSuccess: () => {
              setDeleteTarget(null)
              toast.success(t('Account deleted'))
            },
            onError: reportError,
          })
        }}
      />
    </div>
  )
}
