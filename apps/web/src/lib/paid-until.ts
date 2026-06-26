import type { Vps, ProviderAccount, Payment, BalanceLedgerRow } from '@/types/entities'

function getAccountBalance(
  accountId: string,
  providerAccounts: ProviderAccount[],
  balanceLedger: BalanceLedgerRow[],
): number {
  const account = providerAccounts.find((a) => a.id === accountId)
  if (account?.balance_api != null && Number.isFinite(Number(account.balance_api))) {
    return Number(account.balance_api)
  }
  const ledgerRows = balanceLedger.filter((row) => row.providerAccountId === accountId)
  const credits = ledgerRows.filter((r) => r.direction === 'credit').reduce((acc, r) => acc + Number(r.amount || 0), 0)
  const debits = ledgerRows.filter((r) => r.direction === 'debit').reduce((acc, r) => acc + Number(r.amount || 0), 0)
  return credits - debits
}

export interface PaidUntilContext {
  vps: Vps[]
  providerAccounts: ProviderAccount[]
  payments: Payment[]
  balanceLedger: BalanceLedgerRow[]
  now?: Date
}

export function getPaidUntilDate(item: Vps, ctx: PaidUntilContext): Date | null {
  const { vps, providerAccounts, payments, balanceLedger, now = new Date() } = ctx
  if (item.status !== 'active') return null
  const account = providerAccounts.find((a) => a.id === item.providerAccountId)
  const tariffType = item.tariffType || (Number(item.dailyRate || 0) > 0 ? 'daily' : 'monthly')
  const isDailyBilling = tariffType === 'daily' || account?.billingMode === 'daily'

  const paidUntilFromApi = item.paidUntil
    ? (() => {
        const d = new Date(item.paidUntil)
        return Number.isNaN(d.getTime()) ? null : d
      })()
    : null

  const isPaidUntilNextDay =
    paidUntilFromApi != null &&
    (() => {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const diffMs = paidUntilFromApi.getTime() - today.getTime()
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
      return diffDays >= 0 && diffDays <= 2
    })()

  const shouldCalculateFromBalance = isDailyBilling || isPaidUntilNextDay
  if (!shouldCalculateFromBalance && paidUntilFromApi) return paidUntilFromApi

  const dailyRate = Number(item.dailyRate || 0)
  const monthlyRate = Number(item.monthlyRate || 0)
  const burnRate = tariffType === 'daily' ? dailyRate : monthlyRate / 30
  if (!Number.isFinite(burnRate) || burnRate <= 0) return paidUntilFromApi

  const accountBalance = getAccountBalance(item.providerAccountId, providerAccounts, balanceLedger)
  const activeInAccount = vps.filter(
    (v) => v.providerAccountId === item.providerAccountId && v.status === 'active',
  ).length
  const allocatedBalance = activeInAccount > 0 ? Math.max(0, accountBalance) / activeInAccount : 0
  const directPayments = payments
    .filter((p) => p.vpsId === item.id && p.type === 'direct_vps_payment')
    .reduce((acc, p) => acc + Number(p.amount || 0), 0)
  const funds = directPayments + allocatedBalance
  const coveredDays = Math.floor(funds / burnRate)
  if (!Number.isFinite(coveredDays) || coveredDays <= 0) return paidUntilFromApi

  const paidUntil = new Date(now)
  paidUntil.setDate(paidUntil.getDate() + coveredDays)
  return paidUntil
}
