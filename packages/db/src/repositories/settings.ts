import { asc, eq } from 'drizzle-orm'
import { getDb, schema } from '../index.js'

type Row = typeof schema.settings.$inferSelect

export type SettingsDto = Omit<Row, 'telegramBotToken' | 'autoConvert' | 'syncEnabled' | 'notifyPaymentExpiryEnabled' | 'notifyNewTariffsEnabled' | 'notifyLowBalanceEnabled' | 'notifySyncDigestEnabled' | 'notifyVpsDownEnabled' | 'webhookEnabled' | 'customFields'> & {
  telegramBotTokenSet: boolean
  autoConvert: boolean
  syncEnabled: boolean
  notifyPaymentExpiryEnabled: boolean
  notifyNewTariffsEnabled: boolean
  notifyLowBalanceEnabled: boolean
  notifySyncDigestEnabled: boolean
  notifyVpsDownEnabled: boolean
  webhookEnabled: boolean
  notifyIntervalMinutes: number
  uptimeCheckIntervalMinutes: number
  customFields: unknown[]
}

function toDto(row: Row | undefined): SettingsDto | undefined {
  if (!row) return undefined
  let customFields: unknown[] = []
  if (row.customFields) {
    try {
      customFields = JSON.parse(row.customFields)
    } catch {
      customFields = []
    }
  }
  const { telegramBotToken, ...rest } = row
  return {
    ...rest,
    telegramBotTokenSet: Boolean(telegramBotToken?.trim()),
    autoConvert: Boolean(row.autoConvert),
    syncEnabled: Boolean(row.syncEnabled),
    notifyPaymentExpiryEnabled: Boolean(row.notifyPaymentExpiryEnabled),
    notifyNewTariffsEnabled: Boolean(row.notifyNewTariffsEnabled),
    notifyLowBalanceEnabled: Boolean(row.notifyLowBalanceEnabled),
    notifySyncDigestEnabled: Boolean(row.notifySyncDigestEnabled),
    notifyVpsDownEnabled: Boolean(row.notifyVpsDownEnabled),
    webhookEnabled: Boolean(row.webhookEnabled),
    notifyIntervalMinutes: Number(row.notifyIntervalMinutes) || 60,
    uptimeCheckIntervalMinutes: Number(row.uptimeCheckIntervalMinutes) || 5,
    customFields: Array.isArray(customFields) ? customFields : [],
  }
}

function serializeCustomFields(val: unknown): string | null {
  if (val == null) return null
  if (Array.isArray(val)) return JSON.stringify(val)
  if (typeof val === 'string') return val || null
  return null
}

interface SettingsInput {
  baseCurrency?: string
  ratesUrl?: string
  autoConvert?: boolean
  ratesUpdatedAt?: string
  syncEnabled?: boolean
  syncIntervalMinutes?: number
  syncTariffsIntervalMinutes?: number
  telegramBotToken?: string
  telegramChatId?: string
  telegramMessageThreadId?: string
  notifyPaymentExpiryEnabled?: boolean
  notifyNewTariffsEnabled?: boolean
  notifyLowBalanceEnabled?: boolean
  notifySyncDigestEnabled?: boolean
  notifyVpsDownEnabled?: boolean
  webhookUrl?: string
  webhookEnabled?: boolean
  notifyIntervalMinutes?: number
  uptimeCheckIntervalMinutes?: number
  customFields?: unknown
}

