import { z } from 'zod'

export const settingsSchema = z.object({
  id: z.string().optional(),
  baseCurrency: z.string().optional(),
  ratesUrl: z.string().optional(),
  autoConvert: z.boolean().optional(),
  ratesUpdatedAt: z.string().optional(),
  syncEnabled: z.boolean().optional(),
  syncIntervalMinutes: z.coerce.number().optional(),
  syncTariffsIntervalMinutes: z.coerce.number().optional(),
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
  telegramMessageThreadId: z.string().optional(),
  notifyPaymentExpiryEnabled: z.boolean().optional(),
  notifyNewTariffsEnabled: z.boolean().optional(),
  notifyLowBalanceEnabled: z.boolean().optional(),
  notifySyncDigestEnabled: z.boolean().optional(),
  notifyVpsDownEnabled: z.boolean().optional(),
  webhookUrl: z.string().url('Невалидный URL').or(z.literal('')).optional(),
  webhookEnabled: z.boolean().optional(),
  customFields: z.any().optional(),
})

export type Settings = z.infer<typeof settingsSchema>
