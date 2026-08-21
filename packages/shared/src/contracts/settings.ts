import { z } from 'zod'
import { customFieldsSchema } from './custom-fields.js'
import { appSwitcherConfigSchema } from './app-switcher.js'

/** Cloud Bot API origin. Local telegram-bot-api: http://127.0.0.1:8081 or https via TLS proxy. */
export const DEFAULT_TELEGRAM_API_URL = 'https://api.telegram.org'

export function normalizeTelegramApiUrl(raw?: string | null): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return DEFAULT_TELEGRAM_API_URL
  return trimmed.replace(/\/+$/, '').replace(/\/bot$/i, '')
}

export const telegramApiUrlSchema = z
  .string()
  .optional()
  .transform((value) => normalizeTelegramApiUrl(value))
  .pipe(z.string().url('Невалидный URL'))

export const settingsSchema = z.object({
  id: z.string().optional(),
  baseCurrency: z.string().optional(),
  ratesUrl: z.string().optional(),
  autoConvert: z.boolean().optional(),
  ratesUpdatedAt: z.string().optional(),
  syncEnabled: z.boolean().optional(),
  syncIntervalMinutes: z.coerce.number().optional(),
  syncTariffsIntervalMinutes: z.coerce.number().optional(),
  notifyIntervalMinutes: z.coerce.number().optional(),
  uptimeCheckIntervalMinutes: z.coerce.number().optional(),
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
  telegramApiUrl: telegramApiUrlSchema,
  telegramMessageThreadId: z.string().optional(),
  notifyPaymentExpiryEnabled: z.boolean().optional(),
  notifyNewTariffsEnabled: z.boolean().optional(),
  notifyLowBalanceEnabled: z.boolean().optional(),
  notifySyncDigestEnabled: z.boolean().optional(),
  notifyVpsDownEnabled: z.boolean().optional(),
  webhookUrl: z.string().url('Невалидный URL').or(z.literal('')).optional(),
  webhookEnabled: z.boolean().optional(),
  customFields: customFieldsSchema.optional(),
  appSwitcher: appSwitcherConfigSchema.optional(),
  integrationToken: z.string().optional(),
  integrationEnabled: z.boolean().optional(),
  cfdmApiUrl: z.string().url('Невалидный URL').or(z.literal('')).optional(),
  showQuickActions: z.boolean().optional(),
})

export type Settings = z.infer<typeof settingsSchema>

export const telegramTestBodySchema = z.object({
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
  telegramApiUrl: z.string().url('Невалидный URL').or(z.literal('')).optional(),
  telegramMessageThreadId: z.string().optional(),
})

export type TelegramTestBody = z.infer<typeof telegramTestBodySchema>
