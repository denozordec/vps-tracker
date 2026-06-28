import { closeDb, getSqlite } from './index.js'
import { resetRuntimeMigrate } from './runtime-migrate.js'

const TEST_SCHEMA = `
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
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
  ip TEXT,
  providerId TEXT,
  providerAccountId TEXT,
  status TEXT,
  FOREIGN KEY (providerId) REFERENCES providers(id),
  FOREIGN KEY (providerAccountId) REFERENCES provider_accounts(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
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
  accountId TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  finishedAt TEXT,
  status TEXT,
  FOREIGN KEY (accountId) REFERENCES provider_accounts(id)
);

CREATE TABLE IF NOT EXISTS active_tariffs (
  id TEXT PRIMARY KEY,
  providerAccountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  externalId TEXT NOT NULL,
  FOREIGN KEY (providerAccountId) REFERENCES provider_accounts(id),
  FOREIGN KEY (providerId) REFERENCES providers(id)
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
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
  uptimeCheckIntervalMinutes INTEGER
);

CREATE TABLE IF NOT EXISTS notification_log (
  id TEXT PRIMARY KEY,
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
  lastFingerprint TEXT,
  lastSentAt TEXT,
  lastStatus TEXT
);
`

export function resetTestDb(): void {
  closeDb()
  resetRuntimeMigrate()
  process.env.DB_PATH = ':memory:'
  const sqlite = getSqlite()
  sqlite.exec(TEST_SCHEMA)
}

export function seedTestProvider(id = 'prov-1'): void {
  const sqlite = getSqlite()
  sqlite
    .prepare(
      `INSERT INTO providers (id, name, apiType, apiBaseUrl) VALUES (?, 'Test Host', 'billmanager', 'https://bm.test')`,
    )
    .run(id)
}
