/** Валюта: явная валюта аккаунта → baseCurrency хостера → fallback. */
export function resolveProviderCurrency(
  provider?: { baseCurrency?: string | null } | null,
  accountCurrency?: string | null,
  fallback = 'RUB',
): string {
  const fromAccount = (accountCurrency ?? '').trim()
  if (fromAccount) return fromAccount
  const fromProvider = (provider?.baseCurrency ?? '').trim()
  if (fromProvider) return fromProvider
  return fallback
}
