import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const spaces = sqliteTable('spaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  kind: text('kind').notNull().default('personal'),
  ownerUserId: text('ownerUserId'),
  createdAt: text('createdAt').notNull(),
  /** Soft-delete (корзина); null = active */
  deletedAt: text('deletedAt'),
})

export const spaceMembers = sqliteTable(
  'space_members',
  {
    spaceId: text('spaceId')
      .notNull()
      .references(() => spaces.id),
    userId: text('userId').notNull(),
    role: text('role').notNull().default('member'),
    createdAt: text('createdAt').notNull(),
  },
  (t) => ({
    pk: uniqueIndex('space_members_pk').on(t.spaceId, t.userId),
  }),
)

export const vpsGrants = sqliteTable(
  'vps_grants',
  {
    id: text('id').primaryKey(),
    vpsId: text('vpsId')
      .notNull()
      .references(() => vps.id),
    fromSpaceId: text('fromSpaceId')
      .notNull()
      .references(() => spaces.id),
    toSpaceId: text('toSpaceId')
      .notNull()
      .references(() => spaces.id),
    permission: text('permission').notNull().default('read'),
    grantedByUserId: text('grantedByUserId'),
    createdAt: text('createdAt').notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('vps_grants_vps_to').on(t.vpsId, t.toSpaceId),
  }),
)

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  name: text('name').notNull(),
  website: text('website'),
  contact: text('contact'),
  baseCurrency: text('baseCurrency'),
  usdRate: text('usdRate'),
  eurRate: text('eurRate'),
  notes: text('notes'),
  apiType: text('apiType'),
  apiBaseUrl: text('apiBaseUrl'),
})

export const providerAccounts = sqliteTable('provider_accounts', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  providerId: text('providerId')
    .notNull()
    .references(() => providers.id),
  name: text('name').notNull(),
  panelUrl: text('panelUrl'),
  currency: text('currency'),
  billingMode: text('billingMode'),
  notes: text('notes'),
  apiType: text('apiType'),
  apiBaseUrl: text('apiBaseUrl'),
  apiCredentials: text('apiCredentials'),
  balanceApi: real('balance_api'),
  balanceCurrency: text('balance_currency'),
  balanceUpdatedAt: text('balance_updated_at'),
  enoughmoneyto: text('enoughmoneyto'),
  balanceAlertBelow: real('balance_alert_below'),
})

export const serverProjects = sqliteTable('server_projects', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  name: text('name').notNull(),
  color: text('color'),
  sortOrder: integer('sortOrder').default(0),
  notes: text('notes'),
  createdAt: text('createdAt'),
})

export const vps = sqliteTable('vps', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  ip: text('ip'),
  ipv6: text('ipv6'),
  additionalIps: text('additionalIps'),
  dns: text('dns'),
  providerId: text('providerId').references(() => providers.id),
  providerAccountId: text('providerAccountId').references(() => providerAccounts.id),
  country: text('country'),
  city: text('city'),
  datacenter: text('datacenter'),
  os: text('os'),
  vcpu: integer('vcpu'),
  ramGb: integer('ramGb'),
  diskGb: integer('diskGb'),
  diskType: text('diskType'),
  virtualization: text('virtualization'),
  bandwidthTb: integer('bandwidthTb'),
  sshPort: integer('sshPort'),
  rootUser: text('rootUser'),
  purpose: text('purpose'),
  environment: text('environment'),
  project: text('project'),
  projectId: text('projectId').references(() => serverProjects.id),
  monitoringEnabled: integer('monitoringEnabled'),
  backupEnabled: integer('backupEnabled'),
  status: text('status'),
  tariffType: text('tariffType'),
  currency: text('currency'),
  dailyRate: real('dailyRate'),
  monthlyRate: real('monthlyRate'),
  createdAt: text('createdAt'),
  paidUntil: text('paidUntil'),
  notes: text('notes'),
  userOverrides: text('userOverrides'),
  customData: text('customData'),
  lastHealthStatus: text('last_health_status'),
  lastHealthCheckedAt: text('last_health_checked_at'),
})

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  type: text('type').notNull(),
  date: text('date').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency'),
  providerAccountId: text('providerAccountId').references(() => providerAccounts.id),
  vpsId: text('vpsId').references(() => vps.id),
  note: text('note'),
})