function buildValues(id: string, existing: Row | undefined, r: SettingsInput) {
  return {
    id,
    baseCurrency: r.baseCurrency ?? existing?.baseCurrency ?? 'RUB',
    ratesUrl: r.ratesUrl ?? existing?.ratesUrl ?? '',
    autoConvert:
      r.autoConvert !== undefined ? (r.autoConvert ? 1 : 0) : existing?.autoConvert ? 1 : 0,
    ratesUpdatedAt: r.ratesUpdatedAt ?? existing?.ratesUpdatedAt ?? '',
    syncEnabled:
      r.syncEnabled !== undefined ? (r.syncEnabled ? 1 : 0) : existing?.syncEnabled ? 1 : 0,
    syncIntervalMinutes:
      r.syncIntervalMinutes !== undefined
        ? Math.max(15, Number(r.syncIntervalMinutes) || 60)
        : existing?.syncIntervalMinutes ?? 60,
    syncTariffsIntervalMinutes:
      r.syncTariffsIntervalMinutes !== undefined
        ? Math.max(60, Number(r.syncTariffsIntervalMinutes) || 1440)
        : existing?.syncTariffsIntervalMinutes ?? 1440,
    telegramBotToken:
      r.telegramBotToken !== undefined ? r.telegramBotToken || '' : existing?.telegramBotToken ?? '',
    telegramChatId:
      r.telegramChatId !== undefined ? r.telegramChatId || '' : existing?.telegramChatId ?? '',
    telegramMessageThreadId:
      r.telegramMessageThreadId !== undefined
        ? r.telegramMessageThreadId || ''
        : existing?.telegramMessageThreadId ?? '',
    notifyPaymentExpiryEnabled:
      r.notifyPaymentExpiryEnabled !== undefined
        ? r.notifyPaymentExpiryEnabled
          ? 1
          : 0
        : existing?.notifyPaymentExpiryEnabled
          ? 1
          : 0,
    notifyNewTariffsEnabled:
      r.notifyNewTariffsEnabled !== undefined
        ? r.notifyNewTariffsEnabled
          ? 1
          : 0
        : existing?.notifyNewTariffsEnabled
          ? 1
          : 0,
    notifyLowBalanceEnabled:
      r.notifyLowBalanceEnabled !== undefined
        ? r.notifyLowBalanceEnabled
          ? 1
          : 0
        : existing?.notifyLowBalanceEnabled
          ? 1
          : 0,
    notifySyncDigestEnabled:
      r.notifySyncDigestEnabled !== undefined
        ? r.notifySyncDigestEnabled
          ? 1
          : 0
        : existing?.notifySyncDigestEnabled
          ? 1
          : 0,
    notifyVpsDownEnabled:
      r.notifyVpsDownEnabled !== undefined
        ? r.notifyVpsDownEnabled
          ? 1
          : 0
        : existing?.notifyVpsDownEnabled
          ? 1
          : 0,
    webhookUrl: r.webhookUrl !== undefined ? r.webhookUrl || '' : existing?.webhookUrl ?? '',
    webhookEnabled:
      r.webhookEnabled !== undefined ? (r.webhookEnabled ? 1 : 0) : existing?.webhookEnabled ? 1 : 0,
    notifyIntervalMinutes:
      r.notifyIntervalMinutes !== undefined
        ? Math.max(15, Number(r.notifyIntervalMinutes) || 60)
        : existing?.notifyIntervalMinutes ?? 60,
    uptimeCheckIntervalMinutes:
      r.uptimeCheckIntervalMinutes !== undefined
        ? Math.max(1, Number(r.uptimeCheckIntervalMinutes) || 5)
        : existing?.uptimeCheckIntervalMinutes ?? 5,
    customFields: serializeCustomFields(r.customFields ?? existing?.customFields),
  }
}

export const settingsRepository = {
  list(): SettingsDto[] {
    const rows = getDb().select().from(schema.settings).orderBy(asc(schema.settings.id)).all()
    return rows.map((r) => toDto(r)!) as SettingsDto[]
  },
  get(id: string): SettingsDto | undefined {
    return toDto(getDb().select().from(schema.settings).where(eq(schema.settings.id, id)).get())
  },
  getRow(id: string): Row | undefined {
    return getDb().select().from(schema.settings).where(eq(schema.settings.id, id)).get()
  },
  upsert(id: string, input: SettingsInput): SettingsDto {
    const db = getDb()
    const existing = this.getRow(id)
    const values = buildValues(id, existing, input)
    if (existing) {
      db.update(schema.settings).set(values).where(eq(schema.settings.id, id)).run()
    } else {
      db.insert(schema.settings).values(values).run()
    }
    return this.get(id)!
  },
}
