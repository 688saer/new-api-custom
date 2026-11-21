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
import type { TFunction } from 'i18next'

import { formatQuota } from '@/lib/format'

import type { AdminEnabledApiKey, AdminEnabledApiKeyUser } from '../types'

/** The key a row shows: the masked value is what the board may reveal freely. */
export function maskedKeyText(apiKey: AdminEnabledApiKey): string {
  return `sk-${apiKey.masked_key}`
}

/** Whether a key can still serve requests: enabled, unexpired, and funded. */
export function isKeyUsable(apiKey: AdminEnabledApiKey, nowSeconds: number) {
  if (apiKey.expired_time !== -1 && apiKey.expired_time <= nowSeconds) {
    return false
  }
  if (apiKey.unlimited_quota) return true
  return apiKey.remain_quota > 0
}

function expiryText(apiKey: AdminEnabledApiKey, t: TFunction): string {
  if (apiKey.expired_time === -1) {
    return t('Never expires')
  }
  return new Date(apiKey.expired_time * 1000).toISOString()
}

/**
 * One key as pasteable text: what a support reply or a handover note needs,
 * with the value still masked so copying never leaks a secret.
 */
export function formatKeyInfo(
  apiKey: AdminEnabledApiKey,
  options: { t: TFunction; nowSeconds: number; keyValue?: string }
): string {
  const { t } = options
  const rows: [string, string][] = [
    [t('Name'), apiKey.name || `#${apiKey.id}`],
    [t('Key'), options.keyValue ?? maskedKeyText(apiKey)],
    [
      t('Status'),
      isKeyUsable(apiKey, options.nowSeconds) ? t('Usable') : t('Not usable'),
    ],
    [t('Group'), apiKey.group || '-'],
    [
      t('Quota'),
      apiKey.unlimited_quota
        ? t('Unlimited')
        : `${formatQuota(apiKey.remain_quota)} / ${formatQuota(
            apiKey.remain_quota + apiKey.used_quota
          )}`,
    ],
    [
      t('Models'),
      apiKey.model_limits_enabled && apiKey.model_limits
        ? apiKey.model_limits.split(',').filter(Boolean).join(', ')
        : t('All models'),
    ],
    [t('Expires'), expiryText(apiKey, t)],
    [
      t('Last Used'),
      apiKey.accessed_time > 0
        ? new Date(apiKey.accessed_time * 1000).toISOString()
        : t('Never used'),
    ],
  ]
  return rows.map(([label, value]) => `${label}: ${value}`).join('\n')
}

/** A user and every key under them, as one pasteable block. */
export function formatUserKeysInfo(
  user: AdminEnabledApiKeyUser,
  options: { t: TFunction; nowSeconds: number }
): string {
  const { t } = options
  const header = `${user.display_name || user.username} (${user.username} · #${user.user_id})`
  const keys = user.keys.map((key) => formatKeyInfo(key, options)).join('\n\n')
  return `${header}\n${t('Enabled keys')}: ${user.key_count}\n\n${keys}`
}