export const balanceLedger = sqliteTable('balance_ledger', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  type: text('type').notNull(),
  date: text('date').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency'),
  direction: text('direction'),
  providerAccountId: text('providerAccountId').references(() => providerAccounts.id),
  vpsId: text('vpsId').references(() => vps.id),
  note: text('note'),
})

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  baseCurrency: text('baseCurrency'),
  ratesUrl: text('ratesUrl'),
  autoConvert: integer('autoConvert'),
  ratesUpdatedAt: text('ratesUpdatedAt'),
  syncEnabled: integer('syncEnabled'),
  syncIntervalMinutes: integer('syncIntervalMinutes'),
  syncTariffsIntervalMinutes: integer('syncTariffsIntervalMinutes'),
  customFields: text('customFields'),
  telegramBotToken: text('telegramBotToken'),
  telegramChatId: text('telegramChatId'),
  notifyPaymentExpiryEnabled: integer('notifyPaymentExpiryEnabled'),
  notifyNewTariffsEnabled: integer('notifyNewTariffsEnabled'),
  telegramMessageThreadId: text('telegramMessageThreadId'),
  notifyLowBalanceEnabled: integer('notifyLowBalanceEnabled'),
  notifySyncDigestEnabled: integer('notifySyncDigestEnabled'),
  notifyVpsDownEnabled: integer('notifyVpsDownEnabled'),
  webhookUrl: text('webhookUrl'),
  webhookEnabled: integer('webhookEnabled'),
  notifyIntervalMinutes: integer('notifyIntervalMinutes'),
  uptimeCheckIntervalMinutes: integer('uptimeCheckIntervalMinutes'),
  appSwitcherJson: text('appSwitcherJson'),
  integrationToken: text('integrationToken'),
  integrationEnabled: integer('integrationEnabled'),
  integrationLastSyncAt: text('integrationLastSyncAt'),
  cfdmApiUrl: text('cfdmApiUrl'),
  showQuickActions: integer('showQuickActions'),
})

export const vpsDomains = sqliteTable('vps_domains', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  vpsId: text('vpsId').references(() => vps.id, { onDelete: 'set null' }),
  fqdn: text('fqdn').notNull(),
  zoneName: text('zoneName').notNull(),
  hostname: text('hostname').notNull(),
  serviceName: text('serviceName').notNull(),
  serviceSlug: text('serviceSlug').notNull(),
  cfdmServiceId: integer('cfdmServiceId').notNull(),
  cfdmBindingId: integer('cfdmBindingId').notNull(),
  source: text('source').notNull().default('cfdm'),
  matchStatus: text('matchStatus').notNull().default('unmatched'),
  targetIps: text('targetIps'),
  syncedAt: text('syncedAt').notNull(),
})

export const notificationLog = sqliteTable('notification_log', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  event: text('event').notNull(),
  channel: text('channel').notNull(),
  status: text('status').notNull(),
  fingerprint: text('fingerprint'),
  message: text('message'),
  payload: text('payload'),
  createdAt: text('createdAt').notNull(),
})

export const notificationState = sqliteTable('notification_state', {
  key: text('key').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  lastFingerprint: text('lastFingerprint'),
  lastSentAt: text('lastSentAt'),
  lastStatus: text('lastStatus'),
})

export const vpsHealthChecks = sqliteTable('vps_health_checks', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  vpsId: text('vpsId')
    .notNull()
    .references(() => vps.id),
  checkedAt: text('checkedAt').notNull(),
  status: text('status').notNull(),
  latencyMs: integer('latencyMs'),
  error: text('error'),
})

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  entity: text('entity').notNull(),
  entityId: text('entityId').notNull(),
  action: text('action').notNull(),
  diff: text('diff'),
  actorUserId: text('actorUserId'),
  createdAt: text('createdAt').notNull(),
})

export const syncLog = sqliteTable('sync_log', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  accountId: text('accountId')
    .notNull()
    .references(() => providerAccounts.id),
  startedAt: text('startedAt').notNull(),
  finishedAt: text('finishedAt'),
  status: text('status'),
  vpsCount: integer('vpsCount'),
  paymentsCount: integer('paymentsCount'),
  error: text('error'),
  summary: text('summary'),
})

export const activeTariffs = sqliteTable('active_tariffs', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  providerAccountId: text('providerAccountId')
    .notNull()
    .references(() => providerAccounts.id),
  providerId: text('providerId')
    .notNull()
    .references(() => providers.id),
  externalId: text('externalId').notNull(),
  datacenterKey: text('datacenterKey'),
  datacenterName: text('datacenterName'),
  name: text('name'),
  desc: text('desc'),
  vcpu: integer('vcpu'),
  ramGb: real('ramGb'),
  diskGb: integer('diskGb'),
  diskType: text('diskType'),
  virtualization: text('virtualization'),
  channel: text('channel'),
  location: text('location'),
  country: text('country'),
  cpuModel: text('cpuModel'),
  orderAvailable: integer('orderAvailable'),
  price: text('price'),
  syncedAt: text('syncedAt'),
})

export const tariffSyncOptions = sqliteTable('tariff_sync_options', {
  providerAccountId: text('providerAccountId')
    .primaryKey()
    .references(() => providerAccounts.id),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  datacenters: text('datacenters'),
  periods: text('periods'),
  syncedAt: text('syncedAt'),
})

export const topologyDiagrams = sqliteTable('topology_diagrams', {
  id: text('id').primaryKey(),
  spaceId: text('spaceId')
    .notNull()
    .default('space-main')
    .references(() => spaces.id),
  name: text('name').notNull(),
  document: text('document').notNull().default('{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}'),
  locked: integer('locked').notNull().default(0),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
})

export const now = sql`(datetime('now'))`
