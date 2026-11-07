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

import { invoiceFormSchema } from '../lib/invoice-form'

const validValues = {
  title_type: 'personal' as const,
  title_name: '张三',
  tax_id: '',
  email: 'user@example.com',
  phone: '',
  topup_ids: [12],
  content: '技术服务费',
  remark: '',
}

describe('invoiceFormSchema', () => {
  it('accepts a personal request that picks a paid order', () => {
    expect(invoiceFormSchema.safeParse(validValues).success).toBe(true)
  })

  it('rejects a company request that has no tax ID', () => {
    const result = invoiceFormSchema.safeParse({
      ...validValues,
      title_type: 'company',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['tax_id'])
  })

  it('accepts a company request once the tax ID is filled in', () => {
    const result = invoiceFormSchema.safeParse({
      ...validValues,
      title_type: 'company',
      tax_id: '91310000MA1K35Q12X',
    })

    expect(result.success).toBe(true)
  })

  it('rejects a request that picks no order', () => {
    const result = invoiceFormSchema.safeParse({
      ...validValues,
      topup_ids: [],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['topup_ids'])
  })

  it('rejects a malformed receiving email', () => {
    const result = invoiceFormSchema.safeParse({
      ...validValues,
      email: 'not-an-email',
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['email'])
  })
})
