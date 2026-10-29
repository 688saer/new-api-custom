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
import { create } from 'zustand'

import { confirmPurchaseAgreement } from '../api'
import type { PurchaseAgreement, PurchaseScene } from '../types'

interface AgreementRequest {
  scene: PurchaseScene
  agreement: PurchaseAgreement
  resolve: (allowed: boolean) => void
}

interface AgreementGateState {
  request: AgreementRequest | null
  open: (request: AgreementRequest) => void
  settle: (allowed: boolean) => void
}

/**
 * 协议弹窗的打开请求。购买动作用 Promise 等待用户在这里给出的答复，
 * 因此弹窗渲染在页面里（PurchaseAgreementGate），不依赖某个组件树。
 */
export const useAgreementGate = create<AgreementGateState>((set, get) => ({
  request: null,
  open: (request) => set({ request }),
  settle: (allowed) => {
    const current = get().request
    set({ request: null })
    current?.resolve(allowed)
  },
}))

/**
 * 购买前的协议闸门：服务端说需要签署时弹窗等待用户同意。
 *
 * 返回 false 表示用户放弃购买，调用方必须中止后续支付/兑换请求。
 * 协议正文取不到时放行，避免服务端异常连带整站无法购买。
 */
export async function ensurePurchaseAgreement(
  scene: PurchaseScene
): Promise<boolean> {
  const result = await confirmPurchaseAgreement(scene)
  if (result.allowed) {
    return true
  }
  if (!result.agreement) {
    return true
  }
  return new Promise<boolean>((resolve) => {
    useAgreementGate.getState().open({
      scene,
      agreement: result.agreement as PurchaseAgreement,
      resolve,
    })
  })
}
