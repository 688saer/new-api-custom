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
import i18next from 'i18next'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { useStatus } from '@/hooks/use-status'

/** Actions the deployment can guard with a GeeTest challenge. */
export type GeeTestAction =
  | 'register'
  | 'login'
  | 'checkin'
  | 'password_reset'
  | 'email_verify'

/**
 * GeeTest state for one form.
 *
 * The payload is a solved challenge serialized as JSON; the API passes it in
 * the `geetest` query parameter. Each payload is single-use, so callers must
 * call `resetGeetest()` after a rejected request to force a fresh challenge.
 */
export function useGeetest(action: GeeTestAction) {
  const { status } = useStatus()
  const [payload, setPayload] = useState('')

  const captchaId = status?.geetest_captcha_id || ''
  const actionGuarded: Record<GeeTestAction, boolean | undefined> = {
    register: status?.geetest_register_check,
    login: status?.geetest_login_check,
    checkin: status?.geetest_checkin_check,
    password_reset: status?.geetest_password_reset_check,
    email_verify: status?.geetest_email_verify_check,
  }
  const enabled = Boolean(
    status?.geetest_check && captchaId && actionGuarded[action]
  )

  const resetGeetest = useCallback(() => setPayload(''), [])

  const validateGeetest = useCallback(() => {
    if (enabled && !payload) {
      toast.info(i18next.t('Complete the human verification first'))
      return false
    }
    return true
  }, [enabled, payload])

  return {
    geetestEnabled: enabled,
    geetestCaptchaId: captchaId,
    geetestPayload: payload,
    setGeetestPayload: setPayload,
    resetGeetest,
    validateGeetest,
  }
}
