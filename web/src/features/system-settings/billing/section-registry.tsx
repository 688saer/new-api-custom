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
import { parseCurrencyDisplayType } from '@/lib/currency'

import { CheckinSettingsSection } from '../general/checkin-settings-section'
import { LotterySettingsSection } from '../general/lottery-settings-section'
import { PricingSection } from '../general/pricing-section'
import { QuotaSettingsSection } from '../general/quota-settings-section'
import {
  RewardSettingsSection,
  type RewardSectionDefaults,
} from '../general/reward-settings-section'
import {
  WelfareChestSettingsSection,
  type WelfareChestBoxDefaults,
} from '../general/welfare-chest-settings-section'
import { PaymentSettingsSection } from '../integrations/payment-settings-section'
import { RatioSettingsCard } from '../models/ratio-settings-card'
import type { BillingSettings } from '../types'
import { createSectionRegistry } from '../utils/section-registry'

const DEFAULT_XIAOSHUAI_GE: WelfareChestBoxDefaults = {
  enabled: true,
  thresholdUsd: 10,
  rewardMinUsd: 0.2,
  rewardMaxUsd: 1,
  medianUsd: 0.5,
}

const DEFAULT_HEI_DASHUAI: WelfareChestBoxDefaults = {
  enabled: true,
  thresholdUsd: 10,
  rewardMinUsd: 0.05,
  rewardMaxUsd: 2,
  medianUsd: 0.4,
}

const DEFAULT_REWARD_SETTING: RewardSectionDefaults = {
  enabled: false,
  maxQuotaLimit: 0,
  historyPageSize: 20,
  copy: {
    label: 'New API',
    title: '感谢你的支持',
    subtitle: '每一次创造，都值得被支持。',
    footer: '奖励金可用于本站模型调用',
    stubText: '专属奖励',
    stubFontSize: 28,
    buttonText: '领取奖励金',
  },
}

const toFiniteNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toText = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() !== '' ? value : fallback

/**
 * Read the ticket-copy option into the shape the admin form edits. A blank or
 * unparsable value falls back to the shipped defaults.
 */
function parseRewardCopy(raw: string): RewardSectionDefaults['copy'] {
  const fallback = DEFAULT_REWARD_SETTING.copy
  let copy: Record<string, unknown> = {}
  try {
    const value = JSON.parse(raw)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      copy = value as Record<string, unknown>
    }
  } catch {
    return { ...fallback }
  }

  return {
    label: toText(copy.label, fallback.label),
    title: toText(copy.title, fallback.title),
    subtitle: toText(copy.subtitle, fallback.subtitle),
    footer: toText(copy.footer, fallback.footer),
    stubText: toText(copy.stub_text, fallback.stubText),
    stubFontSize: toFiniteNumber(copy.stub_font_size, fallback.stubFontSize),
    buttonText: toText(copy.button_text, fallback.buttonText),
  }
}

/**
 * Read one chest option into the numeric form the admin form edits. A blank or
 * unparsable option falls back to the shipped defaults so the operator never
 * sees an empty form.
 */
function parseChestBox(
  raw: string,
  fallback: WelfareChestBoxDefaults
): WelfareChestBoxDefaults {
  let parsed: Record<string, unknown> = {}
  try {
    const value = JSON.parse(raw)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      parsed = value as Record<string, unknown>
    }
  } catch {
    return { ...fallback }
  }

  return {
    enabled:
      typeof parsed.enabled === 'boolean' ? parsed.enabled : fallback.enabled,
    thresholdUsd: toFiniteNumber(parsed.threshold_usd, fallback.thresholdUsd),
    rewardMinUsd: toFiniteNumber(parsed.reward_min_usd, fallback.rewardMinUsd),
    rewardMaxUsd: toFiniteNumber(parsed.reward_max_usd, fallback.rewardMaxUsd),
    medianUsd: toFiniteNumber(parsed.median_usd, fallback.medianUsd),
  }
}

