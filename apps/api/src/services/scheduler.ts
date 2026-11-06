import { eq, sql } from 'drizzle-orm'
import { getDb, getSqlite, pruneOldLogs, schema, runWithSpaceAsync, MAIN_SPACE_ID } from '@cfdm/db'
import { settingsRepository } from '@cfdm/db/repositories/settings'

import { resolveSyncAccount, getProviderAdapter, type SyncReadyAccount } from './providers/index.js'
import { runAccountSync } from './providers/sync-job.js'
import { runVpsUptimeChecks } from './uptime-check.js'
import { notifyCfdmVpsEvent } from './cfdm-notify.js'
import { requestCfdmFullSync } from './cfdm-sync.js'
import { publishMany, publishNotification } from './notifications/engine.js'
import {
  buildLowBalanceNotification,
  buildNewTariffsNotification,
  buildPaymentExpiryNotification,
  buildSyncDigestNotification,
  buildVpsHealthNotification,
} from './notifications/rules.js'

/** Pull bindings from CFDM → vps_domains (domains on VPS). */
export const CFDM_SYNC_INTERVAL_MINUTES = 15

let syncIntervalId: ReturnType<typeof setInterval> | null = null
let syncTariffsIntervalId: ReturnType<typeof setInterval> | null = null
let notifyIntervalId: ReturnType<typeof setInterval> | null = null
let uptimeIntervalId: ReturnType<typeof setInterval> | null = null
let cfdmSyncIntervalId: ReturnType<typeof setInterval> | null = null
let cfdmSyncInFlight = false
let retentionIntervalId: ReturnType<typeof setInterval> | null = null
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000

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

function spaceIntervals(s: SettingsRow) {
  return {
    notify: Math.max(15, Number(s.notifyIntervalMinutes) || 60),
    uptime: Math.max(1, Number(s.uptimeCheckIntervalMinutes) || 5),
    sync: Math.max(15, Number(s.syncIntervalMinutes) || 60),
    tariffs: Math.max(60, Number(s.syncTariffsIntervalMinutes) || 1440),
  }
}

const runningJobs = new Set<string>()

/** A tick that finds the previous run of the same job still going is skipped, not stacked. */
async function exclusive(job: string, fn: () => Promise<void>): Promise<void> {
  if (runningJobs.has(job)) {
    console.warn(`Scheduler: ${job} ещё выполняется — тик пропущен`)
    return
  }
  runningJobs.add(job)
  try {
    await fn()
  } finally {
    runningJobs.delete(job)
  }
}

const lastRunAt = new Map<string, number>()

/** Timers tick at the smallest interval of all spaces; each space still runs at its own. */
function dueForSpace(job: string, spaceId: string, minutes: number): boolean {
  const key = `${job}:${spaceId}`
  const now = Date.now()
  const last = lastRunAt.get(key)
  if (last != null && now - last < minutes * 60_000 - 30_000) return false
  lastRunAt.set(key, now)
  return true
}

export function resetSchedulerState(): void {
  runningJobs.clear()
  lastRunAt.clear()
}

export const runNotificationTick = () => exclusive('notify', notificationTick)
export const runScheduledSync = () => exclusive('sync', scheduledSync)
export const runScheduledSyncTariffs = () => exclusive('tariffs', scheduledSyncTariffs)
export const runScheduledUptimeChecks = () => exclusive('uptime', scheduledUptimeChecks)
export const runRetention = () =>
  exclusive('retention', async () => {
    const r = pruneOldLogs(getSqlite())
    const total = r.notificationLog + r.syncLog + r.vpsHealthChecks + r.staleSyncs
    if (total > 0) console.log('Retention:', JSON.stringify(r))
  })

