import type {
  ProviderAccount,
  Provider,
  SyncLogRow,
  BalanceLedgerRow,
} from '@/types/entities'
import { accountBalanceApi } from '@/lib/account'
import { isSyncApiType } from '@cfdm/shared/contracts/provider'
import { accountSyncUiReady } from '@/lib/provider-sync'
import {
  accountHasApiLedgerMismatch,
  getStaleSyncAccountIds,
} from '@/lib/inventory-health'

export type AccountHealthFlag = 'stale-sync' | 'low-balance' | 'balance-mismatch' | 'no-creds'

export const ACCOUNT_HEALTH_LABELS: Record<AccountHealthFlag, string> = {
  'stale-sync': 'Устаревший синк',
  'low-balance': 'Низкий баланс',
  'balance-mismatch': 'Расхождение ledger',
  'no-creds': 'Нет API-доступа',
}

export interface AccountHealthContext {
  providers: Provider[]
  syncLog?: SyncLogRow[]
  balanceLedger?: BalanceLedgerRow[]
}

export interface AtRiskAccount {
  id: string
  name: string
  reason: string
  severity: 'warning' | 'destructive'
}

export function getAccountHealthFlags(
  account: ProviderAccount,
  ctx: AccountHealthContext,
): AccountHealthFlag[] {
  const provider = ctx.providers.find((p) => p.id === account.providerId)
  const flags: AccountHealthFlag[] = []

  if (isSyncApiType(provider?.apiType) && !account.apiCredentialsSet) {
    flags.push('no-creds')
  }

  const staleIds = new Set(getStaleSyncAccountIds([account], ctx.providers, ctx.syncLog ?? []))
  if (staleIds.has(account.id)) flags.push('stale-sync')

  const ext = account as ProviderAccount & { balanceAlertBelow?: number | null }
  const threshold = Number(ext.balanceAlertBelow ?? 0)
  const balance = accountBalanceApi(account)
  if (Number.isFinite(threshold) && threshold > 0 && balance != null && balance < threshold) {
    flags.push('low-balance')
  }

  if (ctx.balanceLedger && accountHasApiLedgerMismatch(account, ctx.balanceLedger)) {
    flags.push('balance-mismatch')
  }

  return flags
}

export function accountHasHealthIssues(account: ProviderAccount, ctx: AccountHealthContext): boolean {
  return getAccountHealthFlags(account, ctx).length > 0
}

export function buildAtRiskAccounts(
  accounts: ProviderAccount[],
  providers: Provider[],
  syncLog: SyncLogRow[] = [],
): AtRiskAccount[] {
  const ctx: AccountHealthContext = { providers, syncLog }
  const rows: AtRiskAccount[] = []
  for (const a of accounts) {
    const flags = getAccountHealthFlags(a, ctx)
    if (flags.includes('low-balance')) {
      rows.push({ id: a.id, name: a.name, reason: ACCOUNT_HEALTH_LABELS['low-balance'], severity: 'destructive' })
    } else if (flags.includes('stale-sync')) {
      rows.push({ id: a.id, name: a.name, reason: ACCOUNT_HEALTH_LABELS['stale-sync'], severity: 'warning' })
    }
  }
  return rows
}

export function countAccountsWithIssues(
  accounts: ProviderAccount[],
  ctx: AccountHealthContext,
): number {
  return accounts.filter((a) => accountHasHealthIssues(a, ctx)).length
}

export function countLowBalanceAccounts(
  accounts: ProviderAccount[],
  ctx: AccountHealthContext,
): number {
  return accounts.filter((a) => getAccountHealthFlags(a, ctx).includes('low-balance')).length
}

export function isAccountSyncable(account: ProviderAccount, providers: Provider[]): boolean {
  const provider = providers.find((p) => p.id === account.providerId)
  return accountSyncUiReady(account, provider)
}
