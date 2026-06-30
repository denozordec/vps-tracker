import { sql } from 'drizzle-orm'
import { getDb, schema } from '@cfdm/db'
import { settingsRepository } from '@cfdm/db/repositories/settings'

import { resolveSyncAccount, getProviderAdapter, type SyncReadyAccount } from './providers/index.js'
import { runAccountSync } from './providers/sync-job.js'
import { runVpsUptimeChecks } from './uptime-check.js'
import { notifyCfdmVpsEvent } from './cfdm-notify.js'
import { publishMany, publishNotification } from './notifications/engine.js'
import {
  buildLowBalanceNotification,
  buildNewTariffsNotification,
  buildPaymentExpiryNotification,
  buildSyncDigestNotification,
  buildVpsHealthNotification,
} from './notifications/rules.js'

let syncIntervalId: ReturnType<typeof setInterval> | null = null
let syncTariffsIntervalId: ReturnType<typeof setInterval> | null = null
let notifyIntervalId: ReturnType<typeof setInterval> | null = null
let uptimeIntervalId: ReturnType<typeof setInterval> | null = null

const SETTINGS_ID = 'settings-main'

type AccountRow = typeof schema.providerAccounts.$inferSelect

interface SyncableAccountEntry {
  account: SyncReadyAccount
  apiType: string
}

function getSyncableAccounts(): SyncableAccountEntry[] {
  const db = getDb()
  const rows = db
    .all<AccountRow>(sql`
      SELECT pa.* FROM provider_accounts pa
      INNER JOIN providers p ON p.id = pa.providerId
      WHERE lower(trim(COALESCE(p.apiType, ''))) IN ('billmanager', '4vps', 'macloud', 'vdsina', 'veesp', 'ruvds')
        AND length(trim(COALESCE(p.apiBaseUrl, ''))) > 0
        AND pa.apiCredentials IS NOT NULL AND length(trim(pa.apiCredentials)) > 0
    `)
  const providers = db.select().from(schema.providers).all()
  const providerById = new Map(providers.map((p) => [p.id, p]))
  return rows
    .map((a) => {
      const resolved = resolveSyncAccount(a, providerById.get(a.providerId))
      return resolved ? { account: resolved.account, apiType: resolved.apiType } : null
    })
    .filter((e): e is SyncableAccountEntry => e != null)
}

export async function runNotificationTick(): Promise<void> {
  try {
    const settings = settingsRepository.getRow(SETTINGS_ID)
    if (!settings) return
    const payload = buildPaymentExpiryNotification()
    if (payload) await publishNotification(settings, payload)
  } catch (err) {
    console.warn('Notification tick error:', err instanceof Error ? err.message : err)
  }
}

