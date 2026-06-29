import type Database from 'better-sqlite3'

const COLUMN_MIGRATIONS: string[] = [
  `ALTER TABLE vps ADD COLUMN customData TEXT`,
  `ALTER TABLE vps ADD COLUMN last_health_status TEXT`,
  `ALTER TABLE vps ADD COLUMN last_health_checked_at TEXT`,
  `ALTER TABLE settings ADD COLUMN notifyVpsDownEnabled INTEGER`,
  `ALTER TABLE settings ADD COLUMN webhookUrl TEXT`,
  `ALTER TABLE settings ADD COLUMN webhookEnabled INTEGER`,
  `ALTER TABLE settings ADD COLUMN notifyIntervalMinutes INTEGER`,
  `ALTER TABLE settings ADD COLUMN uptimeCheckIntervalMinutes INTEGER`,
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
  `CREATE TABLE IF NOT EXISTS notification_log (
    id TEXT PRIMARY KEY,
    event TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    fingerprint TEXT,
    message TEXT,
    payload TEXT,
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notification_state (
    key TEXT PRIMARY KEY,
    lastFingerprint TEXT,
    lastSentAt TEXT,
    lastStatus TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS server_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    sortOrder INTEGER DEFAULT 0,
    notes TEXT,
    createdAt TEXT
  )`,
]

let migrated = false

export function resetRuntimeMigrate(): void {
  migrated = false
}

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
