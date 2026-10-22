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
import { SystemInfoSection } from '../general/system-info-section'
import { ServiceStatusSettingsSection } from '../general/service-status-settings-section'
import type { ServiceStatusTargetValues } from '../general/service-status-target-dialog'
import { WelfareApiSettingsSection } from '../general/welfare-api-settings-section'
import type { WelfareApiEntryValues } from '../general/welfare-api-entry-dialog'
import {
  parseHeaderNavModules,
  parseSidebarModulesAdmin,
  serializeHeaderNavModules,
  serializeSidebarModulesAdmin,
} from '../maintenance/config'
import { HeaderNavigationSection } from '../maintenance/header-navigation-section'
import { NoticeSection } from '../maintenance/notice-section'
import { SidebarModulesSection } from '../maintenance/sidebar-modules-section'
import type { SiteSettings } from '../types'
import { createSectionRegistry } from '../utils/section-registry'

const toText = (value: unknown): string =>
  typeof value === 'string' ? value : ''

const toNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Read the stored welfare API entry array into the admin form shape. A blank or
 * unparsable option yields an empty list so the operator starts from a clean
 * state instead of a broken form.
 */
function parseWelfareApiEntries(raw: string): WelfareApiEntryValues[] {
  if (!raw || raw.trim() === '') {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed.map((item) => {
    const entry =
      item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      id: toText(entry.id),
      name: toText(entry.name),
      provider: toText(entry.provider),
      description: toText(entry.description),
      baseUrl: toText(entry.base_url),
      model: toText(entry.model),
      apiKey: toText(entry.api_key),
      docsUrl: toText(entry.docs_url),
      badge: toText(entry.badge),
      sort: toNumber(entry.sort),
      enabled: entry.enabled !== false,
    }
  })
}

/**
 * Read the stored service status target array into the admin form shape. A
 * blank or unparsable option yields an empty list so the operator starts from a
 * clean state instead of a broken form.
 */
function parseServiceStatusTargets(
  raw: string
): ServiceStatusTargetValues[] {
  if (!raw || raw.trim() === '') {
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed.map((item) => {
    const target =
      item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    return {
      id: toText(target.id),
      name: toText(target.name),
      description: toText(target.description),
      category: toText(target.category),
      icon: toText(target.icon),
      group: toText(target.group),
      model: toText(target.model),
      baseUrl: toText(target.base_url),
      apiKey: toText(target.api_key),
      probeEndpoint: toText(target.probe_endpoint) || 'openai',
      billingMode: toText(target.billing_mode) || 'token',
      sort: toNumber(target.sort),
      enabled: target.enabled !== false,
    }
  })
}

const SITE_SECTIONS = [
  {
    id: 'system-info',
    titleKey: 'System Information',
    build: (settings: SiteSettings) => (
      <SystemInfoSection
        defaultValues={{
          SystemName: settings.SystemName,
          Logo: settings.Logo,
          Footer: settings.Footer,
          About: settings.About,
          HomePageContent: settings.HomePageContent,
          ServerAddress: settings.ServerAddress,
          TaskPublicAddress: settings.TaskPublicAddress,
          general_setting: {
            docs_link: settings['general_setting.docs_link'],
          },
          legal: {
            user_agreement: settings['legal.user_agreement'],
            privacy_policy: settings['legal.privacy_policy'],
          },
        }}
      />
    ),
  },
  {
    id: 'notice',
    titleKey: 'System Notice',
    build: (settings: SiteSettings) => (
      <NoticeSection defaultValue={settings.Notice ?? ''} />
    ),
  },
  {
    id: 'header-navigation',
    titleKey: 'Header navigation',
    build: (settings: SiteSettings) => {
      const headerNavConfig = parseHeaderNavModules(settings.HeaderNavModules)
      const headerNavSerialized = serializeHeaderNavModules(headerNavConfig)
      return (
        <HeaderNavigationSection
          config={headerNavConfig}
          initialSerialized={headerNavSerialized}
        />
      )
    },
  },
  {
    id: 'sidebar-modules',
    titleKey: 'Sidebar modules',
    build: (settings: SiteSettings) => {
      const sidebarConfig = parseSidebarModulesAdmin(
        settings.SidebarModulesAdmin
      )
      const sidebarSerialized = serializeSidebarModulesAdmin(sidebarConfig)
      return (
        <SidebarModulesSection
          config={sidebarConfig}
          initialSerialized={sidebarSerialized}
        />
      )
    },
  },
  {
    id: 'welfare-apis',
    titleKey: 'Welfare API',
    build: (settings: SiteSettings) => (
      <WelfareApiSettingsSection
        defaultValues={{
          enabled: settings['welfare_api_setting.enabled'],
          title: settings['welfare_api_setting.title'],
          subtitle: settings['welfare_api_setting.subtitle'],
          notice: settings['welfare_api_setting.notice'],
          requireLogin: settings['welfare_api_setting.require_login'],
          entries: parseWelfareApiEntries(settings['welfare_api_setting.apis']),
        }}
      />
    ),
  },
  {
    id: 'service-status',
    titleKey: 'Channel availability',
    build: (settings: SiteSettings) => (
      <ServiceStatusSettingsSection
        defaultValues={{
          enabled: settings['service_status_setting.enabled'],
          title: settings['service_status_setting.title'],
          description: settings['service_status_setting.description'],
          displayHours: settings['service_status_setting.display_hours'],
          probeIntervalMinutes:
            settings['service_status_setting.probe_interval_minutes'],
          sampleRetentionDays:
            settings['service_status_setting.sample_retention_days'],
          requireLogin: settings['service_status_setting.require_login'],
          showLatency: settings['service_status_setting.show_latency'],
          targets: parseServiceStatusTargets(
            settings['service_status_setting.targets']
          ),
        }}
      />
    ),
  },
] as const

export type SiteSectionId = (typeof SITE_SECTIONS)[number]['id']

const siteRegistry = createSectionRegistry<SiteSectionId, SiteSettings>({
  sections: SITE_SECTIONS,
  defaultSection: 'system-info',
  basePath: '/system-settings/site',
  urlStyle: 'path',
})

export const SITE_SECTION_IDS = siteRegistry.sectionIds
export const SITE_DEFAULT_SECTION = siteRegistry.defaultSection
export const getSiteSectionNavItems = siteRegistry.getSectionNavItems
export const getSiteSectionContent = siteRegistry.getSectionContent
export const getSiteSectionMeta = siteRegistry.getSectionMeta
