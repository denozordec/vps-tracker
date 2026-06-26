import { z } from 'zod'

export const vpsStatusSchema = z.enum(['active', 'paused', 'archived'])
export const tariffTypeSchema = z.enum(['daily', 'monthly'])
export const billingModeSchema = z.enum(['daily', 'monthly'])
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
  login: z.string().optional().default(''),
  apiCredentials: z.string().optional().default(''),
  billingMode: billingModeSchema.default('monthly'),
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
})

export const paymentSchema = z.object({
  id: z.string().min(1).optional(),
  type: paymentTypeSchema,
  date: z.string().min(1, 'Дата обязательна'),
  amount: z.coerce.number().min(0, 'Сумма должна быть ≥ 0'),
  currency: z.string().min(1).default('RUB'),
  providerAccountId: z.string().min(1, 'Выберите аккаунт'),
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
  telegramChatId: z.string().optional().default(''),
  telegramBotToken: z.string().optional().default(''),
})

export type ProviderFormValues = z.infer<typeof providerSchema>
export type ProviderAccountFormValues = z.infer<typeof providerAccountSchema>
export type VpsFormValues = z.infer<typeof vpsSchema>
export type PaymentFormValues = z.infer<typeof paymentSchema>
export type BalanceLedgerFormValues = z.infer<typeof balanceLedgerSchema>
export type SettingsFormValues = z.infer<typeof settingsSchema>
