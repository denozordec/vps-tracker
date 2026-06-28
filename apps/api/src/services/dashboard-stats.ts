import { getSnapshot } from '@cfdm/db/repositories/snapshot'

const STALE_SYNC_HOURS = 48

function vpsBurnRate(v: {
  status: string
  tariffType: string
  dailyRate: number | null
  monthlyRate: number | null
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
  const in7Days = new Date(now)
  in7Days.setDate(in7Days.getDate() + 7)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const activeVps = snap.vps.filter((v) => v.status === 'active')
  const monthlyBurnEstimate = activeVps.reduce((acc, v) => acc + vpsBurnRate(v), 0)
  const totalBalanceApi = snap.providerAccounts.reduce(
    (acc, a) => acc + (Number(a.balanceApi ?? 0) || 0),
    0,
  )

  const burnByAccount = new Map<string, number>()
  for (const v of activeVps) {
    const burn = vpsBurnRate(v)
    burnByAccount.set(v.providerAccountId, (burnByAccount.get(v.providerAccountId) ?? 0) + burn)
  }

  let minRunwayDays: number | null = null
  for (const account of snap.providerAccounts) {
    const balance = Number(account.balanceApi ?? 0)
    const burn = burnByAccount.get(account.id) ?? 0
    if (balance <= 0 || burn <= 0) continue
    const days = Math.floor((balance / burn) * 30)
    if (minRunwayDays == null || days < minRunwayDays) minRunwayDays = days
  }

  const expiringWithin7Days = activeVps.filter((v) => {
    if (!v.paidUntil) return false
    const d = new Date(v.paidUntil)
    if (Number.isNaN(d.getTime())) return false
    return d >= todayStart && d <= in7Days
  }).length

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
    const balance = Number(a.balanceApi ?? 0)
    return balance < threshold
  }).length

  const noRateCount = activeVps.filter((v) => {
    const dr = Number(v.dailyRate || 0)
    const mr = Number(v.monthlyRate || 0)
    const noMoney = (!Number.isFinite(dr) || dr <= 0) && (!Number.isFinite(mr) || mr <= 0)
    const noCur = !(v.currency || '').trim()
    return noMoney || noCur
  }).length

  const paidOverdueCount = activeVps.filter((v) => {
    if (!v.paidUntil) return false
    const d = new Date(v.paidUntil)
    if (Number.isNaN(d.getTime())) return false
    return d < todayStart
  }).length

  const balanceMismatchCount = snap.providerAccounts.filter((a) => {
    const apiBalance = a.balanceApi != null ? Number(a.balanceApi) : null
    if (apiBalance == null || !Number.isFinite(apiBalance)) return false
    const rows = snap.balanceLedger.filter((r) => r.providerAccountId === a.id)
    if (rows.length === 0) return false
    const credits = rows.filter((r) => r.direction === 'credit').reduce((acc, r) => acc + Number(r.amount || 0), 0)
    const debits = rows.filter((r) => r.direction === 'debit').reduce((acc, r) => acc + Number(r.amount || 0), 0)
    const ledger = credits - debits
    if (!Number.isFinite(ledger)) return false
    const diff = Math.abs(apiBalance - ledger)
    const tol = Math.max(10, Math.abs(apiBalance) * 0.05)
    return diff > tol
  }).length

  let issuesCount = 0
  if (noRateCount > 0) issuesCount++
  if (paidOverdueCount > 0) issuesCount++
  if (expiringWithin7Days > 0) issuesCount++
  if (staleSyncAccountCount > 0) issuesCount++
  if (lowBalanceAccountCount > 0) issuesCount++
  if (balanceMismatchCount > 0) issuesCount++

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