const getModelDefaults = (settings: BillingSettings) => ({
  ModelPrice: settings.ModelPrice,
  ModelRatio: settings.ModelRatio,
  CacheRatio: settings.CacheRatio,
  CreateCacheRatio: settings.CreateCacheRatio,
  CompletionRatio: settings.CompletionRatio,
  ImageRatio: settings.ImageRatio,
  AudioRatio: settings.AudioRatio,
  AudioCompletionRatio: settings.AudioCompletionRatio,
  ExposeRatioEnabled: settings.ExposeRatioEnabled,
  BillingMode: settings['billing_setting.billing_mode'],
  BillingExpr: settings['billing_setting.billing_expr'],
  PluginBillingExpr: settings['billing_setting.plugin_billing_expr'],
})

const getGroupDefaults = (settings: BillingSettings) => ({
  TopupGroupRatio: settings.TopupGroupRatio,
  GroupRatio: settings.GroupRatio,
  UserUsableGroups: settings.UserUsableGroups,
  GroupGroupRatio: settings.GroupGroupRatio,
  AutoGroups: settings.AutoGroups,
  MaxTokenAutoGroups: settings.MaxTokenAutoGroups,
  DefaultUseAutoGroup: settings.DefaultUseAutoGroup,
  GroupSpecialUsableGroup:
    settings['group_ratio_setting.group_special_usable_group'],
})

