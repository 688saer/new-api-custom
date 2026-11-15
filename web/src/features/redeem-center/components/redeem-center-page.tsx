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
import { Gift, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import type { ShippingAddressValues } from '@/components/shipping-address-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import {
  getMyClaimCodeClaims,
  redeemClaimCode,
  submitClaimCodeAddress,
} from '../api'
import type { ClaimCodeClaim } from '../types'
import { ClaimAddressDialog } from './claim-address-dialog'
import { ClaimCodeForm } from './claim-code-form'
import { ClaimResultDialog } from './claim-result-dialog'
import { MyClaimList } from './my-claim-list'

const CLAIM_PAGE_SIZE = 5

/** 兑换中心：输入口令领取奖品，并查看自己的兑换记录。 */
export function RedeemCenter() {
  const { t } = useTranslation()

  const [claims, setClaims] = useState<ClaimCodeClaim[]>([])
  const [total, setTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [claimed, setClaimed] = useState<ClaimCodeClaim | null>(null)

  const [addressSubmitting, setAddressSubmitting] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [addressTarget, setAddressTarget] = useState<ClaimCodeClaim | null>(
    null
  )

  const loadClaims = useCallback(
    async (targetPage: number) => {
      setListLoading(true)
      const res = await getMyClaimCodeClaims(targetPage, CLAIM_PAGE_SIZE)
      if (res?.success && res.data) {
        setClaims(res.data.items ?? [])
        setTotal(res.data.total ?? 0)
        setListError(null)
      } else {
        setListError(res?.message || t('Failed to load claim records'))
      }
      setListLoading(false)
    },
    [t]
  )

  useEffect(() => {
    void loadClaims(page)
  }, [loadClaims, page])

  const handleRedeem = async (code: string) => {
    setSubmitting(true)
    setFormError(null)
    const res = await redeemClaimCode(code)
    setSubmitting(false)
    if (res?.success && res.data) {
      setClaimed(res.data)
      setPage(1)
      await loadClaims(1)
      return
    }
    setFormError(res?.message || t('Failed to redeem this claim code'))
  }

  const applyAddress = async (
    claimId: number,
    values: ShippingAddressValues
  ) => {
    setAddressSubmitting(true)
    setAddressError(null)
    const res = await submitClaimCodeAddress(claimId, values)
    setAddressSubmitting(false)
    if (res?.success && res.data) {
      if (claimed != null && claimed.id === claimId) {
        setClaimed(res.data)
      }
      setAddressTarget(null)
      await loadClaims(page)
      return
    }
    setAddressError(res?.message || t('Failed to save the shipping address'))
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Redeem center')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-6'>
          <Card className='overflow-hidden'>
            <CardContent className='bg-[radial-gradient(circle_at_top_left,#7c2d12_0%,#1c1917_60%)] py-8 text-white'>
              <p className='flex items-center gap-2 text-xs font-medium tracking-widest text-white/80 uppercase'>
                <Sparkles aria-hidden='true' className='size-3.5' />
                {t('Claim code')}
              </p>
              <h2 className='mt-1 text-2xl font-black sm:text-3xl'>
                {t('Redeem your gift in one step')}
              </h2>
              <p className='mt-2 max-w-2xl text-sm text-white/85'>
                {t(
                  'Enter the claim code you received to redeem balance, subscription plans, virtual products or physical prizes.'
                )}
              </p>
            </CardContent>
          </Card>

          <div className='grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Gift aria-hidden='true' className='size-4' />
                  {t('Redeem a claim code')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ClaimCodeForm
                  submitting={submitting}
                  error={formError}
                  onSubmit={(code) => void handleRedeem(code)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-base'>{t('My claims')}</CardTitle>
              </CardHeader>
              <CardContent>
                <MyClaimList
                  claims={claims}
                  total={total}
                  loading={listLoading}
                  error={listError}
                  page={page}
                  pageSize={CLAIM_PAGE_SIZE}
                  onPageChange={setPage}
                  onFillAddress={(claim) => {
                    setAddressError(null)
                    setAddressTarget(claim)
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <ClaimResultDialog
          claim={claimed}
          addressSubmitting={addressSubmitting}
          addressError={addressError}
          onOpenChange={(open) => {
            if (!open) {
              setClaimed(null)
              setAddressError(null)
            }
          }}
          onSubmitAddress={(values) => {
            if (claimed != null) {
              void applyAddress(claimed.id, values)
            }
          }}
        />

        <ClaimAddressDialog
          claim={addressTarget}
          submitting={addressSubmitting}
          error={addressError}
          onOpenChange={(open) => {
            if (!open) {
              setAddressTarget(null)
              setAddressError(null)
            }
          }}
          onSubmit={(values) => {
            if (addressTarget != null) {
              void applyAddress(addressTarget.id, values)
            }
          }}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
