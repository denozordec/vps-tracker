import type Database from 'better-sqlite3'

const MAIN_SPACE_ID = 'space-main'

/**
 * Full bootstrap for empty DB (clean Docker install).
 * CREATE IF NOT EXISTS — safe on existing databases; column upgrades stay in COLUMN_MIGRATIONS.
 */
const CORE_TABLE_MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'personal',
    ownerUserId TEXT,
    createdAt TEXT NOT NULL,
    deletedAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS space_members (
    spaceId TEXT NOT NULL REFERENCES spaces(id),
    userId TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    createdAt TEXT NOT NULL,
    UNIQUE(spaceId, userId)
  )`,
  `CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    name TEXT NOT NULL,
    website TEXT,
    contact TEXT,
    baseCurrency TEXT,
    usdRate TEXT,
    eurRate TEXT,
    notes TEXT,
    apiType TEXT,
    apiBaseUrl TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS provider_accounts (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    providerId TEXT NOT NULL,
    name TEXT NOT NULL,
    panelUrl TEXT,
    currency TEXT,
    billingMode TEXT,
    notes TEXT,
    apiType TEXT,
    apiBaseUrl TEXT,
    apiCredentials TEXT,
    balance_api REAL,
    balance_currency TEXT,
    balance_updated_at TEXT,
    enoughmoneyto TEXT,
    balance_alert_below REAL,
    FOREIGN KEY (providerId) REFERENCES providers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS server_projects (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    name TEXT NOT NULL,
    color TEXT,
    sortOrder INTEGER DEFAULT 0,
    notes TEXT,
    createdAt TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS vps (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    ip TEXT,
    ipv6 TEXT,
    additionalIps TEXT,
    dns TEXT,
    providerId TEXT,
    providerAccountId TEXT,
    country TEXT,
    city TEXT,
    datacenter TEXT,
    os TEXT,
    vcpu INTEGER,
    ramGb REAL,
    diskGb INTEGER,
    diskType TEXT,
    virtualization TEXT,
    bandwidthTb INTEGER,
    sshPort INTEGER,
    rootUser TEXT,
    purpose TEXT,
    environment TEXT,
    project TEXT,
    projectId TEXT,
    monitoringEnabled INTEGER,
    backupEnabled INTEGER,
    status TEXT,
    tariffType TEXT,
    currency TEXT,
    dailyRate REAL,
    monthlyRate REAL,
    createdAt TEXT,
    paidUntil TEXT,
    notes TEXT,
    userOverrides TEXT,
    customData TEXT,
    last_health_status TEXT,
    last_health_checked_at TEXT,
    FOREIGN KEY (providerId) REFERENCES providers(id),
    FOREIGN KEY (providerAccountId) REFERENCES provider_accounts(id)
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT,
    providerAccountId TEXT,
    vpsId TEXT,
    note TEXT,
    FOREIGN KEY (providerAccountId) REFERENCES provider_accounts(id),
    FOREIGN KEY (vpsId) REFERENCES vps(id)
  )`,
  `CREATE TABLE IF NOT EXISTS balance_ledger (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT,
    direction TEXT,
    providerAccountId TEXT,
    vpsId TEXT,
    note TEXT,
    FOREIGN KEY (providerAccountId) REFERENCES provider_accounts(id),
    FOREIGN KEY (vpsId) REFERENCES vps(id)
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    baseCurrency TEXT,
    ratesUrl TEXT,
    autoConvert INTEGER,
    ratesUpdatedAt TEXT,
    syncEnabled INTEGER,
    syncIntervalMinutes INTEGER,
    syncTariffsIntervalMinutes INTEGER,
    customFields TEXT,
    telegramBotToken TEXT,
    telegramChatId TEXT,
    notifyPaymentExpiryEnabled INTEGER,
    notifyNewTariffsEnabled INTEGER,
    telegramMessageThreadId TEXT,
    notifyLowBalanceEnabled INTEGER,
    notifySyncDigestEnabled INTEGER,
    notifyVpsDownEnabled INTEGER,
    webhookUrl TEXT,
    webhookEnabled INTEGER,
    notifyIntervalMinutes INTEGER,
    uptimeCheckIntervalMinutes INTEGER,
    appSwitcherJson TEXT,
    integrationToken TEXT,
    integrationEnabled INTEGER,
    integrationLastSyncAt TEXT,
    cfdmApiUrl TEXT,
    showQuickActions INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS sync_log (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    accountId TEXT NOT NULL,
    startedAt TEXT NOT NULL,
    finishedAt TEXT,
    status TEXT,
    vpsCount INTEGER,
    paymentsCount INTEGER,
    error TEXT,
    summary TEXT,
    FOREIGN KEY (accountId) REFERENCES provider_accounts(id)
  )`,
  `CREATE TABLE IF NOT EXISTS active_tariffs (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    providerAccountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    externalId TEXT NOT NULL,
    datacenterKey TEXT,
    datacenterName TEXT,
    name TEXT,
    desc TEXT,
    vcpu INTEGER,
    ramGb REAL,
    diskGb INTEGER,
    diskType TEXT,
    virtualization TEXT,
    channel TEXT,
    location TEXT,
    country TEXT,
    cpuModel TEXT,
    orderAvailable INTEGER,
    price TEXT,
    syncedAt TEXT,
    FOREIGN KEY (providerAccountId) REFERENCES provider_accounts(id),
    FOREIGN KEY (providerId) REFERENCES providers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS tariff_sync_options (
    providerAccountId TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    datacenters TEXT,
    periods TEXT,
    syncedAt TEXT,
    FOREIGN KEY (providerAccountId) REFERENCES provider_accounts(id)
  )`,
  `CREATE TABLE IF NOT EXISTS vps_health_checks (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    vpsId TEXT NOT NULL REFERENCES vps(id),
    checkedAt TEXT NOT NULL,
    status TEXT NOT NULL,
    latencyMs INTEGER,
    error TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    entity TEXT NOT NULL,
    entityId TEXT NOT NULL,
    action TEXT NOT NULL,
    diff TEXT,
    actorUserId TEXT,
    createdAt TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS notification_log (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
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
    spaceId TEXT NOT NULL DEFAULT 'space-main',
    lastFingerprint TEXT,
    lastSentAt TEXT,
    lastStatus TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS vps_domains (
    id TEXT PRIMARY KEY,
    spaceId TEXT NOT NULL DEFAULT 'space-main',
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

/** Additive columns for DBs created before spaces / notifications / etc. */
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
  `ALTER TABLE settings ADD COLUMN telegramBotToken TEXT`,
  `ALTER TABLE settings ADD COLUMN telegramChatId TEXT`,
  `ALTER TABLE settings ADD COLUMN notifyPaymentExpiryEnabled INTEGER`,
  `ALTER TABLE settings ADD COLUMN notifyNewTariffsEnabled INTEGER`,
  `ALTER TABLE settings ADD COLUMN telegramMessageThreadId TEXT`,
  `ALTER TABLE settings ADD COLUMN notifyLowBalanceEnabled INTEGER`,
  `ALTER TABLE settings ADD COLUMN notifySyncDigestEnabled INTEGER`,
  `ALTER TABLE vps_domains ADD COLUMN targetIps TEXT`,
  `ALTER TABLE providers ADD COLUMN spaceId TEXT`,
  `ALTER TABLE provider_accounts ADD COLUMN spaceId TEXT`,
  `ALTER TABLE provider_accounts ADD COLUMN balance_api REAL`,
  `ALTER TABLE provider_accounts ADD COLUMN balance_currency TEXT`,
  `ALTER TABLE provider_accounts ADD COLUMN balance_updated_at TEXT`,
  `ALTER TABLE provider_accounts ADD COLUMN enoughmoneyto TEXT`,
  `ALTER TABLE provider_accounts ADD COLUMN balance_alert_below REAL`,
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
  `ALTER TABLE spaces ADD COLUMN deletedAt TEXT`,
  `ALTER TABLE sync_log ADD COLUMN spaceId TEXT`,
  `ALTER TABLE sync_log ADD COLUMN summary TEXT`,
  `ALTER TABLE active_tariffs ADD COLUMN spaceId TEXT`,
  `ALTER TABLE tariff_sync_options ADD COLUMN spaceId TEXT`,
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

  sqlite
    .prepare(
      `INSERT OR IGNORE INTO settings (id, spaceId, baseCurrency, autoConvert, syncEnabled)
       VALUES ('settings-main', ?, 'USD', 1, 0)`,
    )
    .run(MAIN_SPACE_ID)
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
  for (const sql of CORE_TABLE_MIGRATIONS) {
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
