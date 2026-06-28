import { getSnapshot } from '@cfdm/db/repositories/snapshot'
import { countExpiringWithin7Days, countInventoryIssues } from '@cfdm/shared/utils/inventory-health'
import { accountBalanceApi } from '@cfdm/shared/utils/account-balance'

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

  const burnByAccount = new Map<string, number>()
  for (const v of activeVps) {
    const burn = vpsBurnRate(v)
    const accountId = v.providerAccountId
    if (!accountId) continue
    burnByAccount.set(accountId, (burnByAccount.get(accountId) ?? 0) + burn)
  }

  let minRunwayDays: number | null = null
  for (const account of snap.providerAccounts) {
    const balance = Number(account.balanceApi ?? 0)
    const burn = burnByAccount.get(account.id) ?? 0
    if (balance <= 0 || burn <= 0) continue
    const days = Math.floor((balance / burn) * 30)
    if (minRunwayDays == null || days < minRunwayDays) minRunwayDays = days
  }

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
  const bmAccounts = snap.providerAccounts.filter((a) => {
    const p = providerById.get(a.providerId)
    return p?.apiType === 'billmanager' && Boolean((p.apiBaseUrl || '').trim()) && a.apiCredentialsSet
  })
  const staleSyncAccountCount = bmAccounts.filter((a) => {
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
