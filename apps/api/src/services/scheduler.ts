import { eq, sql } from 'drizzle-orm'
import { getDb, schema, runWithSpaceAsync, MAIN_SPACE_ID } from '@cfdm/db'
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

type AccountRow = typeof schema.providerAccounts.$inferSelect
type SettingsRow = typeof schema.settings.$inferSelect

interface SyncableAccountEntry {
  account: SyncReadyAccount
  apiType: string
}

function getSyncableAccounts(spaceId: string): SyncableAccountEntry[] {
  const db = getDb()
  const rows = db
    .all<AccountRow>(sql`
      SELECT pa.* FROM provider_accounts pa
      INNER JOIN providers p ON p.id = pa.providerId
      WHERE pa.spaceId = ${spaceId}
        AND lower(trim(COALESCE(p.apiType, ''))) IN ('billmanager', '4vps', 'macloud', 'vdsina', 'veesp', 'ruvds')
        AND length(trim(COALESCE(p.apiBaseUrl, ''))) > 0
        AND pa.apiCredentials IS NOT NULL AND length(trim(pa.apiCredentials)) > 0
    `)
  const providers = db
    .select()
    .from(schema.providers)
    .where(eq(schema.providers.spaceId, spaceId))
    .all()
  const providerById = new Map(providers.map((p) => [p.id, p]))
  return rows
    .map((a) => {
      const resolved = resolveSyncAccount(a, providerById.get(a.providerId))
      return resolved ? { account: resolved.account, apiType: resolved.apiType } : null
    })
    .filter((e): e is SyncableAccountEntry => e != null)
}

function allSettings(): SettingsRow[] {
  return settingsRepository.listAllSpaces()
}

export async function runNotificationTick(): Promise<void> {
  for (const settings of allSettings()) {
    const spaceId = settings.spaceId || MAIN_SPACE_ID
    try {
      await runWithSpaceAsync(spaceId, async () => {
        const payload = buildPaymentExpiryNotification()
        if (payload) await publishNotification(settings, payload)
      })
    } catch (err) {
      console.warn(
        `Notification tick error [${spaceId}]:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
}

export async function runScheduledSync(): Promise<void> {
  for (const settings of allSettings()) {
    if (!settings.syncEnabled) continue
    const spaceId = settings.spaceId || MAIN_SPACE_ID
    try {
      await runWithSpaceAsync(spaceId, async () => {
        const entries = getSyncableAccounts(spaceId)
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
            digestLines.push(
              `✓ ${account.name}: ${parts.length ? parts.join(', ') : 'без изменений'}`,
            )

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
              const cur =
                result.balance?.currency || account.balanceCurrency || account.currency || ''
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
      })
    } catch (err) {
      console.warn(`Scheduled sync error [${spaceId}]:`, err instanceof Error ? err.message : err)
    }
  }
}

export async function runScheduledSyncTariffs(): Promise<void> {
  for (const settings of allSettings()) {
    if (!settings.syncEnabled) continue
    const spaceId = settings.spaceId || MAIN_SPACE_ID
    try {
      await runWithSpaceAsync(spaceId, async () => {
        const entries = getSyncableAccounts(spaceId)
        const providers = getDb()
          .select()
          .from(schema.providers)
          .where(eq(schema.providers.spaceId, spaceId))
          .all()

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
            console.warn(
              `Sync tariffs failed for account ${account.id}:`,
              err instanceof Error ? err.message : err,
            )
          }
        }
      })
    } catch (err) {
      console.warn(
        `Scheduled sync tariffs error [${spaceId}]:`,
        err instanceof Error ? err.message : err,
      )
    }
  }
}

export async function runScheduledUptimeChecks(): Promise<void> {
  for (const settings of allSettings()) {
    const spaceId = settings.spaceId || MAIN_SPACE_ID
    try {
      await runWithSpaceAsync(spaceId, async () => {
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
      })
    } catch (err) {
      console.warn(`Uptime check error [${spaceId}]:`, err instanceof Error ? err.message : err)
    }
  }
}

function pickSchedulerIntervals(rows: SettingsRow[]): {
  notifyInterval: number
  uptimeInterval: number
  syncInterval: number | null
  tariffsInterval: number | null
} {
  let notifyInterval = 60
  let uptimeInterval = 5
  let syncInterval: number | null = null
  let tariffsInterval: number | null = null

  for (const s of rows) {
    notifyInterval = Math.min(
      notifyInterval,
      Math.max(15, Number(s.notifyIntervalMinutes) || 60),
    )
    uptimeInterval = Math.min(
      uptimeInterval,
      Math.max(1, Number(s.uptimeCheckIntervalMinutes) || 5),
    )
    if (s.syncEnabled) {
      const si = Math.max(15, Number(s.syncIntervalMinutes) || 60)
      const ti = Math.max(60, Number(s.syncTariffsIntervalMinutes) || 1440)
      syncInterval = syncInterval == null ? si : Math.min(syncInterval, si)
      tariffsInterval = tariffsInterval == null ? ti : Math.min(tariffsInterval, ti)
    }
  }
  return { notifyInterval, uptimeInterval, syncInterval, tariffsInterval }
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
    const rows = allSettings()
    if (rows.length === 0) return

    const { notifyInterval, uptimeInterval, syncInterval, tariffsInterval } =
      pickSchedulerIntervals(rows)

    notifyIntervalId = setInterval(() => void runNotificationTick(), notifyInterval * 60 * 1000)
    uptimeIntervalId = setInterval(
      () => void runScheduledUptimeChecks(),
      uptimeInterval * 60 * 1000,
    )
    void runNotificationTick()
    void runScheduledUptimeChecks()

    const parts = [
      `notify every ${notifyInterval} min`,
      `uptime every ${uptimeInterval} min`,
      `spaces=${rows.length}`,
    ]

    if (syncInterval != null) {
      syncIntervalId = setInterval(() => void runScheduledSync(), syncInterval * 60 * 1000)
      parts.unshift(`sync every ${syncInterval} min`)
    }
    if (tariffsInterval != null) {
      syncTariffsIntervalId = setInterval(
        () => void runScheduledSyncTariffs(),
        tariffsInterval * 60 * 1000,
      )
      parts.unshift(`tariffs every ${tariffsInterval} min`)
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
