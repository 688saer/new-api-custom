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
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ClaimCodeClaim } from '@/features/redeem-center'
import { getAdminPlans } from '@/features/subscriptions/api'
import { useDebounce } from '@/hooks'
import { formatNumber, formatQuota } from '@/lib/format'

import {
  cancelClaimRecord,
  createClaimCodes,
  deleteClaimCode,
  deliverClaimRecord,
  getClaimCodeGroups,
  getClaimCodeOverview,
  listClaimCodeClaims,
  listClaimCodes,
  shipClaimRecord,
  updateClaimCode,
} from '../api'
import type {
  ClaimCodeClaimFilter,
  ClaimCodeDraft,
  ClaimCodeListFilter,
  ClaimCodeOverview,
  ClaimCodeRow,
  ClaimRecordAction,
} from '../types'
import { CardPoolDialog } from './card-pool-dialog'
import { ClaimCodeFormDialog } from './claim-code-form-dialog'
import { ClaimCodeTable } from './claim-code-table'
import { ClaimRecordActionDialog } from './claim-record-action-dialog'
import { ClaimRecordTable } from './claim-record-table'

const CODE_PAGE_SIZE = 20
const RECORD_PAGE_SIZE = 20

/** 口令后台：概览、口令管理与领取发货。 */
export function ClaimCodeConsole() {
  const { t } = useTranslation()

  const [overview, setOverview] = useState<ClaimCodeOverview | null>(null)

  const [codes, setCodes] = useState<ClaimCodeRow[]>([])
  const [codesTotal, setCodesTotal] = useState(0)
  const [codesLoading, setCodesLoading] = useState(true)
  const [codesError, setCodesError] = useState<string | null>(null)
  const [codeFilter, setCodeFilter] = useState<ClaimCodeListFilter>({
    keyword: '',
    type: '',
    status: 0,
    page: 1,
    pageSize: CODE_PAGE_SIZE,
  })
  const debouncedKeyword = useDebounce(codeFilter.keyword, 400)
  const debouncedStatus = codeFilter.status

  const [plans, setPlans] = useState<{ id: number; title: string }[]>([])
  const [groups, setGroups] = useState<string[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<ClaimCodeRow | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<ClaimCodeRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [cardsTarget, setCardsTarget] = useState<ClaimCodeRow | null>(null)

  const [records, setRecords] = useState<ClaimCodeClaim[]>([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState<string | null>(null)
  const [recordFilter, setRecordFilter] = useState<ClaimCodeClaimFilter>({
    keyword: '',
    type: '',
    status: '',
    page: 1,
    pageSize: RECORD_PAGE_SIZE,
  })
  const debouncedRecordKeyword = useDebounce(recordFilter.keyword, 400)

  const [recordAction, setRecordAction] = useState<{
    action: ClaimRecordAction
    claim: ClaimCodeClaim
  } | null>(null)
  const [recordSubmitting, setRecordSubmitting] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)

  const loadOverview = useCallback(async () => {
    const res = await getClaimCodeOverview()
    if (res?.success && res.data) {
      setOverview(res.data)
    }
  }, [])

  const loadCodes = useCallback(async () => {
    setCodesLoading(true)
    setCodesError(null)
    const res = await listClaimCodes({
      keyword: debouncedKeyword,
      type: codeFilter.type,
      status: debouncedStatus,
      page: codeFilter.page,
      pageSize: codeFilter.pageSize,
    })
    if (res?.success && res.data) {
      setCodes(res.data.items ?? [])
      setCodesTotal(res.data.total ?? 0)
    } else {
      setCodesError(res?.message || t('Failed to load claim codes'))
    }
    setCodesLoading(false)
  }, [
    debouncedKeyword,
    debouncedStatus,
    codeFilter.page,
    codeFilter.pageSize,
    codeFilter.type,
    t,
  ])

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true)
    setRecordsError(null)
    const res = await listClaimCodeClaims({
      keyword: debouncedRecordKeyword,
      type: recordFilter.type,
      status: recordFilter.status,
      page: recordFilter.page,
      pageSize: recordFilter.pageSize,
    })
    if (res?.success && res.data) {
      setRecords(res.data.items ?? [])
      setRecordsTotal(res.data.total ?? 0)
    } else {
      setRecordsError(res?.message || t('Failed to load claim records'))
    }
    setRecordsLoading(false)
  }, [
    debouncedRecordKeyword,
    recordFilter.page,
    recordFilter.pageSize,
    recordFilter.status,
    recordFilter.type,
    t,
  ])

  useEffect(() => {
    void loadCodes()
  }, [loadCodes])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  useEffect(() => {
    void loadOverview()
    const loadOptions = async () => {
      const planRes = await getAdminPlans()
      if (planRes?.success && planRes.data) {
        setPlans(
          planRes.data.map((record) => ({
            id: record.plan.id,
            title: record.plan.title,
          }))
        )
      }
      const groupRes = await getClaimCodeGroups()
      if (groupRes?.success && groupRes.data) {
        setGroups(groupRes.data.groups ?? [])
      }
    }
    void loadOptions()
  }, [loadOverview])

  const refreshAll = async () => {
    await Promise.all([loadCodes(), loadRecords(), loadOverview()])
  }

  const handleSubmitForm = async (draft: ClaimCodeDraft) => {
    setFormSubmitting(true)
    setFormError(null)
    const res = editingCode
      ? await updateClaimCode(editingCode.id, draft)
      : await createClaimCodes(draft)
    setFormSubmitting(false)
    if (res?.success) {
      toast.success(
        editingCode
          ? t('Claim code updated')
          : t('{{count}} claim codes created', {
              count: (res.data as { count?: number } | undefined)?.count ?? 1,
            })
      )
      setFormOpen(false)
      setEditingCode(null)
      await refreshAll()
      return
    }
    setFormError(
      res?.message ||
        (editingCode
          ? t('Failed to update the claim code')
          : t('Failed to create claim codes'))
    )
  }

  const handleDelete = async () => {
    if (deleteTarget == null) {
      return
    }
    setDeleteLoading(true)
    const res = await deleteClaimCode(deleteTarget.id)
    setDeleteLoading(false)
    if (res?.success) {
      toast.success(t('Claim code deleted'))
      setDeleteTarget(null)
      await refreshAll()
      return
    }
    toast.error(res?.message || t('Failed to delete the claim code'))
  }

  const handleRecordAction = async (payload: {
    tracking_no: string
    note: string
  }) => {
    if (recordAction == null) {
      return
    }
    if (recordAction.action === 'ship' && payload.tracking_no === '') {
      setRecordError(t('Enter the tracking number'))
      return
    }
    setRecordSubmitting(true)
    setRecordError(null)
    const id = recordAction.claim.id
    let res
    if (recordAction.action === 'ship') {
      res = await shipClaimRecord(id, payload.tracking_no, payload.note)
    } else if (recordAction.action === 'deliver') {
      res = await deliverClaimRecord(id, payload.note)
    } else {
      res = await cancelClaimRecord(id, payload.note)
    }
    setRecordSubmitting(false)
    if (res?.success) {
      toast.success(t('Claim record updated'))
      setRecordAction(null)
      await refreshAll()
      return
    }
    setRecordError(res?.message || t('Failed to update the claim record'))
  }

  const overviewCards: { labelKey: string; value: string }[] = [
    {
      labelKey: 'Claim codes',
      value: formatNumber(overview?.total_codes ?? 0),
    },
    {
      labelKey: 'Enabled codes',
      value: formatNumber(overview?.active_codes ?? 0),
    },
    {
      labelKey: 'Total claims',
      value: formatNumber(overview?.total_claims ?? 0),
    },
    {
      labelKey: 'Waiting for shipment',
      value: formatNumber(overview?.pending_shipment ?? 0),
    },
    {
      labelKey: 'Balance distributed',
      value: formatQuota(overview?.quota_distributed ?? 0),
    },
    {
      labelKey: 'Card keys issued',
      value: formatNumber(overview?.card_issued ?? 0),
    },
    {
      labelKey: 'Subscriptions issued',
      value: formatNumber(overview?.subscription_issued ?? 0),
    },
    {
      labelKey: 'Physical prizes issued',
      value: formatNumber(overview?.physical_issued ?? 0),
    },
  ]

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Claim code console')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <Tabs defaultValue='codes' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='codes'>{t('Claim codes')}</TabsTrigger>
            <TabsTrigger value='records'>{t('Claim records')}</TabsTrigger>
            <TabsTrigger value='overview'>{t('Overview')}</TabsTrigger>
          </TabsList>

          <TabsContent value='codes'>
            <ClaimCodeTable
              codes={codes}
              total={codesTotal}
              loading={codesLoading}
              error={codesError}
              filter={codeFilter}
              onFilterChange={(patch) =>
                setCodeFilter((prev) => ({ ...prev, ...patch }))
              }
              onCreate={() => {
                setEditingCode(null)
                setFormError(null)
                setFormOpen(true)
              }}
              onEdit={(code) => {
                setEditingCode(code)
                setFormError(null)
                setFormOpen(true)
              }}
              onCards={(code) => setCardsTarget(code)}
              onDelete={(code) => setDeleteTarget(code)}
            />
          </TabsContent>

          <TabsContent value='records'>
            <ClaimRecordTable
              claims={records}
              total={recordsTotal}
              loading={recordsLoading}
              error={recordsError}
              filter={recordFilter}
              onFilterChange={(patch) =>
                setRecordFilter((prev) => ({ ...prev, ...patch }))
              }
              onAction={(action, claim) => {
                setRecordError(null)
                setRecordAction({ action, claim })
              }}
            />
          </TabsContent>

          <TabsContent value='overview'>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              {overviewCards.map((card) => (
                <Card key={card.labelKey}>
                  <CardContent className='py-4'>
                    <p className='text-muted-foreground text-xs'>
                      {t(card.labelKey)}
                    </p>
                    <p className='mt-1 text-xl font-semibold'>{card.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <ClaimCodeFormDialog
          open={formOpen}
          code={editingCode}
          plans={plans}
          groups={groups}
          submitting={formSubmitting}
          error={formError}
          onOpenChange={(open) => {
            setFormOpen(open)
            if (!open) {
              setEditingCode(null)
              setFormError(null)
            }
          }}
          onSubmit={(draft) => void handleSubmitForm(draft)}
        />

        <CardPoolDialog
          code={cardsTarget}
          onOpenChange={(open) => {
            if (!open) {
              setCardsTarget(null)
            }
          }}
          onChanged={() => void refreshAll()}
        />

        <ClaimRecordActionDialog
          action={recordAction?.action ?? null}
          claim={recordAction?.claim ?? null}
          submitting={recordSubmitting}
          error={recordError}
          onOpenChange={(open) => {
            if (!open) {
              setRecordAction(null)
              setRecordError(null)
            }
          }}
          onSubmit={(payload) => void handleRecordAction(payload)}
        />

        <ConfirmDialog
          open={deleteTarget != null}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null)
            }
          }}
          title={t('Delete claim code')}
          desc={t(
            'Claim codes that already have claim records are only disabled, so the records stay readable.'
          )}
          confirmText={t('Delete')}
          destructive
          isLoading={deleteLoading}
          handleConfirm={() => void handleDelete()}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
