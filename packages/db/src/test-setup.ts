import { closeDb, getSqlite } from './index.js'

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
`

export function resetTestDb(): void {
  closeDb()
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
