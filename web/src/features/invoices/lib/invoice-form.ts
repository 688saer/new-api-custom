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
import { z } from 'zod'

/** 开票申请表单校验，与后端 CreateInvoice 的规则保持一致 */
export const invoiceFormSchema = z
  .object({
    title_type: z.enum(['personal', 'company']),
    title_name: z
      .string()
      .trim()
      .min(1, 'Enter the invoice title')
      .max(100, 'The invoice title is too long'),
    tax_id: z.string().trim().max(64, 'The tax ID is too long'),
    email: z
      .string()
      .trim()
      .min(1, 'Enter the email that receives the invoice')
      .email('Enter a valid email address')
      .max(128, 'The email address is too long'),
    phone: z.string().trim().max(32, 'The phone number is too long'),
    amount: z
      .string()
      .trim()
      .min(1, 'Enter the amount you want invoiced')
      .refine((value) => Number(value) > 0, 'Enter an amount greater than 0'),
    content: z.string().trim().max(64, 'The invoice item is too long'),
    remark: z.string().trim().max(500, 'The remark is too long'),
  })
  .refine(
    (values) => values.title_type !== 'company' || values.tax_id.length > 0,
    {
      path: ['tax_id'],
      message: 'A company invoice needs a tax ID',
    }
  )

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>

export const defaultInvoiceFormValues: InvoiceFormValues = {
  title_type: 'personal',
  title_name: '',
  tax_id: '',
  email: '',
  phone: '',
  amount: '',
  content: '技术服务费',
  remark: '',
}
