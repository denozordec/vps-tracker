import { resolveProviderCurrency } from './currency.js'

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

/** Валюта баланса: валюта аккаунта → baseCurrency хостера → balance_currency/currency. */
export function effectiveAccountBalanceCurrency(
  account: {
    balance_currency?: string
    balanceCurrency?: string
    currency?: string
  },
  provider?: { baseCurrency?: string | null } | null,
): string {
  return resolveProviderCurrency(provider, account.currency ?? accountBalanceCurrency(account))
}

export function syncFallbackCurrency(
  account: { currency?: string | null; providerBaseCurrency?: string | null; balanceCurrency?: string | null },
  options?: { balanceCurrency?: string | null },
): string {
  const accountCur = (account.currency ?? '').trim()
  if (accountCur) return accountCur
  const freshBalanceCur = (options?.balanceCurrency ?? '').trim()
  if (freshBalanceCur) return freshBalanceCur
  const storedBalanceCur = (account.balanceCurrency ?? '').trim()
  if (storedBalanceCur) return storedBalanceCur
  return resolveProviderCurrency({ baseCurrency: account.providerBaseCurrency }, null)
}
