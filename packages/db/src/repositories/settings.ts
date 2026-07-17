import { asc, eq } from 'drizzle-orm'
import {
  appSwitcherConfigSchema,
  type AppSwitcherConfig,
} from '@cfdm/shared/contracts/app-switcher'
import { getDb, schema } from '../index.js'

type Row = typeof schema.settings.$inferSelect

const DEFAULT_APP_SWITCHER: AppSwitcherConfig = {
  menuLabel: 'Приложения',
  apps: [
    {
      id: 'vps-tracker',
      name: 'VPS Tracker',
      subtitle: 'Учёт виртуальных серверов',
      url: 'http://192.168.100.67:3001',
      icon: 'server',
      shortcut: '⌘1',
    },
    {
      id: 'cfdm',
      name: 'CF Domain Manager',
      subtitle: 'Управление доменами',
      url: 'http://192.168.100.67:6363',
      icon: 'cloud',
      shortcut: '⌘2',
    },
    {
      id: 'evobgp',
      name: 'EvoBGP',
      subtitle: 'BGP маршрутизация',
      url: 'http://192.168.100.67:3000',
      icon: 'globe',
      shortcut: '⌘3',
    },
  ],
}

export type SettingsDto = Omit<
  Row,
  | 'telegramBotToken'
  | 'integrationToken'
  | 'autoConvert'
  | 'syncEnabled'
  | 'notifyPaymentExpiryEnabled'
  | 'notifyNewTariffsEnabled'
  | 'notifyLowBalanceEnabled'
  | 'notifySyncDigestEnabled'
  | 'notifyVpsDownEnabled'
  | 'webhookEnabled'
  | 'integrationEnabled'
  | 'customFields'
  | 'appSwitcherJson'
  | 'showQuickActions'
> & {
  telegramBotTokenSet: boolean
  integrationTokenSet: boolean
  autoConvert: boolean
  syncEnabled: boolean
  notifyPaymentExpiryEnabled: boolean
  notifyNewTariffsEnabled: boolean
  notifyLowBalanceEnabled: boolean
  notifySyncDigestEnabled: boolean
  notifyVpsDownEnabled: boolean
  webhookEnabled: boolean
  integrationEnabled: boolean
  showQuickActions: boolean
  notifyIntervalMinutes: number
  uptimeCheckIntervalMinutes: number
  customFields: unknown[]
  appSwitcher: AppSwitcherConfig
}

function parseAppSwitcher(raw: string | null | undefined): AppSwitcherConfig {
  if (!raw?.trim()) return DEFAULT_APP_SWITCHER
  try {
    return appSwitcherConfigSchema.parse(JSON.parse(raw))
  } catch {
    return DEFAULT_APP_SWITCHER
  }
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
  const { telegramBotToken, integrationToken, appSwitcherJson, showQuickActions: _showQa, ...rest } =
    row
  return {
    ...rest,
    telegramBotTokenSet: Boolean(telegramBotToken?.trim()),
    integrationTokenSet: Boolean(integrationToken?.trim()),
    autoConvert: Boolean(row.autoConvert),
    syncEnabled: Boolean(row.syncEnabled),
    notifyPaymentExpiryEnabled: Boolean(row.notifyPaymentExpiryEnabled),
    notifyNewTariffsEnabled: Boolean(row.notifyNewTariffsEnabled),
    notifyLowBalanceEnabled: Boolean(row.notifyLowBalanceEnabled),
    notifySyncDigestEnabled: Boolean(row.notifySyncDigestEnabled),
    notifyVpsDownEnabled: Boolean(row.notifyVpsDownEnabled),
    webhookEnabled: Boolean(row.webhookEnabled),
    integrationEnabled: Boolean(row.integrationEnabled),
    showQuickActions: row.showQuickActions == null ? true : Boolean(row.showQuickActions),
    notifyIntervalMinutes: Number(row.notifyIntervalMinutes) || 60,
    uptimeCheckIntervalMinutes: Number(row.uptimeCheckIntervalMinutes) || 5,
    customFields: Array.isArray(customFields) ? customFields : [],
    appSwitcher: parseAppSwitcher(appSwitcherJson),
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
  appSwitcher?: AppSwitcherConfig
  integrationToken?: string
  integrationEnabled?: boolean
  integrationLastSyncAt?: string
  cfdmApiUrl?: string
  showQuickActions?: boolean
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
      r.telegramBotToken !== undefined && String(r.telegramBotToken || '').trim() !== ''
        ? r.telegramBotToken
        : existing?.telegramBotToken ?? '',
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
    appSwitcherJson:
      r.appSwitcher !== undefined
        ? JSON.stringify(r.appSwitcher)
        : existing?.appSwitcherJson ?? JSON.stringify(DEFAULT_APP_SWITCHER),
    integrationToken:
      r.integrationToken !== undefined && String(r.integrationToken || '').trim() !== ''
        ? r.integrationToken
        : existing?.integrationToken ?? '',
    integrationEnabled:
      r.integrationEnabled !== undefined
        ? r.integrationEnabled
          ? 1
          : 0
        : existing?.integrationEnabled
          ? 1
          : 0,
    integrationLastSyncAt:
      r.integrationLastSyncAt !== undefined
        ? r.integrationLastSyncAt || ''
        : existing?.integrationLastSyncAt ?? '',
    cfdmApiUrl: r.cfdmApiUrl !== undefined ? r.cfdmApiUrl || '' : existing?.cfdmApiUrl ?? '',
    showQuickActions:
      r.showQuickActions !== undefined
        ? r.showQuickActions
          ? 1
          : 0
        : existing?.showQuickActions == null
          ? 1
          : existing.showQuickActions
            ? 1
            : 0,
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
  getIntegrationToken(id = 'settings-main'): string {
    return this.getRow(id)?.integrationToken?.trim() ?? ''
  },
  getAppSwitcher(id = 'settings-main'): AppSwitcherConfig {
    const row = this.getRow(id)
    return parseAppSwitcher(row?.appSwitcherJson)
  },
  touchIntegrationSync(id = 'settings-main'): void {
    const db = getDb()
    const at = new Date().toISOString()
    const existing = this.getRow(id)
    if (existing) {
      db.update(schema.settings)
        .set({ integrationLastSyncAt: at })
        .where(eq(schema.settings.id, id))
        .run()
    }
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
