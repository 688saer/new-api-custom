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
import type { BillingSettings } from '../types'
import {
  BILLING_DEFAULT_SECTION,
  getBillingSectionContent,
  getBillingSectionMeta,
} from './section-registry.tsx'

const defaultBillingSettings: BillingSettings = {
  QuotaForNewUser: 0,
  QuotaForInviter: 0,
  QuotaForInvitee: 0,
  TopUpLink: '',
  'quota_setting.enable_free_model_pre_consume': true,
  'quota_setting.trust_quota_usd': 10,
  'quota_setting.pre_consume_multiplier': 1,
  QuotaPerUnit: 500000,
  USDExchangeRate: 7,
  'general_setting.quota_display_type': 'USD',
  'general_setting.custom_currency_symbol': '¤',
  'general_setting.custom_currency_exchange_rate': 1,
  DisplayInCurrencyEnabled: true,
  DisplayTokenStatEnabled: true,
  ModelPrice: '',
  ModelRatio: '',
  CacheRatio: '',
  CreateCacheRatio: '',
  CompletionRatio: '',
  ImageRatio: '',
  AudioRatio: '',
  AudioCompletionRatio: '',
  ExposeRatioEnabled: false,
  'billing_setting.billing_mode': '{}',
  'billing_setting.billing_expr': '{}',
  'billing_setting.plugin_billing_expr': '{}',
  'tool_price_setting.prices': '{}',
  TopupGroupRatio: '',
  GroupRatio: '',
  UserUsableGroups: '',
  GroupGroupRatio: '',
  AutoGroups: '',
  MaxTokenAutoGroups: 5,
  DefaultUseAutoGroup: false,
  'group_ratio_setting.group_special_usable_group': '{}',
  PayAddress: '',
  EpayId: '',
  EpayKey: '',
  Price: 7.3,
  MinTopUp: 1,
  CustomCallbackAddress: '',
  PayMethods: '',
  'payment_setting.amount_options': '',
  'payment_setting.amount_discount': '',
  'payment_setting.compliance_confirmed': false,
  'payment_setting.compliance_terms_version': '',
  'payment_setting.compliance_confirmed_at': 0,
  'payment_setting.compliance_confirmed_by': 0,
  'payment_setting.compliance_confirmed_ip': '',
  AlipayEnabled: false,
  AlipaySandbox: false,
  AlipayAppId: '',
  AlipayPrivateKey: '',
  AlipayPublicKey: '',
  AlipayProductType: 'page',
  AlipayMinTopUp: 1,
  AlipayGateway: '',
  AlipayNotifyUrl: '',
  AlipayReturnUrl: '',
  WechatPayEnabled: false,
  WechatPayAppId: '',
  WechatPayMchId: '',
  WechatPayMchSerialNo: '',
  WechatPayApiV3Key: '',
  WechatPayPrivateKey: '',
  WechatPayPlatformPublicKey: '',
  WechatPayMinTopUp: 1,
  WechatPayGateway: '',
  WechatPayNotifyUrl: '',
  StripeApiSecret: '',
  StripeWebhookSecret: '',
  StripePriceId: '',
  StripeUnitPrice: 8.0,
  StripeMinTopUp: 1,
  StripePromotionCodesEnabled: false,
  CreemApiKey: '',
  CreemWebhookSecret: '',
  CreemTestMode: false,
  CreemProducts: '[]',
  WaffoEnabled: false,
  WaffoApiKey: '',
  WaffoPrivateKey: '',
  WaffoPublicCert: '',
  WaffoSandboxPublicCert: '',
  WaffoSandboxApiKey: '',
  WaffoSandboxPrivateKey: '',
  WaffoSandbox: false,
  WaffoMerchantId: '',
  WaffoCurrency: 'USD',
  WaffoUnitPrice: 1,
  WaffoMinTopUp: 1,
  WaffoNotifyUrl: '',
  WaffoReturnUrl: '',
  WaffoPayMethods: '[]',
  WaffoPancakeMerchantID: '',
  WaffoPancakePrivateKey: '',
  WaffoPancakeReturnURL: '',
  WaffoPancakeStoreID: '',
  WaffoPancakeProductID: '',
  'checkin_setting.enabled': false,
  'checkin_setting.min_quota': 1000,
  'checkin_setting.max_quota': 10000,
  'lottery_setting.enabled': false,
  'lottery_setting.daily_free_draws': 1,
  'lottery_setting.single_cost_quota': 500000,
  'lottery_setting.multi_cost_quota': 4500000,
  'lottery_setting.enable_multi': true,
  'lottery_setting.require_no_draw_today_for_multi': true,
  'lottery_setting.public_wins_limit': 20,
  'lottery_setting.min_win_quota_for_public': 1000000,
  'lottery_setting.prizes': [
    { quota: 0, weight: 55 },
    { quota: 100000, weight: 20 },
    { quota: 200000, weight: 10 },
    { quota: 500000, weight: 6 },
    { quota: 1000000, weight: 4 },
    { quota: 2000000, weight: 3 },
    { quota: 5000000, weight: 1.5 },
    { quota: 10000000, weight: 0.5 },
  ],
  'welfare_chest_setting.enabled': false,
  'welfare_chest_setting.can_open_any': true,
  'welfare_chest_setting.unlimited_open': false,
  'welfare_chest_setting.choose_one_per_week': true,
  'welfare_chest_setting.max_quota_limit': 0,
  'welfare_chest_setting.xiaoshuai_ge': JSON.stringify({
    key: 'xiaoshuai_ge',
    enabled: true,
    threshold_usd: 10,
    reward_min_usd: 0.2,
    reward_max_usd: 1,
    median_usd: 0.5,
    closed_image: '/static/welfare-chests/xiaoshuai-ge-closed.png',
    opened_image: '/static/welfare-chests/xiaoshuai-ge-opened.png',
  }),
  'welfare_chest_setting.hei_dashuai': JSON.stringify({
    key: 'hei_dashuai',
    enabled: true,
    threshold_usd: 10,
    reward_min_usd: 0.05,
    reward_max_usd: 2,
    median_usd: 0.4,
    closed_image: '/static/welfare-chests/hei-dashuai-closed.png',
    opened_image: '/static/welfare-chests/hei-dashuai-opened.png',
  }),
  'reward_setting.enabled': false,
  'reward_setting.max_quota_limit': 0,
  'reward_setting.history_page_size': 20,
  'reward_setting.default_copy': JSON.stringify({
    label: 'New API',
    title: '感谢你的支持',
    subtitle: '每一次创造，都值得被支持。',
    footer: '奖励金可用于本站模型调用',
    stub_text: '专属奖励',
    stub_font_size: 28,
    button_text: '领取奖励金',
  }),
}

export function BillingSettings() {
  return (
    <SettingsPage
      routePath='/_authenticated/system-settings/billing/$section'
      defaultSettings={defaultBillingSettings}
      defaultSection={BILLING_DEFAULT_SECTION}
      getSectionContent={getBillingSectionContent}
      getSectionMeta={getBillingSectionMeta}
    />
  )
}
