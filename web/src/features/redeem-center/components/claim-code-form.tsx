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
import { Ticket } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import {
  CLAIM_CODE_MAX_LENGTH,
  normalizeClaimCodeInput,
  validateClaimCodeInput,
} from '../lib/claim-codes'

interface ClaimCodeFormProps {
  submitting: boolean
  /** 服务端返回的失败原因（已本地化）。 */
  error: string | null
  onSubmit: (code: string) => void
}

/** 输入口令并提交兑换。 */
export function ClaimCodeForm(props: ClaimCodeFormProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const message = validateClaimCodeInput(value)
    if (message != null) {
      setLocalError(t(message))
      return
    }
    setLocalError(null)
    props.onSubmit(normalizeClaimCodeInput(value))
  }

  const message = localError ?? props.error

  return (
    <form className='space-y-3' onSubmit={handleSubmit}>
      <div className='grid gap-1.5'>
        <Label htmlFor='claim-code-input' required>
          {t('Claim code')}
        </Label>
        <Input
          id='claim-code-input'
          value={value}
          maxLength={CLAIM_CODE_MAX_LENGTH}
          autoComplete='off'
          autoCapitalize='characters'
          spellCheck={false}
          placeholder={t('For example: ABCD-2345-WXYZ')}
          className={cn('font-mono tracking-wider uppercase')}
          onChange={(event) => setValue(event.target.value)}
        />
        <p className='text-muted-foreground text-xs'>
          {t(
            'Codes are not case sensitive. Paste the whole code you received.'
          )}
        </p>
      </div>

      {message != null && (
        <p role='alert' className='text-destructive text-sm'>
          {message}
        </p>
      )}

      <Button type='submit' className='w-full' disabled={props.submitting}>
        <Ticket aria-hidden='true' className='size-4' />
        {props.submitting ? t('Redeeming…') : t('Redeem')}
      </Button>
    </form>
  )
}
