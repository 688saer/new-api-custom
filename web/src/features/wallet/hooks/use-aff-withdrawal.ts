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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import i18next from 'i18next'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { getSelf } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import {
  getServerMessage,
  requireServerSuccess,
} from '@/lib/server-error-message'

import { createAffWithdrawal, listMyAffWithdrawals } from '../api'

// ============================================================================
// Affiliate Withdrawal Hook
// ============================================================================

export function useAffWithdrawal() {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: ['aff-withdrawals'],
    queryFn: async () => {
      const response = requireServerSuccess(await listMyAffWithdrawals(1, 20))
      return response.data ?? { items: [], total: 0, page: 1, page_size: 20 }
    },
  })

  const createMutation = useMutation({
    mutationFn: (request: { quota: number; account: string; name: string }) =>
      createAffWithdrawal(request),
    onSuccess: async (response) => {
      if (response.success) {
        toast.success(
          getServerMessage(response) ||
            i18next.t('Withdrawal request submitted')
        )
        await getSelf()
        await queryClient.invalidateQueries({ queryKey: ['aff-withdrawals'] })
      } else {
        handleServerError(
          response,
          i18next.t('Failed to submit the withdrawal request')
        )
      }
    },
    onError: (error) => {
      handleServerError(
        error,
        i18next.t('Failed to submit the withdrawal request')
      )
    },
  })

  const withdrawToAlipay = useCallback(
    async (quota: number, account: string, name: string): Promise<boolean> => {
      const response = await createMutation.mutateAsync({
        quota,
        account,
        name,
      })
      return response.success === true
    },
    [createMutation]
  )

  return {
    withdrawals: listQuery.data?.items ?? [],
    loading: listQuery.isLoading,
    submitting: createMutation.isPending,
    withdrawToAlipay,
  }
}
