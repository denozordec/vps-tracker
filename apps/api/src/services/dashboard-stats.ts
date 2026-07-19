import { getSnapshot } from '@cfdm/db/repositories/snapshot'
import { countExpiringWithin7Days, countInventoryIssues } from '@cfdm/shared/utils/inventory-health'
import { accountBalanceApi } from '@cfdm/shared/utils/account-balance'
import { isSyncApiType } from '@cfdm/shared/contracts/provider'
import {
  getPaidUntilDate,
  type PaidUntilAccount,
  type PaidUntilContext,
  type PaidUntilVps,
} from '@cfdm/shared/utils/paid-until'

const STALE_SYNC_HOURS = 48

function vpsBurnRate(v: {
  status?: string | null
  tariffType?: string | null
  dailyRate?: number | string | null
  monthlyRate?: number | string | null
}): number {
  if (v.status !== 'active') return 0
  const monthly = Number(v.monthlyRate || 0)
  const daily = Number(v.dailyRate || 0)
  const burn = v.tariffType === 'daily' ? daily * 30 : monthly
  return Number.isFinite(burn) ? burn : 0
}

function lastOkSyncAt(accountId: string, syncLog: { accountId: string; status: string | null; finishedAt: string | null }[]): number | null {
  let best: number | null = null
  for (const r of syncLog) {
    if (r.accountId !== accountId || r.status !== 'ok' || !r.finishedAt) continue
    const t = new Date(r.finishedAt).getTime()
    if (!Number.isNaN(t) && (best == null || t > best)) best = t
  }
  return best
}

/**
 * Минимальный остаток дней до оплаты среди активных VPS.
 * Prepaid: по `paidUntil`; daily / «завтра»: через `getPaidUntilDate` (баланс).
 * Не путать с balance/burn — у prepaid баланс часто ≈0 при уже оплаченном периоде.
 */
export function computeMinRunwayDays(
  vps: PaidUntilVps[],
  ctx: Omit<PaidUntilContext, 'vps' | 'now'> & { providerAccounts: PaidUntilAccount[] },
  now = new Date(),
): number | null {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const fullCtx: PaidUntilContext = { ...ctx, vps, now }
  let minDays: number | null = null

  for (const item of vps) {
    if (item.status !== 'active') continue
    const until = getPaidUntilDate(item, fullCtx)
    if (until == null) continue
    const days = Math.floor((until.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000))
    const remaining = Math.max(0, days)
    if (minDays == null || remaining < minDays) minDays = remaining
  }

  return minDays
}

export interface DashboardStats {
  activeVpsCount: number
  totalVpsCount: number
  providerCount: number
  accountCount: number
  monthlyBurnEstimate: number
  totalBalanceApi: number
  minRunwayDays: number | null
  expiringWithin7Days: number
  issuesCount: number
  lastGlobalSyncAt: string | null
  staleSyncAccountCount: number
  lowBalanceAccountCount: number
}

export function computeDashboardStats(): DashboardStats {
  const snap = getSnapshot()
  const now = new Date()

  const activeVps = snap.vps.filter((v) => v.status === 'active')
  const monthlyBurnEstimate = activeVps.reduce((acc, v) => acc + vpsBurnRate(v), 0)
  const totalBalanceApi = snap.providerAccounts.reduce(
    (acc, a) => acc + (Number(a.balanceApi ?? 0) || 0),
    0,
  )

  const paidUntilCtx = {
    providerAccounts: snap.providerAccounts,
    payments: snap.payments,
    balanceLedger: snap.balanceLedger,
  }
  const minRunwayDays = computeMinRunwayDays(snap.vps, paidUntilCtx, now)

  const expiringWithin7Days = countExpiringWithin7Days(
    {
      vps: snap.vps,
      providerAccounts: snap.providerAccounts,
      providers: snap.providers,
      payments: snap.payments,
      balanceLedger: snap.balanceLedger,
      syncLog: snap.syncLog,
    },
    now,
  )

  const providerById = new Map(snap.providers.map((p) => [p.id, p]))
  const staleMs = STALE_SYNC_HOURS * 60 * 60 * 1000
  const syncAccounts = snap.providerAccounts.filter((a) => {
    const p = providerById.get(a.providerId)
    return isSyncApiType(p?.apiType) && Boolean((p?.apiBaseUrl || '').trim()) && a.apiCredentialsSet
  })
  const staleSyncAccountCount = syncAccounts.filter((a) => {
    const t = lastOkSyncAt(a.id, snap.syncLog)
    if (t == null) return true
    return now.getTime() - t > staleMs
  }).length

  const lowBalanceAccountCount = snap.providerAccounts.filter((a) => {
    const threshold = Number(a.balanceAlertBelow ?? 0)
    if (!Number.isFinite(threshold) || threshold <= 0) return false
    const balance = accountBalanceApi(a)
    return balance != null && balance < threshold
  }).length

  const issuesCount = countInventoryIssues({
    vps: snap.vps,
    providerAccounts: snap.providerAccounts,
    providers: snap.providers,
    payments: snap.payments,
    balanceLedger: snap.balanceLedger,
    syncLog: snap.syncLog,
  })

  let lastGlobalSyncAt: string | null = null
  for (const row of snap.syncLog) {
    if (row.status === 'ok' && row.finishedAt) {
      if (!lastGlobalSyncAt || row.finishedAt > lastGlobalSyncAt) lastGlobalSyncAt = row.finishedAt
    }
  }

  return {
    activeVpsCount: activeVps.length,
    totalVpsCount: snap.vps.length,
    providerCount: snap.providers.length,
    accountCount: snap.providerAccounts.length,
    monthlyBurnEstimate,
    totalBalanceApi,
    minRunwayDays,
    expiringWithin7Days,
    issuesCount,
    lastGlobalSyncAt,
    staleSyncAccountCount,
    lowBalanceAccountCount,
  }
}
