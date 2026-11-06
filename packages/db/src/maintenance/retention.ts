import type Database from 'better-sqlite3'

const DAY_MS = 24 * 60 * 60 * 1000

export const RETENTION_DAYS = {
  notificationLog: 90,
  syncLog: 90,
  vpsHealthChecks: 30,
} as const

/** A sync that is still "running" after this long was cut off by a crash/restart. */
const STALE_RUNNING_SYNC_MS = 60 * 60 * 1000

export interface PruneResult {
  notificationLog: number
  syncLog: number
  vpsHealthChecks: number
  staleSyncs: number
}

/** Delete old journal rows (all spaces) and close sync_log rows left 'running' by a dead process. */
export function pruneOldLogs(sqlite: Database.Database, now = new Date()): PruneResult {
  const before = (days: number) => new Date(now.getTime() - days * DAY_MS).toISOString()
  const nowIso = now.toISOString()
  return sqlite.transaction(() => ({
    staleSyncs: sqlite
      .prepare(
        `UPDATE sync_log SET status = 'error', finishedAt = ?, error = 'Прервано: процесс перезапущен'
         WHERE status = 'running' AND startedAt < ?`,
      )
      .run(nowIso, new Date(now.getTime() - STALE_RUNNING_SYNC_MS).toISOString()).changes,
    notificationLog: sqlite
      .prepare(`DELETE FROM notification_log WHERE createdAt < ?`)
      .run(before(RETENTION_DAYS.notificationLog)).changes,
    syncLog: sqlite
      .prepare(`DELETE FROM sync_log WHERE startedAt < ?`)
      .run(before(RETENTION_DAYS.syncLog)).changes,
    vpsHealthChecks: sqlite
      .prepare(`DELETE FROM vps_health_checks WHERE checkedAt < ?`)
      .run(before(RETENTION_DAYS.vpsHealthChecks)).changes,
  }))()
}
