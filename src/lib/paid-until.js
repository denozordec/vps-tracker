/**
 * Дата «оплачено до» для VPS (как на дашборде).
 */

function getAccountBalance(accountId, providerAccounts, balanceLedger) {
  const account = providerAccounts.find((a) => a.id === accountId)
  if (account?.balance_api != null && Number.isFinite(Number(account.balance_api))) {
    return Number(account.balance_api)
  }
  const ledgerRows = balanceLedger.filter((row) => row.providerAccountId === accountId)
  const credits = ledgerRows
    .filter((row) => row.direction === 'credit')
    .reduce((acc, row) => acc + Number(row.amount || 0), 0)
  const debits = ledgerRows
    .filter((row) => row.direction === 'debit')
    .reduce((acc, row) => acc + Number(row.amount || 0), 0)
  return credits - debits
}

/**
 * @param {object} item - VPS
 * @param {{ vps: object[], providerAccounts: object[], payments: object[], balanceLedger: object[], now?: Date }} ctx
 * @returns {Date|null}
 */
export function getPaidUntilDate(item, ctx) {
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
    paidUntilFromApi &&
    (() => {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const diffMs = paidUntilFromApi - today
      const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
      return diffDays >= 0 && diffDays <= 2
    })()

  const shouldCalculateFromBalance = isDailyBilling || isPaidUntilNextDay

  if (!shouldCalculateFromBalance && paidUntilFromApi) {
    return paidUntilFromApi
  }

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
