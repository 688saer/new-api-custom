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
import { Gift, MapPin, Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { EmptyState } from '@/components/empty-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatTimestamp } from '@/lib/format'

import { claimStatusLabelKey, claimTypeLabelKey } from '../lib/claim-codes'
import type { ClaimCodeClaim } from '../types'

interface MyClaimListProps {
  claims: ClaimCodeClaim[]
  total: number
  loading: boolean
  error: string | null
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onFillAddress: (claim: ClaimCodeClaim) => void
}

/** 我的兑换记录：卡密可直接复制，实物可补填收货信息。 */
export function MyClaimList(props: MyClaimListProps) {
  const { t } = useTranslation()
  const totalPages = Math.max(
    Math.ceil(props.total / Math.max(props.pageSize, 1)),
    1
  )

  const statusVariant = (claim: ClaimCodeClaim) => {
    if (claim.status === 'cancelled') {
      return 'outline' as const
    }
    if (claim.status === 'shipped' || claim.status === 'delivered') {
      return 'secondary' as const
    }
    return 'default' as const
  }

  const renderBody = () => {
    if (props.loading && props.claims.length === 0) {
      return <LoadingState />
    }
    if (props.claims.length === 0) {
      return (
        <EmptyState
          icon={Gift}
          title={t('No claims yet')}
          description={t(
            'Claimed rewards appear here together with their status.'
          )}
        />
      )
    }
    return (
      <ul className='space-y-3'>
        {props.claims.map((claim) => (
          <li key={claim.id} className='rounded-lg border p-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='flex min-w-0 items-center gap-2'>
                <Package
                  aria-hidden='true'
                  className='text-muted-foreground size-4'
                />
                <span className='truncate font-medium'>{claim.name}</span>
                <Badge variant='outline'>
                  {t(claimTypeLabelKey(claim.type))}
                </Badge>
              </div>
              <Badge variant={statusVariant(claim)}>
                {t(claimStatusLabelKey(claim.status))}
              </Badge>
            </div>

            <div className='text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
              <span className='font-mono'>{claim.code}</span>
              <span>{formatTimestamp(claim.created_at)}</span>
              {claim.quota > 0 && <span>+ {claim.quota_display}</span>}
              {claim.plan_title !== '' && <span>{claim.plan_title}</span>}
            </div>

            {claim.card_content !== '' && (
              <div className='bg-muted mt-2 flex items-center gap-2 rounded-md px-2 py-1'>
                <code className='min-w-0 flex-1 truncate font-mono text-xs'>
                  {claim.card_content}
                </code>
                <CopyButton
                  value={claim.card_content}
                  tooltip={t('Copy to clipboard')}
                  aria-label={t('Copy to clipboard')}
                />
              </div>
            )}

            {claim.tracking_no !== '' && (
              <p className='text-muted-foreground mt-2 text-xs'>
                {t('Tracking number: {{code}}', { code: claim.tracking_no })}
              </p>
            )}

            {claim.receiver_address !== '' && claim.status !== 'shipped' && (
              <p className='text-muted-foreground mt-2 text-xs'>
                {t('Shipping to {{name}} · {{phone}}', {
                  name: claim.receiver_name,
                  phone: claim.receiver_phone,
                })}
              </p>
            )}

            {claim.description !== '' && (
              <p className='text-muted-foreground mt-2 text-xs whitespace-pre-line'>
                {claim.description}
              </p>
            )}

            {claim.type === 'physical' && claim.need_address && (
              <Button
                variant='outline'
                size='sm'
                className='mt-2'
                onClick={() => props.onFillAddress(claim)}
              >
                <MapPin aria-hidden='true' className='size-4' />
                {t('Fill in shipping address')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className='space-y-3'>
      {renderBody()}

      {props.error != null && (
        <p role='alert' className='text-destructive text-sm'>
          {props.error}
        </p>
      )}

      {props.total > props.pageSize ? (
        <div className='flex items-center justify-between'>
          <p className='text-muted-foreground text-xs'>
            {t('Page {{page}} of {{total}}', {
              page: props.page,
              total: totalPages,
            })}
          </p>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={props.page <= 1}
              onClick={() => props.onPageChange(props.page - 1)}
            >
              {t('Previous')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={props.page >= totalPages}
              onClick={() => props.onPageChange(props.page + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
