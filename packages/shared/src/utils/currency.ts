/** Валюта хостера: настройки провайдера → аккаунт → fallback. */
export function resolveProviderCurrency(
  provider?: { baseCurrency?: string | null } | null,
  accountCurrency?: string | null,
  fallback = 'RUB',
): string {
  const fromProvider = (provider?.baseCurrency ?? '').trim()
  if (fromProvider) return fromProvider
  const fromAccount = (accountCurrency ?? '').trim()
  if (fromAccount) return fromAccount
  return fallback
}
