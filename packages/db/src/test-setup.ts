import { closeDb, getSqlite } from './index.js'
import { resetRuntimeMigrate } from './runtime-migrate.js'

const TEST_SCHEMA = `
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'personal',
  ownerUserId TEXT,
  createdAt TEXT NOT NULL,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS space_members (
  spaceId TEXT NOT NULL,
  userId TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  createdAt TEXT NOT NULL,
  UNIQUE(spaceId, userId)
);

CREATE TABLE IF NOT EXISTS providers (
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
);

CREATE TABLE IF NOT EXISTS provider_accounts (
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
);

CREATE TABLE IF NOT EXISTS vps (
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
);

CREATE TABLE IF NOT EXISTS vps_grants (
  id TEXT PRIMARY KEY,
  vpsId TEXT NOT NULL,
  fromSpaceId TEXT NOT NULL,
  toSpaceId TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'read',
  grantedByUserId TEXT,
  createdAt TEXT NOT NULL,
  UNIQUE(vpsId, toSpaceId)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  spaceId TEXT NOT NULL DEFAULT 'space-main',
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT,
  providerAccountId TEXT,
  vpsId TEXT,
  note TEXT,
  FOREIGN KEY (providerAccountId) REFERENCES provider_accounts(id)
);

CREATE TABLE IF NOT EXISTS balance_ledger (
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
  FOREIGN KEY (providerAccountId) REFERENCES provider_accounts(id)
);

CREATE TABLE IF NOT EXISTS sync_log (
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
);

CREATE TABLE IF NOT EXISTS active_tariffs (
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
);

CREATE TABLE IF NOT EXISTS tariff_sync_options (
  providerAccountId TEXT PRIMARY KEY,
  spaceId TEXT NOT NULL DEFAULT 'space-main',
  datacenters TEXT,
  periods TEXT,
  syncedAt TEXT
);

CREATE TABLE IF NOT EXISTS settings (
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
);

CREATE TABLE IF NOT EXISTS vps_domains (
  id TEXT PRIMARY KEY,
  spaceId TEXT NOT NULL DEFAULT 'space-main',
  vpsId TEXT,
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
  syncedAt TEXT NOT NULL,
  FOREIGN KEY (vpsId) REFERENCES vps(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notification_log (
  id TEXT PRIMARY KEY,
  spaceId TEXT NOT NULL DEFAULT 'space-main',
  event TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  fingerprint TEXT,
  message TEXT,
  payload TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_state (
  key TEXT PRIMARY KEY,
  spaceId TEXT NOT NULL DEFAULT 'space-main',
  lastFingerprint TEXT,
  lastSentAt TEXT,
  lastStatus TEXT
);

CREATE TABLE IF NOT EXISTS server_projects (
  id TEXT PRIMARY KEY,
  spaceId TEXT NOT NULL DEFAULT 'space-main',
  name TEXT NOT NULL,
  color TEXT,
  sortOrder INTEGER DEFAULT 0,
  notes TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  spaceId TEXT NOT NULL DEFAULT 'space-main',
  entity TEXT NOT NULL,
  entityId TEXT NOT NULL,
  action TEXT NOT NULL,
  diff TEXT,
  actorUserId TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vps_health_checks (
  id TEXT PRIMARY KEY,
  spaceId TEXT NOT NULL DEFAULT 'space-main',
  vpsId TEXT NOT NULL,
  checkedAt TEXT NOT NULL,
  status TEXT NOT NULL,
  latencyMs INTEGER,
  error TEXT
);
`

export function resetTestDb(): void {
  closeDb()
  resetRuntimeMigrate()
  process.env.DB_PATH = ':memory:'
  const sqlite = getSqlite()
  sqlite.exec(TEST_SCHEMA)
  const now = new Date().toISOString()
  sqlite
    .prepare(
      `INSERT OR IGNORE INTO spaces (id, name, slug, kind, ownerUserId, createdAt)
       VALUES ('space-main', 'Основное', 'main', 'main', NULL, ?)`,
    )
    .run(now)
}

export function seedTestProvider(id = 'prov-1'): void {
  const sqlite = getSqlite()
  sqlite
    .prepare(
      `INSERT INTO providers (id, spaceId, name, apiType, apiBaseUrl) VALUES (?, 'space-main', 'Test Host', 'billmanager', 'https://bm.test')`,
    )
    .run(id)
}

export function seedTestProviderAccount(id = 'acc-1', providerId = 'prov-1'): void {
  const sqlite = getSqlite()
  sqlite
    .prepare(
      `INSERT INTO provider_accounts (id, spaceId, providerId, name) VALUES (?, 'space-main', ?, 'Test Account')`,
    )
    .run(id, providerId)
}
