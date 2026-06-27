import type {
  Vps,
  ProviderAccount,
  Provider,
  Payment,
  BalanceLedgerRow,
  SyncLogRow,
  SyncSummary,
} from '@/types/entities'
import { getPaidUntilDate } from './paid-until'

const STALE_SYNC_HOURS = 48

function ledgerRowsInAccountCurrency(
  account: ProviderAccount,
  balanceLedger: BalanceLedgerRow[],
): BalanceLedgerRow[] {
  const cur = (account.balance_currency || account.currency || '').trim()
  const rows = balanceLedger.filter((row) => row.providerAccountId === account.id)
  if (!cur) return rows
  return rows.filter((row) => !row.currency || row.currency === cur)
}

function ledgerBalanceInCurrency(
  account: ProviderAccount,
  balanceLedger: BalanceLedgerRow[],
): number {
  const filtered = ledgerRowsInAccountCurrency(account, balanceLedger)
  const credits = filtered.filter((r) => r.direction === 'credit').reduce((acc, r) => acc + Number(r.amount || 0), 0)
  const debits = filtered.filter((r) => r.direction === 'debit').reduce((acc, r) => acc + Number(r.amount || 0), 0)
  return credits - debits
}

import { accountBalanceApi } from '@/lib/account'

export function accountHasApiLedgerMismatch(
  account: ProviderAccount,
  balanceLedger: BalanceLedgerRow[],
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
  syncLog: SyncLogRow[] = [],
): number | null {
  const rows = syncLog.filter((r) => r.accountId === accountId && r.status === 'ok' && r.finishedAt)
  let best: number | null = null
  for (const r of rows) {
    const t = new Date(r.finishedAt as string).getTime()
    if (!Number.isNaN(t) && (best == null || t > best)) best = t
  }
  return best
}

export interface InventoryIssue {
  key: string
  title: string
  count: number
  to: string
  hint?: string
}

export interface InventoryHealthInput {
  vps: Vps[]
  providerAccounts: ProviderAccount[]
  providers?: Provider[]
  payments: Payment[]
  balanceLedger: BalanceLedgerRow[]
  syncLog?: SyncLogRow[]
}

export function computeInventoryHealth(input: InventoryHealthInput): InventoryIssue[] {
  const { vps, providerAccounts, providers = [], payments, balanceLedger, syncLog = [] } = input
  const providerById = new Map(providers.map((p) => [p.id, p]))
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ctx = { vps, providerAccounts, payments, balanceLedger, now }

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
    issues.push({ key: 'paid-overdue', title: 'Просрочена оплата (оценка)', count: paidOverdue.length, to: '/vps?health=paid-overdue' })
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

export function getStaleSyncAccountIds(
  providerAccounts: ProviderAccount[],
  providers: Provider[],
  syncLog: SyncLogRow[] = [],
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
  providerAccounts: ProviderAccount[],
  balanceLedger: BalanceLedgerRow[],
): string[] {
  return providerAccounts.filter((a) => accountHasApiLedgerMismatch(a, balanceLedger)).map((a) => a.id)
}

export function formatSyncSummaryLine(summary: SyncSummary | null | undefined): string {
  if (!summary || typeof summary !== 'object') return ''
  if (summary.error) return String(summary.error)
  const parts: string[] = []
  if (summary.added?.length) parts.push(`+${summary.added.length} VPS`)
  if (summary.updated?.length) parts.push(`~${summary.updated.length} изм.`)
  if (summary.paymentsAdded) parts.push(`+${summary.paymentsAdded} платежей`)
  if (summary.tariffsOnly && summary.tariffsCount != null) parts.push(`тарифы: ${summary.tariffsCount}`)
  if (parts.length) return parts.join(', ')
  if (summary.vpsCount != null || summary.paymentsCount != null) {
    return `синк: VPS ${summary.vpsCount ?? 0}, платежи ${summary.paymentsCount ?? 0}`
  }
  return ''
}
