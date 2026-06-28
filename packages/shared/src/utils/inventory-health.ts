import { accountBalanceApi } from './account-balance.js'
import { getPaidUntilDate, type PaidUntilContext } from './paid-until.js'

export const STALE_SYNC_HOURS = 48

export interface HealthProvider {
  id: string
  apiType?: string | null
  apiBaseUrl?: string | null
}

export interface HealthProviderAccount {
  id: string
  providerId: string
  balance_api?: number | null
  balanceApi?: number | null
  balance_currency?: string | null
  balanceCurrency?: string | null
  currency?: string | null
  apiCredentialsSet?: boolean
  balanceAlertBelow?: number | null
}

export interface HealthBalanceLedgerRow {
  providerAccountId?: string | null
  direction?: string | null
  amount?: number | string | null
  currency?: string | null
}

export interface HealthSyncLogRow {
  accountId: string
  status?: string | null
  finishedAt?: string | null
}

export interface InventoryIssue {
  key: string
  title: string
  count: number
  to: string
  hint?: string
}

export interface InventoryHealthInput extends PaidUntilContext {
  providerAccounts: HealthProviderAccount[]
  providers?: HealthProvider[]
  balanceLedger: HealthBalanceLedgerRow[]
  syncLog?: HealthSyncLogRow[]
}

function ledgerRowsInAccountCurrency(
  account: HealthProviderAccount,
  balanceLedger: HealthBalanceLedgerRow[],
): HealthBalanceLedgerRow[] {
  const cur = (account.balance_currency || account.balanceCurrency || account.currency || '').trim()
  const rows = balanceLedger.filter((row) => row.providerAccountId === account.id)
  if (!cur) return rows
  return rows.filter((row) => !row.currency || row.currency === cur)
}

function ledgerBalanceInCurrency(
  account: HealthProviderAccount,
  balanceLedger: HealthBalanceLedgerRow[],
): number {
  const filtered = ledgerRowsInAccountCurrency(account, balanceLedger)
  const credits = filtered
    .filter((r) => r.direction === 'credit')
    .reduce((acc, r) => acc + Number(r.amount || 0), 0)
  const debits = filtered
    .filter((r) => r.direction === 'debit')
    .reduce((acc, r) => acc + Number(r.amount || 0), 0)
  return credits - debits
}

export function accountHasApiLedgerMismatch(
  account: HealthProviderAccount,
  balanceLedger: HealthBalanceLedgerRow[],
): boolean {
  const apiBalance = accountBalanceApi(account)
  if (apiBalance == null) return false
  const rows = ledgerRowsInAccountCurrency(account, balanceLedger)
  if (rows.length === 0) return false
  const ledger = ledgerBalanceInCurrency(account, balanceLedger)
  if (!Number.isFinite(ledger)) return false
  const diff = Math.abs(apiBalance - ledger)
  const tol = Math.max(10, Math.abs(apiBalance) * 0.05)
  return diff > tol
}

export function lastOkSyncFinishedAt(
  accountId: string,
  syncLog: HealthSyncLogRow[] = [],
): number | null {
  const rows = syncLog.filter((r) => r.accountId === accountId && r.status === 'ok' && r.finishedAt)
  let best: number | null = null
  for (const r of rows) {
    const t = new Date(r.finishedAt as string).getTime()
    if (!Number.isNaN(t) && (best == null || t > best)) best = t
  }
  return best
}

export function countExpiringWithin7Days(input: InventoryHealthInput, now = new Date()): number {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const in7Days = new Date(now)
  in7Days.setDate(in7Days.getDate() + 7)
  const ctx = { ...input, now }
  return input.vps.filter((v) => {
    if (v.status !== 'active') return false
    const d = getPaidUntilDate(v, ctx)
    if (d == null) return false
    return d >= todayStart && d <= in7Days
  }).length
}

