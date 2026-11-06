import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { ensureRuntimeSchema, resetRuntimeMigrate } from '../runtime-migrate.js'
import { pruneOldLogs } from './retention.js'

describe('pruneOldLogs', () => {
  it('drops old rows, keeps fresh ones, closes stale running syncs', () => {
    const db = new Database(':memory:')
    resetRuntimeMigrate()
    ensureRuntimeSchema(db)
    resetRuntimeMigrate()
    const now = new Date('2026-06-01T00:00:00Z')
    const old = '2026-01-01T00:00:00Z'
    const fresh = '2026-05-31T23:30:00Z'
    db.exec(`PRAGMA foreign_keys = OFF`)
    for (const [id, at] of [['n-old', old], ['n-new', fresh]]) {
      db.prepare(`INSERT INTO notification_log (id, event, channel, status, createdAt) VALUES (?, 'e', 'telegram', 'sent', ?)`).run(id, at)
      db.prepare(`INSERT INTO vps_health_checks (id, vpsId, checkedAt, status) VALUES (?, 'v', ?, 'up')`).run(id, at)
    }
    db.prepare(`INSERT INTO sync_log (id, accountId, startedAt, status) VALUES ('s-old', 'a', ?, 'ok')`).run(old)
    db.prepare(`INSERT INTO sync_log (id, accountId, startedAt, status) VALUES ('s-stuck', 'a', '2026-05-31T20:00:00Z', 'running')`).run()
    db.prepare(`INSERT INTO sync_log (id, accountId, startedAt, status) VALUES ('s-live', 'a', ?, 'running')`).run(fresh)

    expect(pruneOldLogs(db, now)).toEqual({ notificationLog: 1, syncLog: 1, vpsHealthChecks: 1, staleSyncs: 1 })
    const status = (id: string) => (db.prepare(`SELECT status FROM sync_log WHERE id = ?`).get(id) as { status: string }).status
    expect(status('s-stuck')).toBe('error')
    expect(status('s-live')).toBe('running')
  })
})
