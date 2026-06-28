import { z } from 'zod'
import { billingModeSchema as sharedBillingModeSchema } from '@cfdm/shared/contracts/provider-account'
import { customFieldsSchema } from '@cfdm/shared/contracts/custom-fields'

export const vpsStatusSchema = z.enum(['active', 'paused', 'archived'])
export const tariffTypeSchema = z.enum(['daily', 'monthly'])
export const billingModeSchema = sharedBillingModeSchema
export const paymentTypeSchema = z.enum([
  'direct_vps_payment',
  'provider_balance_topup',
  'daily_debit',
  'monthly_debit',
])
export const ledgerDirectionSchema = z.enum(['credit', 'debit'])
export const apiTypeSchema = z.enum(['billmanager', 'none'])

export const providerSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, 'Название обязательно'),
  website: z.string().url('Невалидный URL').or(z.literal('')).optional(),
  apiType: apiTypeSchema,
  apiBaseUrl: z.string().optional().default(''),
  baseCurrency: z.string().min(1).default('RUB'),
  usdRate: z.string().optional().default(''),
  eurRate: z.string().optional().default(''),
  supportPhone: z.string().optional().default(''),
  supportUrl: z.string().optional().default(''),
  notes: z.string().optional().default(''),
})

export const providerAccountSchema = z.object({
  id: z.string().min(1).optional(),
  providerId: z.string().min(1, 'Выберите хостера'),
  name: z.string().min(1, 'Название обязательно'),
  apiLogin: z.string().optional().default(''),
  apiPassword: z.string().optional().default(''),
  billingMode: billingModeSchema.default('monthly'),
  balanceAlertBelow: z.union([z.coerce.number().min(0), z.literal('')]).optional(),
  notes: z.string().optional().default(''),
})

export const vpsSchema = z.object({
  id: z.string().min(1).optional(),
  ip: z.string().min(1, 'IP обязателен'),
  dns: z.string().optional().default(''),
  providerId: z.string().min(1, 'Выберите хостера'),
  providerAccountId: z.string().min(1, 'Выберите аккаунт'),
  country: z.string().optional().default(''),
  city: z.string().optional().default(''),
  datacenter: z.string().optional().default(''),
  vcpu: z.coerce.number().int().min(0).default(1),
  ramGb: z.coerce.number().min(0).default(1),
  diskGb: z.coerce.number().min(0).default(10),
  status: vpsStatusSchema.default('active'),
  tariffType: tariffTypeSchema.default('monthly'),
  currency: z.string().min(1, 'Валюта обязательна').default('RUB'),
  monthlyRate: z.coerce.number().min(0).default(0),
  dailyRate: z.coerce.number().min(0).default(0),
  paidUntil: z.string().optional().default(''),
  project: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  userOverrides: z.array(z.string()).optional().default([]),
  customData: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().default({}),
})

export const paymentSchema = z.object({
  id: z.string().min(1).optional(),
  type: paymentTypeSchema,
  date: z.string().min(1, 'Дата обязательна'),
  amount: z.coerce.number().min(0, 'Сумма должна быть ≥ 0'),
  currency: z.string().min(1).default('RUB'),
  providerAccountId: z.string().min(1, 'Выберите аккаунт'),
  vpsId: z.string().optional().default(''),
  note: z.string().optional().default(''),
})

export const balanceLedgerSchema = z.object({
  providerAccountId: z.string().min(1, 'Выберите аккаунт'),
  direction: ledgerDirectionSchema,
  amount: z.coerce.number().min(0, 'Сумма должна быть ≥ 0'),
  currency: z.string().min(1).default('RUB'),
  date: z.string().min(1, 'Дата обязательна'),
  note: z.string().optional().default(''),
})

export const settingsSchema = z.object({
  id: z.string().optional(),
  baseCurrency: z.string().min(1).default('RUB'),
  ratesUrl: z.string().url('Невалидный URL').or(z.literal('')).optional(),
  autoConvert: z.boolean().default(true),
  syncEnabled: z.boolean().optional().default(true),
  syncIntervalMinutes: z.coerce.number().min(15).optional().default(60),
  syncTariffsIntervalMinutes: z.coerce.number().min(60).optional().default(1440),
  telegramChatId: z.string().optional().default(''),
  telegramBotToken: z.string().optional().default(''),
  telegramMessageThreadId: z.string().optional().default(''),
  notifyPaymentExpiryEnabled: z.boolean().optional().default(true),
  notifyNewTariffsEnabled: z.boolean().optional().default(true),
  notifyLowBalanceEnabled: z.boolean().optional().default(true),
  notifySyncDigestEnabled: z.boolean().optional().default(true),
  notifyVpsDownEnabled: z.boolean().optional().default(true),
  webhookUrl: z.string().url('Невалидный URL').or(z.literal('')).optional().default(''),
  webhookEnabled: z.boolean().optional().default(false),
  customFields: customFieldsSchema
    .default([])
    .refine(
      (fields) => new Set(fields.map((f) => f.key)).size === fields.length,
      'Ключи кастомных полей должны быть уникальными',
    ),
})

export const projectSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Укажите название проекта').max(120),
  color: z.string().optional().default(''),
})

export type ProjectFormValues = z.infer<typeof projectSchema>

export type ProviderFormValues = z.infer<typeof providerSchema>
export type ProviderAccountFormValues = z.infer<typeof providerAccountSchema>
export type VpsFormValues = z.infer<typeof vpsSchema>
export type PaymentFormValues = z.infer<typeof paymentSchema>
export type BalanceLedgerFormValues = z.infer<typeof balanceLedgerSchema>
export type SettingsFormValues = z.infer<typeof settingsSchema>