export async function runScheduledSync(): Promise<void> {
  try {
    const settings = settingsRepository.getRow(SETTINGS_ID)
    if (!settings?.syncEnabled) return

    const entries = getSyncableAccounts()
    const digestLines: string[] = []
    const lowBalanceLines: string[] = []

    for (const { account, apiType } of entries) {
      try {
        const adapter = getProviderAdapter(apiType)
        const result = await runAccountSync(adapter, account, { skipTariffs: true })
        const s = result.syncSummary
        const parts: string[] = []
        if (s.added?.length) parts.push(`+${s.added.length} VPS`)
        if (s.updated?.length) parts.push(`изм. ${s.updated.length}`)
        if (result.paymentsCount) parts.push(`платежи +${result.paymentsCount}`)
        digestLines.push(`✓ ${account.name}: ${parts.length ? parts.join(', ') : 'без изменений'}`)

        const apiBal = result.balance?.balance
        const threshold = account.balanceAlertBelow
        if (
          settings.notifyLowBalanceEnabled &&
          threshold != null &&
          Number.isFinite(Number(threshold)) &&
          apiBal != null &&
          Number.isFinite(Number(apiBal)) &&
          Number(apiBal) < Number(threshold)
        ) {
          const cur = result.balance?.currency || account.balanceCurrency || account.currency || ''
          lowBalanceLines.push(`• ${account.name}: ${apiBal} ${cur} (порог ${threshold})`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'ошибка'
        digestLines.push(`✗ ${account.name}: ${message}`)
      }
    }

    await publishMany(settings, [
      buildSyncDigestNotification(digestLines),
      buildLowBalanceNotification(lowBalanceLines),
    ])
  } catch (err) {
    console.warn('Scheduled sync error:', err instanceof Error ? err.message : err)
  }
}

export async function runScheduledSyncTariffs(): Promise<void> {
  try {
    const settings = settingsRepository.getRow(SETTINGS_ID)
    if (!settings?.syncEnabled) return

    const entries = getSyncableAccounts()
    const providers = getDb().select().from(schema.providers).all()

    for (const { account, apiType } of entries) {
      try {
        const adapter = getProviderAdapter(apiType)
        const result = await runAccountSync(adapter, account, { skipVpsPayments: true })
        const newTariffs = result.newTariffs || []
        if (newTariffs.length > 0 && settings.notifyNewTariffsEnabled) {
          const provider = providers.find((p) => p.id === account.providerId)
          const providerName = provider?.name || account.name || '-'
          const payload = buildNewTariffsNotification(
            providerName,
            newTariffs.map((t) => ({ name: t.name, price: t.price })),
          )
          if (payload) await publishNotification(settings, payload)
        }
      } catch (err) {
        console.warn(`Sync tariffs failed for account ${account.id}:`, err instanceof Error ? err.message : err)
      }
    }
  } catch (err) {
    console.warn('Scheduled sync tariffs error:', err instanceof Error ? err.message : err)
  }
}

export async function runScheduledUptimeChecks(): Promise<void> {
  try {
    const settings = settingsRepository.getRow(SETTINGS_ID)
    if (!settings) return

    const { newlyDown, newlyUp } = await runVpsUptimeChecks()
    await publishMany(settings, [
      buildVpsHealthNotification(
        'vps_down',
        newlyDown.map((h) => ({ id: h.id, label: h.label })),
      ),
      buildVpsHealthNotification(
        'vps_up',
        newlyUp.map((h) => ({ id: h.id, label: h.label })),
      ),
    ])
    if (newlyDown.length > 0) {
      void notifyCfdmVpsEvent(
        'vps_down',
        newlyDown.map((h) => h.id),
      )
    }
  } catch (err) {
    console.warn('Uptime check error:', err instanceof Error ? err.message : err)
  }
}

export function startScheduler(): void {
  if (syncIntervalId) clearInterval(syncIntervalId)
  syncIntervalId = null
  if (syncTariffsIntervalId) clearInterval(syncTariffsIntervalId)
  syncTariffsIntervalId = null
  if (notifyIntervalId) clearInterval(notifyIntervalId)
  notifyIntervalId = null
  if (uptimeIntervalId) clearInterval(uptimeIntervalId)
  uptimeIntervalId = null

  try {
    const settings = settingsRepository.getRow(SETTINGS_ID)
    if (!settings) return

    const notifyInterval = Math.max(15, Number(settings.notifyIntervalMinutes) || 60)
    const uptimeInterval = Math.max(1, Number(settings.uptimeCheckIntervalMinutes) || 5)

    notifyIntervalId = setInterval(() => void runNotificationTick(), notifyInterval * 60 * 1000)
    uptimeIntervalId = setInterval(() => void runScheduledUptimeChecks(), uptimeInterval * 60 * 1000)
    void runNotificationTick()
    void runScheduledUptimeChecks()

    const parts = [`notify every ${notifyInterval} min`, `uptime every ${uptimeInterval} min`]

    if (settings.syncEnabled) {
      const interval = Math.max(15, Number(settings.syncIntervalMinutes) || 60)
      const tariffsInterval = Math.max(60, Number(settings.syncTariffsIntervalMinutes) || 1440)
      syncIntervalId = setInterval(() => void runScheduledSync(), interval * 60 * 1000)
      syncTariffsIntervalId = setInterval(
        () => void runScheduledSyncTariffs(),
        tariffsInterval * 60 * 1000,
      )
      parts.unshift(`sync every ${interval} min`, `tariffs every ${tariffsInterval} min`)
    }

    console.log(`Scheduler: ${parts.join(', ')}`)
  } catch {
    // ignore
  }
}

export function stopScheduler(): void {
  if (syncIntervalId) clearInterval(syncIntervalId)
  syncIntervalId = null
  if (syncTariffsIntervalId) clearInterval(syncTariffsIntervalId)
  syncTariffsIntervalId = null
  if (notifyIntervalId) clearInterval(notifyIntervalId)
  notifyIntervalId = null
  if (uptimeIntervalId) clearInterval(uptimeIntervalId)
  uptimeIntervalId = null
}

export function restartScheduler(): void {
  stopScheduler()
  startScheduler()
}
