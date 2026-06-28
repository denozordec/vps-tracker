import type Database from 'better-sqlite3'

const COLUMN_MIGRATIONS: string[] = [
  `ALTER TABLE vps ADD COLUMN customData TEXT`,
  `ALTER TABLE vps ADD COLUMN last_health_status TEXT`,
  `ALTER TABLE vps ADD COLUMN last_health_checked_at TEXT`,
  `ALTER TABLE settings ADD COLUMN notifyVpsDownEnabled INTEGER`,
  `ALTER TABLE settings ADD COLUMN webhookUrl TEXT`,
  `ALTER TABLE settings ADD COLUMN webhookEnabled INTEGER`,
]

const TABLE_MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS vps_health_checks (
    id TEXT PRIMARY KEY,
    vpsId TEXT NOT NULL REFERENCES vps(id),
    checkedAt TEXT NOT NULL,
    status TEXT NOT NULL,
    latencyMs INTEGER,
    error TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    entity TEXT NOT NULL,
    entityId TEXT NOT NULL,
    action TEXT NOT NULL,
    diff TEXT,
    createdAt TEXT NOT NULL
  )`,
]

let migrated = false

export function ensureRuntimeSchema(sqlite: Database.Database): void {
  if (migrated) return
  for (const sql of TABLE_MIGRATIONS) {
    sqlite.exec(sql)
  }
  for (const sql of COLUMN_MIGRATIONS) {
    try {
      sqlite.exec(sql)
    } catch {
      /* column exists */
    }
  }
  migrated = true
}
