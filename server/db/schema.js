/**
 * SQLite schema for vps-tracker
 */

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  contact TEXT,
  baseCurrency TEXT,
  usdRate TEXT,
  eurRate TEXT,
  notes TEXT
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
  FOREIGN KEY (providerId) REFERENCES providers(id)
);

CREATE TABLE IF NOT EXISTS vps (
  id TEXT PRIMARY KEY,
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
  ramGb INTEGER,
  diskGb INTEGER,
  diskType TEXT,
  virtualization TEXT,
  bandwidthTb INTEGER,
  sshPort INTEGER,
  rootUser TEXT,
  purpose TEXT,
  environment TEXT,
  project TEXT,
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
  FOREIGN KEY (providerAccountId) REFERENCES provider_accounts(id),
  FOREIGN KEY (vpsId) REFERENCES vps(id)
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
  FOREIGN KEY (providerAccountId) REFERENCES provider_accounts(id),
  FOREIGN KEY (vpsId) REFERENCES vps(id)
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  baseCurrency TEXT,
  ratesUrl TEXT,
  autoConvert INTEGER,
  ratesUpdatedAt TEXT,
  syncEnabled INTEGER,
  syncIntervalMinutes INTEGER
);

CREATE TABLE IF NOT EXISTS sync_log (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  startedAt TEXT NOT NULL,
  finishedAt TEXT,
  status TEXT,
  vpsCount INTEGER,
  paymentsCount INTEGER,
  error TEXT,
  FOREIGN KEY (accountId) REFERENCES provider_accounts(id)
);

CREATE TABLE IF NOT EXISTS active_tariffs (
  id TEXT PRIMARY KEY,
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
  datacenters TEXT,
  periods TEXT,
  syncedAt TEXT,
  FOREIGN KEY (providerAccountId) REFERENCES provider_accounts(id)
);
`
