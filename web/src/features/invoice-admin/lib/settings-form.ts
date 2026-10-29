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

/** 发票模块设置表单。金额按字符串保存，空串表示不限制。 */
export const invoiceSettingSchema = z.object({
  enabled: z.boolean(),
  seller_name: z.string().trim().max(120, 'The seller name is too long'),
  contact: z.string().trim().max(120, 'The contact is too long'),
  notice: z.string().trim().max(1000, 'The notice is too long'),
  min_amount: z.string().trim(),
  max_amount: z.string().trim(),
  max_pending_per_user: z.string().trim(),
})

export type InvoiceSettingValues = z.infer<typeof invoiceSettingSchema>

/** 购买协议设置表单 */
export const agreementSettingSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1, 'Enter the agreement title').max(120),
  version: z.string().trim().min(1, 'Enter a version').max(32),
  content: z.string().trim().min(1, 'The agreement text cannot be empty'),
  require_for_redemption: z.boolean(),
  require_for_topup: z.boolean(),
  require_for_subscription: z.boolean(),
})

export type AgreementSettingValues = z.infer<typeof agreementSettingSchema>
