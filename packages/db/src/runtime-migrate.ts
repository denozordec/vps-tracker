import type Database from 'better-sqlite3'

const MAIN_SPACE_ID = 'space-main'

const COLUMN_MIGRATIONS: string[] = [
  `ALTER TABLE vps ADD COLUMN customData TEXT`,
  `ALTER TABLE vps ADD COLUMN last_health_status TEXT`,
  `ALTER TABLE vps ADD COLUMN last_health_checked_at TEXT`,
  `ALTER TABLE settings ADD COLUMN notifyVpsDownEnabled INTEGER`,
  `ALTER TABLE settings ADD COLUMN webhookUrl TEXT`,
  `ALTER TABLE settings ADD COLUMN webhookEnabled INTEGER`,
  `ALTER TABLE settings ADD COLUMN notifyIntervalMinutes INTEGER`,
  `ALTER TABLE settings ADD COLUMN uptimeCheckIntervalMinutes INTEGER`,
  `ALTER TABLE settings ADD COLUMN appSwitcherJson TEXT`,
  `ALTER TABLE settings ADD COLUMN integrationToken TEXT`,
  `ALTER TABLE settings ADD COLUMN integrationEnabled INTEGER`,
  `ALTER TABLE settings ADD COLUMN integrationLastSyncAt TEXT`,
  `ALTER TABLE settings ADD COLUMN cfdmApiUrl TEXT`,
  `ALTER TABLE settings ADD COLUMN showQuickActions INTEGER`,
  `ALTER TABLE vps_domains ADD COLUMN targetIps TEXT`,
  `ALTER TABLE providers ADD COLUMN spaceId TEXT`,
  `ALTER TABLE provider_accounts ADD COLUMN spaceId TEXT`,
  `ALTER TABLE server_projects ADD COLUMN spaceId TEXT`,
  `ALTER TABLE vps ADD COLUMN spaceId TEXT`,
  `ALTER TABLE payments ADD COLUMN spaceId TEXT`,
  `ALTER TABLE balance_ledger ADD COLUMN spaceId TEXT`,
  `ALTER TABLE settings ADD COLUMN spaceId TEXT`,
  `ALTER TABLE vps_domains ADD COLUMN spaceId TEXT`,
  `ALTER TABLE notification_log ADD COLUMN spaceId TEXT`,
  `ALTER TABLE notification_state ADD COLUMN spaceId TEXT`,
  `ALTER TABLE vps_health_checks ADD COLUMN spaceId TEXT`,
  `ALTER TABLE audit_log ADD COLUMN spaceId TEXT`,
  `ALTER TABLE audit_log ADD COLUMN actorUserId TEXT`,
  `ALTER TABLE sync_log ADD COLUMN spaceId TEXT`,
  `ALTER TABLE active_tariffs ADD COLUMN spaceId TEXT`,
  `ALTER TABLE tariff_sync_options ADD COLUMN spaceId TEXT`,
]

const TABLE_MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'personal',
    ownerUserId TEXT,
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS space_members (
    spaceId TEXT NOT NULL REFERENCES spaces(id),
    userId TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    createdAt TEXT NOT NULL,
    UNIQUE(spaceId, userId)
  )`,
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
  `CREATE TABLE IF NOT EXISTS vps_domains (
    id TEXT PRIMARY KEY,
    vpsId TEXT REFERENCES vps(id) ON DELETE SET NULL,
    fqdn TEXT NOT NULL,
    zoneName TEXT NOT NULL,
    hostname TEXT NOT NULL,
    serviceName TEXT NOT NULL,
    serviceSlug TEXT NOT NULL,
    cfdmServiceId INTEGER NOT NULL,
    cfdmBindingId INTEGER NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'cfdm',
    matchStatus TEXT NOT NULL DEFAULT 'unmatched',
    targetIps TEXT,
    syncedAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS vps_grants (
    id TEXT PRIMARY KEY,
    vpsId TEXT NOT NULL REFERENCES vps(id),
    fromSpaceId TEXT NOT NULL REFERENCES spaces(id),
    toSpaceId TEXT NOT NULL REFERENCES spaces(id),
    permission TEXT NOT NULL DEFAULT 'read',
    grantedByUserId TEXT,
    createdAt TEXT NOT NULL,
    UNIQUE(vpsId, toSpaceId)
  )`,
  `CREATE TABLE IF NOT EXISTS topology_diagrams (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main' REFERENCES spaces(id),
    name TEXT NOT NULL,
    document TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}',
    locked INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )`,
]

const SPACE_BACKFILL_TABLES = [
  'providers',
  'provider_accounts',
  'server_projects',
  'vps',
  'payments',
  'balance_ledger',
  'settings',
  'vps_domains',
  'notification_log',
  'notification_state',
  'vps_health_checks',
  'audit_log',
  'sync_log',
  'active_tariffs',
  'tariff_sync_options',
  'topology_diagrams',
] as const

function ensureMainSpace(sqlite: Database.Database): void {
  const now = new Date().toISOString()
  const owner = process.env.VPS_MAIN_SPACE_OWNER_USER_ID?.trim() || null
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO spaces (id, name, slug, kind, ownerUserId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(MAIN_SPACE_ID, 'Основное', 'main', 'main', owner, now)

  if (owner) {
    sqlite
      .prepare(
        `INSERT OR IGNORE INTO space_members (spaceId, userId, role, createdAt)
         VALUES (?, ?, 'owner', ?)`,
      )
      .run(MAIN_SPACE_ID, owner, now)
  }
}

function backfillSpaceIds(sqlite: Database.Database): void {
  for (const table of SPACE_BACKFILL_TABLES) {
    try {
      sqlite
        .prepare(
          `UPDATE ${table} SET spaceId = ? WHERE spaceId IS NULL OR spaceId = ''`,
        )
        .run(MAIN_SPACE_ID)
    } catch {
      /* table may not exist yet */
    }
  }
}

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
  ensureMainSpace(sqlite)
  backfillSpaceIds(sqlite)
  migrated = true
}
