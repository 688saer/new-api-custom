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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import {
  collapseServiceStatusCells,
  formatServiceStatusLatency,
  formatServiceStatusPercent,
  serviceStatusBarClass,
  serviceStatusColorLabel,
} from '../lib/service-status'
import type { ServiceStatusCell } from '../types'

interface ServiceStatusUptimeBarProps {
  cells: ServiceStatusCell[]
  /** Maximum number of blocks rendered; longer windows are merged. */
  maxBlocks?: number
  className?: string
}

/**
 * Availability ribbon: one block per time bucket, coloured by probe outcome.
 * Hovering a block reveals the bucket's success rate and latency.
 */
export function ServiceStatusUptimeBar(props: ServiceStatusUptimeBarProps) {
  const { t } = useTranslation()
  const maxBlocks = props.maxBlocks ?? 60

  const blocks = useMemo(
    () => collapseServiceStatusCells(props.cells, maxBlocks),
    [props.cells, maxBlocks]
  )

  if (blocks.length === 0) {
    return (
      <div
        className={cn(
          'bg-muted/40 text-muted-foreground flex h-8 items-center justify-center rounded-md text-xs',
          props.className
        )}
      >
        {t('No probe data')}
      </div>
    )
  }

  return (
    <div
      className={cn('flex h-8 items-stretch gap-px', props.className)}
      role='img'
      aria-label={t('Probe availability')}
    >
      {blocks.map((block) => (
        <Tooltip key={block.timestamp}>
          <TooltipTrigger
            render={
              <div
                className={cn(
                  'min-w-0 flex-1 rounded-[2px] transition-opacity hover:opacity-80',
                  serviceStatusBarClass(block.status)
                )}
              />
            }
          />
          <TooltipContent className='space-y-1 text-xs'>
            <div className='font-medium'>
              {t(serviceStatusColorLabel(block.status))}
            </div>
            <div>
              {t('Success rate')}: {formatServiceStatusPercent(block.success_rate)}
            </div>
            <div>
              {t('Successful probes in this period')}: {block.success_count}/
              {block.probe_count}
            </div>
            {block.avg_latency > 0 && (
              <div>
                {t('Average successful probe duration')}:{' '}
                {formatServiceStatusLatency(block.avg_latency)}
              </div>
            )}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
