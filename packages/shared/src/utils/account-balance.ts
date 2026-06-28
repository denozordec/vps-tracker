/** Баланс API аккаунта (camelCase из API и snake_case в типах). */
export function accountBalanceApi(account: {
  balance_api?: number | null
  balanceApi?: number | null
}): number | null {
  const raw = account.balance_api ?? account.balanceApi
  if (raw == null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function accountBalanceCurrency(account: {
  balance_currency?: string
  balanceCurrency?: string
  currency?: string
}): string {
  return account.balance_currency ?? account.balanceCurrency ?? account.currency ?? 'RUB'
}
