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
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'

import type { CanvasStorageFailure } from '../hooks/use-canvas-board'
import type { StorageHealth } from '../lib/storage-durability'

interface CanvasStorageAlertsProps {
  failure: CanvasStorageFailure | null
  storage: StorageHealth | null
  /** Whether the board holds anything worth warning about. */
  hasNodes: boolean
}

/**
 * Nothing on this board is on the server, so the honesty of this strip is the
 * only thing standing between an operator and silent data loss. It stays quiet
 * while the browser has agreed to keep the data.
 */
export function CanvasStorageAlerts(props: CanvasStorageAlertsProps) {
  const { t } = useTranslation()

  if (props.failure) {
    let message =
      'The canvas could not be saved. These changes stay only until you close this page.'
    if (props.failure.operation === 'read') {
      message = 'The saved canvas could not be restored.'
    } else if (props.failure.quotaExceeded) {
      message =
        'Browser storage is full. Download the pictures you want to keep, then delete some from the canvas.'
    }
    return (
      <Alert
        variant='destructive'
        data-testid='canvas-storage-alert'
        className='shrink-0'
      >
        <AlertTriangle />
        <AlertDescription>{t(message)}</AlertDescription>
      </Alert>
    )
  }

  if (!props.hasNodes || props.storage?.durability !== 'best-effort') {
    return null
  }

  return (
    <Alert data-testid='canvas-storage-alert' className='shrink-0'>
      <AlertTriangle />
      <AlertDescription>
        {t(
          'This browser can delete stored canvas data after a while. Download any picture you want to keep.'
        )}
      </AlertDescription>
    </Alert>
  )
}
