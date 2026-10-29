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

import type {
  PurchaseAgreement,
  PurchaseAgreementConfirmResult,
  PurchaseAgreementSignResponse,
  PurchaseScene,
} from './types'

/**
 * 询问服务端这一场景是否需要签署协议。
 * 返回 allowed=false 时，响应里带出协议正文，交给弹窗展示。
 */
export async function confirmPurchaseAgreement(
  scene: PurchaseScene
): Promise<PurchaseAgreementConfirmResult> {
  const res = await api.post('/api/user/purchase-agreement/confirm', { scene })
  const body = res.data as {
    success?: boolean
    code?: string
    agreement?: PurchaseAgreement
  }

  if (body?.success) {
    return { allowed: true, agreement: body.agreement ?? null }
  }
  if (body?.code === 'AGREEMENT_REQUIRED') {
    return { allowed: false, agreement: body.agreement ?? null }
  }
  // 接口异常时不阻断购买流程，但也不会记录签署
  return { allowed: true, agreement: null }
}

/** 记录当前用户对本场景协议的同意 */
export async function signPurchaseAgreement(
  scene: PurchaseScene
): Promise<PurchaseAgreementSignResponse> {
  const res = await api.post('/api/user/purchase-agreement/sign', { scene })
  return res.data as PurchaseAgreementSignResponse
}
