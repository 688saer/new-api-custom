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
import { SettingsPage } from '../components/settings-page'
import type { SiteSettings } from '../types'
import {
  SITE_DEFAULT_SECTION,
  getSiteSectionContent,
  getSiteSectionMeta,
} from './section-registry.tsx'

const defaultSiteSettings: SiteSettings = {
  Notice: '',
  SystemName: 'New API',
  Logo: '',
  Footer: '',
  About: '',
  HomePageContent: '',
  ServerAddress: '',
  TaskPublicAddress: '',
  'general_setting.docs_link': '',
  'legal.user_agreement': '',
  'legal.privacy_policy': '',
  HeaderNavModules: '',
  SidebarModulesAdmin: '',
  'welfare_api_setting.enabled': true,
  'welfare_api_setting.title': 'Welfare API',
  'welfare_api_setting.subtitle':
    'Free APIs published by the site operator, with endpoints and models ready to call.',
  'welfare_api_setting.notice': '',
  'welfare_api_setting.require_login': false,
  'welfare_api_setting.apis': '[]',
  'service_status_setting.enabled': false,
  'service_status_setting.title': 'Channel availability',
  'service_status_setting.description':
    'Live probe results for every channel published by this site.',
  'service_status_setting.display_hours': 24,
  'service_status_setting.probe_interval_minutes': 5,
  'service_status_setting.sample_retention_days': 30,
  'service_status_setting.require_login': false,
  'service_status_setting.show_latency': true,
  'service_status_setting.targets': '[]',
}

export function SiteSettings() {
  return (
    <SettingsPage
      routePath='/_authenticated/system-settings/site/$section'
      defaultSettings={defaultSiteSettings}
      defaultSection={SITE_DEFAULT_SECTION}
      getSectionContent={getSiteSectionContent}
      getSectionMeta={getSiteSectionMeta}
    />
  )
}