export function computeInventoryHealth(input: InventoryHealthInput): InventoryIssue[] {
  const { vps, providerAccounts, providers = [], balanceLedger, syncLog = [] } = input
  const providerById = new Map(providers.map((p) => [p.id, p]))
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const in7Days = new Date(now)
  in7Days.setDate(in7Days.getDate() + 7)
  const ctx = { ...input, now }

  const issues: InventoryIssue[] = []

  const noRate = vps.filter((v) => {
    if (v.status !== 'active') return false
    const dr = Number(v.dailyRate || 0)
    const mr = Number(v.monthlyRate || 0)
    const noMoney = (!Number.isFinite(dr) || dr <= 0) && (!Number.isFinite(mr) || mr <= 0)
    const noCur = !(v.currency || '').trim()
    return noMoney || noCur
  })
  if (noRate.length) {
    issues.push({ key: 'no-rate', title: 'Нет ставки или валюты', count: noRate.length, to: '/vps?health=no-rate' })
  }

  const paidOverdue = vps.filter((v) => {
    if (v.status !== 'active') return false
    const d = getPaidUntilDate(v, ctx)
    return d != null && d < todayStart
  })
  if (paidOverdue.length) {
    issues.push({
      key: 'paid-overdue',
      title: 'Просрочена оплата (оценка)',
      count: paidOverdue.length,
      to: '/vps?health=paid-overdue',
    })
  }

  const expiringSoon = vps.filter((v) => {
    if (v.status !== 'active') return false
    const d = getPaidUntilDate(v, ctx)
    if (d == null) return false
    return d >= todayStart && d <= in7Days
  })
  if (expiringSoon.length) {
    issues.push({
      key: 'expiring-soon',
      title: 'Истекает в течение 7 дней',
      count: expiringSoon.length,
      to: '/vps?health=expiring-soon',
    })
  }

  const bmAccounts = providerAccounts.filter((a) => {
    const p = providerById.get(a.providerId)
    return p?.apiType === 'billmanager' && Boolean((p.apiBaseUrl || '').trim()) && a.apiCredentialsSet
  })
  const staleMs = STALE_SYNC_HOURS * 60 * 60 * 1000
  const staleAccounts = bmAccounts.filter((a) => {
    const t = lastOkSyncFinishedAt(a.id, syncLog)
    if (t == null) return true
    return now.getTime() - t > staleMs
  })
  if (staleAccounts.length) {
    issues.push({
      key: 'stale-sync',
      title: `Нет успешного синка > ${STALE_SYNC_HOURS} ч`,
      count: staleAccounts.length,
      to: '/accounts?health=stale-sync',
      hint: 'Проверьте API и журнал синхронизации',
    })
  }

  const lowBalanceAccounts = providerAccounts.filter((a) => {
    const threshold = Number(a.balanceAlertBelow ?? 0)
    if (!Number.isFinite(threshold) || threshold <= 0) return false
    const balance = accountBalanceApi(a)
    return balance != null && balance < threshold
  })
  if (lowBalanceAccounts.length) {
    issues.push({
      key: 'low-balance',
      title: 'Низкий баланс аккаунта',
      count: lowBalanceAccounts.length,
      to: '/accounts?health=low-balance',
    })
  }

  const mismatchAccounts = providerAccounts.filter((a) => accountHasApiLedgerMismatch(a, balanceLedger))
  if (mismatchAccounts.length) {
    issues.push({
      key: 'balance-mismatch',
      title: 'Баланс API и ledger расходятся',
      count: mismatchAccounts.length,
      to: '/accounts?health=balance-mismatch',
      hint: 'Считается только если в журнале «Баланс и списания» есть движения по аккаунту',
    })
  }

  return issues
}

export function countInventoryIssues(input: InventoryHealthInput): number {
  return computeInventoryHealth(input).length
}

export function getStaleSyncAccountIds(
  providerAccounts: HealthProviderAccount[],
  providers: HealthProvider[],
  syncLog: HealthSyncLogRow[] = [],
  now = new Date(),
): string[] {
  const providerById = new Map(providers.map((p) => [p.id, p]))
  const bmAccounts = providerAccounts.filter((a) => {
    const p = providerById.get(a.providerId)
    return p?.apiType === 'billmanager' && Boolean((p.apiBaseUrl || '').trim()) && a.apiCredentialsSet
  })
  const staleMs = STALE_SYNC_HOURS * 60 * 60 * 1000
  return bmAccounts
    .filter((a) => {
      const t = lastOkSyncFinishedAt(a.id, syncLog)
      if (t == null) return true
      return now.getTime() - t > staleMs
    })
    .map((a) => a.id)
}

export function getBalanceMismatchAccountIds(
  providerAccounts: HealthProviderAccount[],
  balanceLedger: HealthBalanceLedgerRow[],
): string[] {
  return providerAccounts.filter((a) => accountHasApiLedgerMismatch(a, balanceLedger)).map((a) => a.id)
}
