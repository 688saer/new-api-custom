import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { useUpstreamHealth } from '../hooks/use-upstream-health'
import {
  describeUpstreamWarnings,
  describeWindowMinutes,
} from '../lib/describe-upstream-health'
import type { UpstreamCapability, UpstreamHealth } from '../types'

const CAPABILITY_LABELS: Record<UpstreamCapability, string> = {
  image: 'Image generation',
  chat: 'Chat',
}

/**
 * Tell the user when the failure they are about to hit is the upstream's, not
 * the site's. Rendered on every console page, so it stays silent while the relay
 * is relaying.
 *
 * It floats below the header instead of sitting in the page column: the sidebar
 * and the content area size themselves from `--app-header-height`, and a banner
 * in that column would push them out of the viewport.
 */
export function UpstreamStatusBanner() {
  const { health } = useUpstreamHealth()
  return <UpstreamStatusAlert health={health} />
}

export function UpstreamStatusAlert(props: { health: UpstreamHealth | null }) {
  const { t } = useTranslation()
  const warnings = describeUpstreamWarnings(props.health)
  if (warnings.length === 0) {
    return null
  }
  const minutes = describeWindowMinutes(props.health)
  const isDown = warnings.some((warning) => warning.state === 'down')

  return (
    <Alert
      variant={isDown ? 'destructive' : 'default'}
      data-testid='upstream-status-banner'
      className='fixed top-[calc(var(--app-header-height,3rem)+0.5rem)] right-4 z-50 w-80 max-w-[calc(100vw-2rem)] shadow-lg'
    >
      <AlertTriangle />
      <AlertTitle>{t('Upstream service is unstable')}</AlertTitle>
      <AlertDescription>
        <ul className='list-disc space-y-0.5 pl-4'>
          {warnings.map((warning) => (
            <li key={warning.capability}>
              {t(
                warning.state === 'down'
                  ? '{{capability}} requests are failing: {{failures}} of {{attempts}} failed in the last {{minutes}} minutes.'
                  : '{{capability}} requests are slower or failing intermittently: {{failures}} of {{attempts}} failed in the last {{minutes}} minutes.',
                {
                  capability: t(CAPABILITY_LABELS[warning.capability]),
                  failures: warning.failures,
                  attempts: warning.attempts,
                  minutes,
                }
              )}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