async function notificationTick(): Promise<void> {
  for (const settings of allSettings()) {
    const spaceId = settings.spaceId || MAIN_SPACE_ID
    if (!dueForSpace('notify', spaceId, spaceIntervals(settings).notify)) continue
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

async function scheduledSync(): Promise<void> {
  for (const settings of allSettings()) {
    if (!settings.syncEnabled) continue
    const spaceId = settings.spaceId || MAIN_SPACE_ID
    if (!dueForSpace('sync', spaceId, spaceIntervals(settings).sync)) continue
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

async function scheduledSyncTariffs(): Promise<void> {
  for (const settings of allSettings()) {
    if (!settings.syncEnabled) continue
    const spaceId = settings.spaceId || MAIN_SPACE_ID
    if (!dueForSpace('tariffs', spaceId, spaceIntervals(settings).tariffs)) continue
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

async function scheduledUptimeChecks(): Promise<void> {
  for (const settings of allSettings()) {
    const spaceId = settings.spaceId || MAIN_SPACE_ID
    if (!dueForSpace('uptime', spaceId, spaceIntervals(settings).uptime)) continue
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

function spaceHasCfdmPullConfig(settings: SettingsRow): boolean {
  return (
    Boolean(settings.integrationEnabled) &&
    Boolean(settings.integrationToken?.trim()) &&
    Boolean(settings.cfdmApiUrl?.trim())
  )
}

/** Pull full CFDM bindings into local vps_domains for each configured space. */
export async function runScheduledCfdmSync(): Promise<void> {
  if (cfdmSyncInFlight) return
  cfdmSyncInFlight = true
  try {
    for (const settings of allSettings()) {
      if (!spaceHasCfdmPullConfig(settings)) continue
      const spaceId = settings.spaceId || MAIN_SPACE_ID
      try {
        await runWithSpaceAsync(spaceId, async () => {
          const result = await requestCfdmFullSync()
          if (!result.ok) {
            console.warn(
              `CFDM scheduled sync [${spaceId}]:`,
              result.error ?? 'unknown error',
            )
            return
          }
          console.log(
            `CFDM scheduled sync [${spaceId}]: ${result.count ?? 0} bindings`,
          )
        })
      } catch (err) {
        console.warn(
          `CFDM scheduled sync error [${spaceId}]:`,
          err instanceof Error ? err.message : err,
        )
      }
    }
  } finally {
    cfdmSyncInFlight = false
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
    const i = spaceIntervals(s)
    notifyInterval = Math.min(notifyInterval, i.notify)
    uptimeInterval = Math.min(uptimeInterval, i.uptime)
    if (s.syncEnabled) {
      syncInterval = syncInterval == null ? i.sync : Math.min(syncInterval, i.sync)
      tariffsInterval = tariffsInterval == null ? i.tariffs : Math.min(tariffsInterval, i.tariffs)
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
  if (cfdmSyncIntervalId) clearInterval(cfdmSyncIntervalId)
  cfdmSyncIntervalId = null
  if (retentionIntervalId) clearInterval(retentionIntervalId)
  retentionIntervalId = null

  try {
    const rows = allSettings()
    if (rows.length === 0) return

    const { notifyInterval, uptimeInterval, syncInterval, tariffsInterval } =
      pickSchedulerIntervals(rows)
    const cfdmConfigured = rows.some(spaceHasCfdmPullConfig)

    notifyIntervalId = setInterval(() => void runNotificationTick(), notifyInterval * 60 * 1000)
    uptimeIntervalId = setInterval(
      () => void runScheduledUptimeChecks(),
      uptimeInterval * 60 * 1000,
    )
    void runNotificationTick()
    void runScheduledUptimeChecks()
    retentionIntervalId = setInterval(() => void runRetention(), RETENTION_INTERVAL_MS)
    void runRetention()

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

    if (cfdmConfigured) {
      const cfdmMs = CFDM_SYNC_INTERVAL_MINUTES * 60 * 1000
      cfdmSyncIntervalId = setInterval(() => void runScheduledCfdmSync(), cfdmMs)
      void runScheduledCfdmSync()
      parts.unshift(`cfdm every ${CFDM_SYNC_INTERVAL_MINUTES} min`)
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
  if (cfdmSyncIntervalId) clearInterval(cfdmSyncIntervalId)
  cfdmSyncIntervalId = null
  if (retentionIntervalId) clearInterval(retentionIntervalId)
  retentionIntervalId = null
}

export function restartScheduler(): void {
  stopScheduler()
  startScheduler()
}
