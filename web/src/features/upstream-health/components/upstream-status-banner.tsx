import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { useUpstreamHealth } from '../hooks/use-upstream-health'
import {
  describeUpstreamWarnings,
  describeWindowMinutes,
  warningSignature,
} from '../lib/describe-upstream-health'
import type { UpstreamCapability, UpstreamHealth } from '../types'

const CAPABILITY_LABELS: Record<UpstreamCapability, string> = {
  image: 'Image generation',
  chat: 'Chat',
}

/** Session-scoped so a dismissal survives the minute-by-minute polls. */
const DISMISSED_KEY = 'upstream-health-dismissed'

/**
 * Tell the user when the failure they are about to hit is the upstream's, not
 * the site's. Rendered on every console page, so it stays silent while the relay
 * is relaying.
 *
 * It floats below the header instead of sitting in the page column: the sidebar
 * and the content area size themselves from `--app-header-height`, and a banner
 * in that column would push them out of the viewport. Because it floats over the
 * page's own top-right corner — where the channels and API keys pages keep their
 * primary actions — it must always be possible to put it away.
 */
export function UpstreamStatusBanner() {
  const { health } = useUpstreamHealth()
  return <UpstreamStatusAlert health={health} />
}

export function UpstreamStatusAlert(props: { health: UpstreamHealth | null }) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem(DISMISSED_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const warnings = describeUpstreamWarnings(props.health)
  if (warnings.length === 0) {
    return null
  }
  const signature = warningSignature(warnings)
  if (signature === dismissed) {
    return null
  }
  const minutes = describeWindowMinutes(props.health)
  const isDown = warnings.some((warning) => warning.state === 'down')

  const handleDismiss = () => {
    setDismissed(signature)
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, signature)
    } catch {
      // Private mode: the notice still goes away for this page view.
    }
  }

  return (
    <Alert
      variant={isDown ? 'destructive' : 'default'}
      data-testid='upstream-status-banner'
      className='fixed top-[calc(var(--app-header-height,3rem)+0.5rem)] right-3 z-50 w-80 max-w-[calc(100vw-1.5rem)] shadow-lg'
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
        <a href='/service-status' className='mt-1 inline-block text-xs'>
          {t('View channel status')}
        </a>
      </AlertDescription>
      <AlertAction>
        <Button
          variant='ghost'
          size='icon'
          className='text-muted-foreground hover:text-foreground size-6'
          aria-label={t('Dismiss this notice')}
          title={t('Dismiss this notice')}
          onClick={handleDismiss}
        >
          <X className='size-3.5' aria-hidden='true' />
        </Button>
      </AlertAction>
    </Alert>
  )
}
