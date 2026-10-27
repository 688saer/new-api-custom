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
import { describe, expect, it } from 'vitest'

import {
  agentHasPermission,
  permissionLabelKey,
  roleLabelKey,
  TICKET_AGENT_ROLES,
  type TicketAgentAccount,
} from '../types'

function makeAgent(overrides: Partial<TicketAgentAccount>): TicketAgentAccount {
  return {
    id: 1,
    username: 'agent',
    display_name: 'Agent',
    role: 'agent',
    permissions: [],
    enabled: true,
    last_login_at: 0,
    last_login_ip: '',
    created_at: 0,
    locked_until: 0,
    ...overrides,
  }
}

describe('console account permissions', () => {
  it('grants owners every permission regardless of the stored list', () => {
    const owner = makeAgent({ role: 'owner', permissions: [] })
    expect(agentHasPermission(owner, 'settings.manage')).toBe(true)
    expect(agentHasPermission(owner, 'agents.manage')).toBe(true)
  })

  it('honours the stored permission list for non-owners', () => {
    const agent = makeAgent({ permissions: ['tickets.reply'] })
    expect(agentHasPermission(agent, 'tickets.reply')).toBe(true)
    expect(agentHasPermission(agent, 'agents.manage')).toBe(false)
  })

  it('denies everything when there is no account', () => {
    expect(agentHasPermission(null, 'tickets.reply')).toBe(false)
    expect(agentHasPermission(undefined, 'tickets.view_all')).toBe(false)
  })

  it('gives every role and permission a label key', () => {
    for (const role of TICKET_AGENT_ROLES) {
      expect(roleLabelKey(role).length).toBeGreaterThan(0)
    }
    expect(permissionLabelKey('tickets.close').length).toBeGreaterThan(0)
    expect(permissionLabelKey('settings.manage')).not.toBe(
      permissionLabelKey('agents.manage')
    )
  })
})
