import type { ProviderAccount, Provider } from '@/types/entities'

export function providerByIdMap(providers: Provider[]): Map<string, Provider> {
  return new Map(providers.map((p) => [p.id, p]))
}

export function billmanagerSyncableAccounts(
  providerAccounts: ProviderAccount[],
  providers: Provider[],
): ProviderAccount[] {
  const pmap = providerByIdMap(providers)
  return providerAccounts.filter((a) => {
    const p = pmap.get(a.providerId)
    return p?.apiType === 'billmanager' && Boolean((p.apiBaseUrl || '').trim()) && a.apiCredentialsSet
  })
}

export function accountBillmanagerUiReady(
  account: ProviderAccount,
  provider?: Provider | null,
): boolean {
  return (
    provider?.apiType === 'billmanager' &&
    Boolean((provider.apiBaseUrl || '').trim()) &&
    Boolean(account.apiCredentialsSet)
  )
}

export function accountUsesBillmanagerBalanceApi(
  account: ProviderAccount,
  provider?: Provider | null,
): boolean {
  return provider?.apiType === 'billmanager' && account.balance_api != null
}

export function accountSelectLabel(
  account: ProviderAccount,
  providerById: Map<string, Provider>,
  scopedProviderId?: string,
): string {
  const name = account.name?.trim() || '—'
  if (scopedProviderId) return name
  const providerName = providerById.get(account.providerId)?.name ?? '—'
  return `${providerName} / ${name}`
}
