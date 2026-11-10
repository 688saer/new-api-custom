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
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { WheelWin } from '@/features/lucky-wheel'
import { getAdminPlans } from '@/features/subscriptions/api'
import { useDebounce } from '@/hooks'

import {
  adjustWheelPrizeStock,
  cancelWheelRecord,
  createWheelPrize,
  deleteWheelPrize,
  deliverWheelRecord,
  getWheelOverview,
  getWheelSettings,
  listWheelPrizes,
  listWheelRecords,
  shipWheelRecord,
  updateWheelPrize,
  updateWheelSettings,
} from '../api'
import { toPrizeDraft } from '../lib/prizes'
import type {
  WheelAdminPrize,
  WheelOverview,
  WheelPrizeDraft,
  WheelRecordFilter,
  WheelSettings,
} from '../types'
import { CardKeyDialog } from './card-key-dialog'
import { OverviewPanel } from './overview-panel'
import { PrizeFormDialog } from './prize-form-dialog'
import { PrizeTable } from './prize-table'
import { RecordActionDialog } from './record-action-dialog'
import { RecordTable, type WheelRecordAction } from './record-table'
import { SettingsPanel } from './settings-panel'
import { StockDialog } from './stock-dialog'

const RECORD_PAGE_SIZE = 10

export function WheelConsole() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('overview')

  const [overview, setOverview] = useState<WheelOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)

  const [prizes, setPrizes] = useState<WheelAdminPrize[]>([])
  const [prizesLoading, setPrizesLoading] = useState(true)

  const [records, setRecords] = useState<WheelWin[]>([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordsError, setRecordsError] = useState<string | null>(null)
  const [filter, setFilter] = useState<WheelRecordFilter>({
    keyword: '',
    status: '',
    prize_type: '',
    prize_id: 0,
    page: 1,
    pageSize: RECORD_PAGE_SIZE,
  })
  const [keywordInput, setKeywordInput] = useState('')
  const debouncedKeyword = useDebounce(keywordInput, 400)

  const [settings, setSettings] = useState<WheelSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSubmitting, setSettingsSubmitting] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const [plans, setPlans] = useState<{ id: number; title: string }[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editingPrize, setEditingPrize] = useState<WheelAdminPrize | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<WheelAdminPrize | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [stockTarget, setStockTarget] = useState<WheelAdminPrize | null>(null)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)

  const [codesTarget, setCodesTarget] = useState<WheelAdminPrize | null>(null)

  const [recordAction, setRecordAction] = useState<{
    action: WheelRecordAction
    win: WheelWin
  } | null>(null)
  const [recordSubmitting, setRecordSubmitting] = useState(false)
  const [recordError, setRecordError] = useState<string | null>(null)

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true)
    try {
      const res = await getWheelOverview()
      if (res.success && res.data) {
        setOverview(res.data)
      }
    } catch {
      setOverview(null)
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  const loadPrizes = useCallback(async () => {
    setPrizesLoading(true)
    try {
      const res = await listWheelPrizes()
      if (res.success && res.data) {
        setPrizes(res.data.items)
      }
    } catch {
      setPrizes([])
    } finally {
      setPrizesLoading(false)
    }
  }, [])

  const loadRecords = useCallback(async () => {
    setRecordsLoading(true)
    setRecordsError(null)
    try {
      const res = await listWheelRecords(filter)
      if (!res.success || !res.data) {
        setRecordsError(
          res.reason || res.message || t('Failed to load records')
        )
        return
      }
      setRecords(res.data.items)
      setRecordsTotal(res.data.total)
    } catch {
      setRecordsError(t('Failed to load records'))
    } finally {
      setRecordsLoading(false)
    }
  }, [filter, t])

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true)
    try {
      const res = await getWheelSettings()
      if (res.success && res.data) {
        setSettings(res.data)
      }
    } catch {
      setSettings(null)
    } finally {
      setSettingsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOverview()
    void loadPrizes()
    void loadSettings()
  }, [loadOverview, loadPrizes, loadSettings])

  useEffect(() => {
    setFilter((prev) =>
      prev.keyword === debouncedKeyword
        ? prev
        : { ...prev, keyword: debouncedKeyword, page: 1 }
    )
  }, [debouncedKeyword])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await getAdminPlans()
        if (cancelled || !res.success || !res.data) return
        setPlans(
          res.data.map((record) => ({
            id: record.plan.id,
            title: record.plan.title,
          }))
        )
      } catch {
        // 套餐列表不可用时仍可配置其它类型奖品
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshAfterPrizeChange = () => {
    void loadPrizes()
    void loadOverview()
  }

  const handleSubmitPrize = async (draft: WheelPrizeDraft) => {
    setFormSubmitting(true)
    setFormError(null)
    try {
      const res = editingPrize
        ? await updateWheelPrize(editingPrize.id, draft)
        : await createWheelPrize(draft)
      if (!res.success) {
        setFormError(res.reason || res.message || t('Failed to save the prize'))
        return
      }
      toast.success(editingPrize ? t('Prize updated') : t('Prize created'))
      setFormOpen(false)
      setEditingPrize(null)
      refreshAfterPrizeChange()
    } catch {
      setFormError(t('Failed to save the prize'))
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDeletePrize = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const res = await deleteWheelPrize(deleteTarget.id)
      if (!res.success) {
        toast.error(res.reason || res.message || t('Delete failed'))
        return
      }
      toast.success(t('Deleted'))
      setDeleteTarget(null)
      refreshAfterPrizeChange()
    } catch {
      toast.error(t('Delete failed'))
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleToggleEnabled = async (
    prize: WheelAdminPrize,
    enabled: boolean
  ) => {
    try {
      const res = await updateWheelPrize(prize.id, {
        ...toPrizeDraft(prize),
        enabled,
      })
      if (!res.success) {
        toast.error(res.reason || res.message || t('Update failed'))
        return
      }
      setPrizes((prev) =>
        prev.map((item) => (item.id === prize.id ? { ...item, enabled } : item))
      )
      void loadOverview()
    } catch {
      toast.error(t('Update failed'))
    }
  }

  const handleAdjustStock = async (delta: number) => {
    if (!stockTarget) return
    setStockLoading(true)
    setStockError(null)
    try {
      const res = await adjustWheelPrizeStock(stockTarget.id, delta)
      if (!res.success) {
        setStockError(res.reason || res.message || t('Update failed'))
        return
      }
      toast.success(t('Stock updated'))
      setStockTarget(null)
      refreshAfterPrizeChange()
    } catch {
      setStockError(t('Update failed'))
    } finally {
      setStockLoading(false)
    }
  }

  const handleRecordAction = async (payload: {
    tracking_no?: string
    note?: string
    code?: string
  }) => {
    if (!recordAction) return
    setRecordSubmitting(true)
    setRecordError(null)
    try {
      const { action, win } = recordAction
      let res
      if (action === 'ship') {
        res = await shipWheelRecord(
          win.id,
          payload.tracking_no ?? '',
          payload.note ?? ''
        )
      } else if (action === 'deliver') {
        res = await deliverWheelRecord(
          win.id,
          payload.note ?? '',
          payload.code ?? ''
        )
      } else {
        res = await cancelWheelRecord(win.id, payload.note ?? '')
      }
      if (!res.success) {
        setRecordError(res.reason || res.message || t('Update failed'))
        return
      }
      toast.success(t('Record updated'))
      setRecordAction(null)
      void loadRecords()
      void loadOverview()
      void loadPrizes()
    } catch {
      setRecordError(t('Update failed'))
    } finally {
      setRecordSubmitting(false)
    }
  }

  const handleSaveSettings = async (next: WheelSettings) => {
    setSettingsSubmitting(true)
    setSettingsError(null)
    try {
      const res = await updateWheelSettings(next)
      if (!res.success) {
        setSettingsError(
          res.reason || res.message || t('Failed to save settings')
        )
        return
      }
      toast.success(t('Settings saved'))
      if (res.data) setSettings(res.data)
      void loadOverview()
    } catch {
      setSettingsError(t('Failed to save settings'))
    } finally {
      setSettingsSubmitting(false)
    }
  }

  const nextSortOrder =
    prizes.reduce((max, prize) => Math.max(max, prize.sort_order), 0) + 1

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>
          {t('Lucky wheel console')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <Button
            variant='outline'
            size='sm'
            onClick={() => {
              refreshAfterPrizeChange()
              void loadRecords()
              void loadSettings()
            }}
          >
            <RefreshCw aria-hidden='true' className='size-4' />
            {t('Refresh')}
          </Button>
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value='overview'>{t('Overview')}</TabsTrigger>
              <TabsTrigger value='prizes'>{t('Prizes')}</TabsTrigger>
              <TabsTrigger value='records'>{t('Win records')}</TabsTrigger>
              <TabsTrigger value='settings'>{t('Settings')}</TabsTrigger>
            </TabsList>

            <TabsContent value='overview' className='mt-4'>
              <OverviewPanel overview={overview} loading={overviewLoading} />
            </TabsContent>

            <TabsContent value='prizes' className='mt-4'>
              <Card>
                <CardContent className='py-4'>
                  <PrizeTable
                    prizes={prizes}
                    loading={prizesLoading}
                    onCreate={() => {
                      setEditingPrize(null)
                      setFormError(null)
                      setFormOpen(true)
                    }}
                    onEdit={(prize) => {
                      setEditingPrize(prize)
                      setFormError(null)
                      setFormOpen(true)
                    }}
                    onDelete={(prize) => setDeleteTarget(prize)}
                    onAdjustStock={(prize) => {
                      setStockError(null)
                      setStockTarget(prize)
                    }}
                    onManageCodes={(prize) => setCodesTarget(prize)}
                    onToggleEnabled={(prize, enabled) =>
                      void handleToggleEnabled(prize, enabled)
                    }
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value='records' className='mt-4'>
              <Card>
                <CardContent className='py-4'>
                  <RecordTable
                    records={records}
                    prizes={prizes}
                    filter={filter}
                    keyword={keywordInput}
                    total={recordsTotal}
                    loading={recordsLoading}
                    error={recordsError}
                    onFilterChange={(patch) => {
                      if (patch.keyword != null) {
                        setKeywordInput(patch.keyword)
                        return
                      }
                      setFilter((prev) => ({ ...prev, ...patch }))
                    }}
                    onAction={(action, win) => {
                      setRecordError(null)
                      setRecordAction({ action, win })
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value='settings' className='mt-4'>
              <SettingsPanel
                settings={settings}
                loading={settingsLoading}
                submitting={settingsSubmitting}
                error={settingsError}
                onSave={(next) => void handleSaveSettings(next)}
              />
            </TabsContent>
          </Tabs>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <PrizeFormDialog
        open={formOpen}
        prize={editingPrize}
        plans={plans}
        nextSortOrder={nextSortOrder}
        submitting={formSubmitting}
        error={formError}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditingPrize(null)
            setFormError(null)
          }
        }}
        onSubmit={(draft) => void handleSubmitPrize(draft)}
      />

      <StockDialog
        prize={stockTarget}
        submitting={stockLoading}
        error={stockError}
        onOpenChange={(open) => {
          if (!open) setStockTarget(null)
        }}
        onSubmit={(delta) => void handleAdjustStock(delta)}
      />

      <CardKeyDialog
        open={codesTarget != null}
        prize={codesTarget}
        onOpenChange={(open) => {
          if (!open) setCodesTarget(null)
        }}
        onChanged={() => void loadPrizes()}
      />

      <RecordActionDialog
        action={recordAction?.action ?? null}
        win={recordAction?.win ?? null}
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
          if (!open) setDeleteTarget(null)
        }}
        title={t('Delete prize')}
        desc={t(
          'Prizes that already produced win records cannot be deleted; disable them instead.'
        )}
        confirmText={t('Delete')}
        destructive
        isLoading={deleteLoading}
        handleConfirm={() => void handleDeletePrize()}
      />
    </>
  )
}
