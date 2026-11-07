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
import { api } from '@/lib/api'

import type { AffWithdrawal } from '../wallet/types'

export interface AffWithdrawalAdminListQuery {
  status?: string
  keyword?: string
  page?: number
  pageSize?: number
}

/** 后台提现列表 */
export async function listAffWithdrawalsAdmin(
  query: AffWithdrawalAdminListQuery = {}
) {
  const res = await api.get('/api/aff_withdrawals/', {
    params: {
      status: query.status || undefined,
      keyword: query.keyword || undefined,
      page: query.page ?? 1,
      page_size: query.pageSize ?? 20,
    },
  })
  return res.data as {
    success: boolean
    message?: string
    data?: {
      items: AffWithdrawal[]
      total: number
      page: number
      page_size: number
    }
  }
}

/** 审核：通过（标记已打款）或驳回（退回额度） */
export async function reviewAffWithdrawalAdmin(
  id: number,
  approve: boolean,
  adminNote = ''
) {
  const res = await api.put(`/api/aff_withdrawals/${id}`, {
    approve,
    admin_note: adminNote,
  })
  return res.data as { success: boolean; message?: string }
}
