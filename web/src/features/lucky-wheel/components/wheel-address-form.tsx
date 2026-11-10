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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface WheelAddressValues {
  receiver_name: string
  receiver_phone: string
  receiver_address: string
}

interface WheelAddressFormProps {
  initial?: Partial<WheelAddressValues>
  submitting: boolean
  /** 服务端或本地校验失败时的文案（已本地化）。 */
  error: string | null
  submitLabel: string
  onSubmit: (values: WheelAddressValues) => void
}

/** 实物奖品收货信息表单，抽奖结果弹窗与中奖记录共用。 */
export function WheelAddressForm(props: WheelAddressFormProps) {
  const { t } = useTranslation()
  const [name, setName] = useState(props.initial?.receiver_name ?? '')
  const [phone, setPhone] = useState(props.initial?.receiver_phone ?? '')
  const [address, setAddress] = useState(props.initial?.receiver_address ?? '')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name.trim() === '' || phone.trim() === '' || address.trim() === '') {
      setLocalError(t('Fill in the recipient name, phone number and address'))
      return
    }
    setLocalError(null)
    props.onSubmit({
      receiver_name: name.trim(),
      receiver_phone: phone.trim(),
      receiver_address: address.trim(),
    })
  }

  const message = localError ?? props.error

  return (
    <form className='space-y-3' onSubmit={handleSubmit}>
      <div className='grid gap-1.5'>
        <Label htmlFor='wheel-receiver-name' required>
          {t('Recipient name')}
        </Label>
        <Input
          id='wheel-receiver-name'
          value={name}
          maxLength={64}
          autoComplete='name'
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className='grid gap-1.5'>
        <Label htmlFor='wheel-receiver-phone' required>
          {t('Phone number')}
        </Label>
        <Input
          id='wheel-receiver-phone'
          value={phone}
          maxLength={32}
          inputMode='tel'
          autoComplete='tel'
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>
      <div className='grid gap-1.5'>
        <Label htmlFor='wheel-receiver-address' required>
          {t('Shipping address')}
        </Label>
        <Textarea
          id='wheel-receiver-address'
          value={address}
          maxLength={255}
          rows={3}
          placeholder={t('Province, city, district and street address')}
          onChange={(event) => setAddress(event.target.value)}
        />
      </div>
      {message != null && (
        <p role='alert' className='text-destructive text-sm'>
          {message}
        </p>
      )}
      <Button type='submit' className='w-full' disabled={props.submitting}>
        {props.submitting ? t('Submitting…') : props.submitLabel}
      </Button>
    </form>
  )
}