const BILLING_SECTIONS = [
  {
    id: 'quota',
    titleKey: 'Quota Settings',
    build: (settings: BillingSettings) => (
      <QuotaSettingsSection
        defaultValues={{
          QuotaForNewUser: settings.QuotaForNewUser,
          QuotaForInviter: settings.QuotaForInviter,
          QuotaForInvitee: settings.QuotaForInvitee,
          TopUpLink: settings.TopUpLink,
          quota_setting: {
            trust_quota_usd: settings['quota_setting.trust_quota_usd'],
            pre_consume_multiplier:
              settings['quota_setting.pre_consume_multiplier'],
            enable_free_model_pre_consume:
              settings['quota_setting.enable_free_model_pre_consume'],
          },
        }}
        complianceConfirmed={
          (settings['payment_setting.compliance_confirmed'] ?? false) &&
          settings['payment_setting.compliance_terms_version'] === 'v1'
        }
      />
    ),
  },
  {
    id: 'currency',
    titleKey: 'Currency & Display',
    build: (settings: BillingSettings) => (
      <PricingSection
        defaultValues={{
          QuotaPerUnit: settings.QuotaPerUnit,
          USDExchangeRate: settings.USDExchangeRate,
          DisplayInCurrencyEnabled: settings.DisplayInCurrencyEnabled,
          DisplayTokenStatEnabled: settings.DisplayTokenStatEnabled,
          general_setting: {
            quota_display_type: parseCurrencyDisplayType(
              settings['general_setting.quota_display_type']
            ),
            custom_currency_symbol:
              settings['general_setting.custom_currency_symbol'] ?? '¤',
            custom_currency_exchange_rate:
              settings['general_setting.custom_currency_exchange_rate'] ?? 1,
          },
        }}
      />
    ),
  },
  {
    id: 'model-pricing',
    titleKey: 'Model Pricing',
    build: (settings: BillingSettings) => (
      <RatioSettingsCard
        titleKey='Model Pricing'
        modelDefaults={getModelDefaults(settings)}
        groupDefaults={getGroupDefaults(settings)}
        toolPricesDefault={settings['tool_price_setting.prices']}
        visibleTabs={['models', 'unset-models', 'tool-prices', 'upstream-sync']}
      />
    ),
  },
  {
    id: 'group-pricing',
    titleKey: 'Group Pricing',
    build: (settings: BillingSettings) => (
      <RatioSettingsCard
        titleKey='Group Pricing'
        modelDefaults={getModelDefaults(settings)}
        groupDefaults={getGroupDefaults(settings)}
        toolPricesDefault={settings['tool_price_setting.prices']}
        visibleTabs={['groups']}
      />
    ),
  },
  {
    id: 'payment',
    titleKey: 'Payment Gateway',
    build: (settings: BillingSettings) => (
      <PaymentSettingsSection
        defaultValues={{
          PayAddress: settings.PayAddress,
          EpayId: settings.EpayId,
          EpayKey: settings.EpayKey,
          Price: settings.Price,
          MinTopUp: settings.MinTopUp,
          CustomCallbackAddress: settings.CustomCallbackAddress,
          PayMethods: settings.PayMethods,
          AmountOptions: settings['payment_setting.amount_options'],
          AmountDiscount: settings['payment_setting.amount_discount'],
          AlipayEnabled: settings.AlipayEnabled ?? false,
          AlipaySandbox: settings.AlipaySandbox ?? false,
          AlipayAppId: settings.AlipayAppId ?? '',
          AlipayPrivateKey: settings.AlipayPrivateKey ?? '',
          AlipayPublicKey: settings.AlipayPublicKey ?? '',
          AlipayProductType: settings.AlipayProductType ?? 'page',
          AlipayMinTopUp: settings.AlipayMinTopUp ?? 1,
          AlipayGateway: settings.AlipayGateway ?? '',
          AlipayNotifyUrl: settings.AlipayNotifyUrl ?? '',
          AlipayReturnUrl: settings.AlipayReturnUrl ?? '',
          StripeApiSecret: settings.StripeApiSecret,
          StripeWebhookSecret: settings.StripeWebhookSecret,
          StripePriceId: settings.StripePriceId,
          StripeUnitPrice: settings.StripeUnitPrice,
          StripeMinTopUp: settings.StripeMinTopUp,
          StripePromotionCodesEnabled: settings.StripePromotionCodesEnabled,
          CreemApiKey: settings.CreemApiKey,
          CreemWebhookSecret: settings.CreemWebhookSecret,
          CreemTestMode: settings.CreemTestMode,
          CreemProducts: settings.CreemProducts,
        }}
        waffoDefaultValues={{
          WaffoEnabled: settings.WaffoEnabled ?? false,
          WaffoApiKey: settings.WaffoApiKey ?? '',
          WaffoPrivateKey: settings.WaffoPrivateKey ?? '',
          WaffoPublicCert: settings.WaffoPublicCert ?? '',
          WaffoSandboxPublicCert: settings.WaffoSandboxPublicCert ?? '',
          WaffoSandboxApiKey: settings.WaffoSandboxApiKey ?? '',
          WaffoSandboxPrivateKey: settings.WaffoSandboxPrivateKey ?? '',
          WaffoSandbox: settings.WaffoSandbox ?? false,
          WaffoMerchantId: settings.WaffoMerchantId ?? '',
          WaffoCurrency: settings.WaffoCurrency ?? 'USD',
          WaffoUnitPrice: settings.WaffoUnitPrice ?? 1,
          WaffoMinTopUp: settings.WaffoMinTopUp ?? 1,
          WaffoNotifyUrl: settings.WaffoNotifyUrl ?? '',
          WaffoReturnUrl: settings.WaffoReturnUrl ?? '',
          WaffoPayMethods: settings.WaffoPayMethods ?? '[]',
        }}
        waffoPancakeDefaultValues={{
          WaffoPancakeMerchantID: settings.WaffoPancakeMerchantID ?? '',
          WaffoPancakePrivateKey: settings.WaffoPancakePrivateKey ?? '',
          WaffoPancakeReturnURL: settings.WaffoPancakeReturnURL ?? '',
        }}
        waffoPancakeProvisionedStoreID={settings.WaffoPancakeStoreID ?? ''}
        waffoPancakeProvisionedProductID={settings.WaffoPancakeProductID ?? ''}
        complianceDefaults={{
          confirmed: settings['payment_setting.compliance_confirmed'] ?? false,
          termsVersion:
            settings['payment_setting.compliance_terms_version'] ?? '',
          confirmedAt: settings['payment_setting.compliance_confirmed_at'] ?? 0,
          confirmedBy: settings['payment_setting.compliance_confirmed_by'] ?? 0,
        }}
      />
    ),
  },
  {
    id: 'checkin',
    titleKey: 'Check-in Rewards',
    build: (settings: BillingSettings) => (
      <CheckinSettingsSection
        defaultValues={{
          enabled: settings['checkin_setting.enabled'],
          minQuota: settings['checkin_setting.min_quota'],
          maxQuota: settings['checkin_setting.max_quota'],
        }}
      />
    ),
  },
  {
    id: 'lottery',
    titleKey: 'Lucky Draw',
    build: (settings: BillingSettings) => (
      <LotterySettingsSection
        defaultValues={{
          enabled: settings['lottery_setting.enabled'],
          dailyFreeDraws: settings['lottery_setting.daily_free_draws'],
          singleCostQuota: settings['lottery_setting.single_cost_quota'],
          multiCostQuota: settings['lottery_setting.multi_cost_quota'],
          enableMulti: settings['lottery_setting.enable_multi'],
          requireNoDrawTodayForMulti:
            settings['lottery_setting.require_no_draw_today_for_multi'],
          publicWinsLimit: settings['lottery_setting.public_wins_limit'],
          minWinQuotaForPublic:
            settings['lottery_setting.min_win_quota_for_public'],
          prizes: settings['lottery_setting.prizes'],
        }}
      />
    ),
  },
  {
    id: 'welfare-chests',
    titleKey: 'Welfare Chests',
    build: (settings: BillingSettings) => (
      <WelfareChestSettingsSection
        defaultValues={{
          enabled: settings['welfare_chest_setting.enabled'],
          canOpenAny: settings['welfare_chest_setting.can_open_any'],
          unlimitedOpen: settings['welfare_chest_setting.unlimited_open'],
          chooseOnePerWeek:
            settings['welfare_chest_setting.choose_one_per_week'],
          maxQuotaLimit: settings['welfare_chest_setting.max_quota_limit'],
          xiaoshuaiGe: parseChestBox(
            settings['welfare_chest_setting.xiaoshuai_ge'],
            DEFAULT_XIAOSHUAI_GE
          ),
          heiDashuai: parseChestBox(
            settings['welfare_chest_setting.hei_dashuai'],
            DEFAULT_HEI_DASHUAI
          ),
        }}
        rawXiaoshuaiGe={settings['welfare_chest_setting.xiaoshuai_ge']}
        rawHeiDashuai={settings['welfare_chest_setting.hei_dashuai']}
      />
    ),
  },
  {
    id: 'rewards',
    titleKey: 'Rewards',
    build: (settings: BillingSettings) => (
      <RewardSettingsSection
        defaultValues={{
          enabled: settings['reward_setting.enabled'],
          maxQuotaLimit: settings['reward_setting.max_quota_limit'],
          historyPageSize: settings['reward_setting.history_page_size'],
          copy: parseRewardCopy(settings['reward_setting.default_copy'] ?? ''),
        }}
        rawCopy={settings['reward_setting.default_copy'] ?? ''}
      />
    ),
  },
] as const

export type BillingSectionId = (typeof BILLING_SECTIONS)[number]['id']

const billingRegistry = createSectionRegistry<
  BillingSectionId,
  BillingSettings
>({
  sections: BILLING_SECTIONS,
  defaultSection: 'quota',
  basePath: '/system-settings/billing',
  urlStyle: 'path',
})

export const BILLING_SECTION_IDS = billingRegistry.sectionIds
export const BILLING_DEFAULT_SECTION = billingRegistry.defaultSection
export const getBillingSectionNavItems = billingRegistry.getSectionNavItems
export const getBillingSectionContent = billingRegistry.getSectionContent
export const getBillingSectionMeta = billingRegistry.getSectionMeta
