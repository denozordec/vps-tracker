import type { CustomFieldDef } from '@cfdm/shared/contracts/custom-fields'

export type VpsStatus = 'active' | 'paused' | 'archived'
export type TariffType = 'daily' | 'monthly'
export type BillingMode = 'daily' | 'monthly'
export type PaymentType =
  | 'direct_vps_payment'
  | 'provider_balance_topup'
  | 'daily_debit'
  | 'monthly_debit'
export type LedgerDirection = 'credit' | 'debit'
export type ApiType = 'billmanager' | 'none'

export interface Provider {
  id: string
  name: string
  website?: string
  apiType: ApiType
  apiBaseUrl?: string
  baseCurrency?: string
  usdRate?: string | number | null
  eurRate?: string | number | null
  supportPhone?: string
  supportUrl?: string
  notes?: string
}

export interface ProviderAccount {
  id: string
  providerId: string
  name: string
  apiLogin?: string
  /** @deprecated используйте apiLogin */
  login?: string
  apiCredentialsSet?: boolean
  billingMode?: BillingMode
  balance_api?: number | null
  balanceApi?: number | null
  balance_currency?: string
  balanceCurrency?: string
  currency?: string
  balanceAlertBelow?: number | null
  enoughmoneyto?: string
  balanceUpdatedAt?: string
  notes?: string
}

export interface Vps {
  id: string
  externalId?: string
  ip: string
  dns?: string
  ipv6?: string
  additionalIps?: string[]
  providerId: string
  providerAccountId: string
  country?: string
  city?: string
  datacenter?: string
  os?: string
  vcpu: number
  ramGb: number
  diskGb: number
  diskType?: string
  virtualization?: string
  bandwidthTb?: number
  sshPort?: number
  rootUser?: string
  purpose?: string
  environment?: 'prod' | 'dev' | 'staging'
  project?: string
  monitoringEnabled?: boolean
  backupEnabled?: boolean
  status: VpsStatus
  tariffType: TariffType
  currency: string
  dailyRate: number | null
  monthlyRate: number | null
  createdAt: string
  paidUntil?: string
  notes?: string
  customData?: string | Record<string, string | number | boolean>
}

export interface Payment {
  id: string
  externalId?: string
  type: PaymentType
  date: string
  amount: number
  currency: string
  providerAccountId: string
  vpsId?: string | null
  note?: string
}

export interface BalanceLedgerRow {
  id: string
  providerAccountId: string
  direction: LedgerDirection
  amount: number
  currency?: string
  date: string
  note?: string
}

export interface Settings {
  id: string
  baseCurrency: string
  ratesUrl?: string
  autoConvert?: boolean
  syncEnabled?: boolean
  syncIntervalMinutes?: number
  syncTariffsIntervalMinutes?: number
  notifyLowBalanceEnabled?: boolean
  notifySyncDigestEnabled?: boolean
  notifyPaymentExpiryEnabled?: boolean
  notifyNewTariffsEnabled?: boolean
  notifyVpsDownEnabled?: boolean
  notifyIntervalMinutes?: number
  uptimeCheckIntervalMinutes?: number
  webhookUrl?: string
  webhookEnabled?: boolean
  telegramChatId?: string
  telegramBotToken?: string
  telegramMessageThreadId?: string
  telegramBotTokenSet?: boolean
  customFields?: CustomFieldDef[]
}

export interface ActiveTariff {
  id: string
  providerAccountId: string
  pricelistId?: string
  name?: string
  vcpu?: number
  ramGb?: number
  diskGb?: number
  diskType?: string
  monthlyRate?: number
  currency?: string
  datacenterKey?: string
  datacenterName?: string
  location?: string
  country?: string
}

export interface SyncLogRow {
  id: string
  accountId: string
  status: 'ok' | 'error' | 'running'
  startedAt?: string
  finishedAt?: string
  summary?: Record<string, unknown> | null
  error?: string
}

export interface SyncSummary {
  added?: unknown[]
  updated?: unknown[]
  paymentsAdded?: number
  tariffsOnly?: boolean
  tariffsCount?: number
  vpsCount?: number
  paymentsCount?: number
  error?: string
}

export interface RatesData {
  base: string
  rates: Record<string, number>
  date?: string
}

export interface NotificationLogRow {
  id: string
  event: string
  channel: 'telegram' | 'webhook'
  status: 'sent' | 'failed' | 'skipped'
  fingerprint: string | null
  message: string | null
  payload: Record<string, unknown> | null
  createdAt: string
}

export interface DataSnapshot {
  vps: Vps[]
  providers: Provider[]
  providerAccounts: ProviderAccount[]
  payments: Payment[]
  balanceLedger: BalanceLedgerRow[]
  settings: Settings[]
  activeTariffs: ActiveTariff[]
  tariffSyncOptions?: unknown[]
  serverProjects?: unknown[]
  syncLog: SyncLogRow[]
}
