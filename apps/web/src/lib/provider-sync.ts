import { isSyncApiType, isUserApiType } from '@cfdm/shared/contracts/provider'

import type { ProviderAccount, Provider } from '@/types/entities'

export { isSyncApiType, isUserApiType }

export function providerByIdMap(providers: Provider[]): Map<string, Provider> {
  return new Map(providers.map((p) => [p.id, p]))
}

export function syncableAccounts(
  providerAccounts: ProviderAccount[],
  providers: Provider[],
): ProviderAccount[] {
  const pmap = providerByIdMap(providers)
  return providerAccounts.filter((a) => {
    const p = pmap.get(a.providerId)
    return isSyncApiType(p?.apiType) && Boolean((p?.apiBaseUrl || '').trim()) && a.apiCredentialsSet
  })
}

/** @deprecated Используйте syncableAccounts */
export const billmanagerSyncableAccounts = syncableAccounts

export function accountSyncUiReady(
  account: ProviderAccount,
  provider?: Provider | null,
): boolean {
  return (
    isSyncApiType(provider?.apiType) &&
    Boolean((provider?.apiBaseUrl || '').trim()) &&
    Boolean(account.apiCredentialsSet)
  )
}

/** @deprecated Используйте accountSyncUiReady */
export const accountBillmanagerUiReady = accountSyncUiReady

export function accountUsesApiBalance(
  account: ProviderAccount,
  provider?: Provider | null,
): boolean {
  return isSyncApiType(provider?.apiType) && account.balance_api != null
}

/** @deprecated Используйте accountUsesApiBalance */
export const accountUsesBillmanagerBalanceApi = accountUsesApiBalance

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

export function accountCredentialLabels(apiType?: string | null): {
  loginLabel: string
  passwordLabel: string
  loginPlaceholder: string
} {
  if (String(apiType).toLowerCase() === '4vps') {
    return {
      loginLabel: 'Panel ID',
      passwordLabel: 'API Key',
      loginPlaceholder: '1',
    }
  }
  if (String(apiType).toLowerCase() === 'veesp') {
    return {
      loginLabel: 'Email',
      passwordLabel: 'Пароль',
      loginPlaceholder: 'user@example.com',
    }
  }
  if (isUserApiType(apiType)) {
    return {
      loginLabel: '',
      passwordLabel: 'API Token',
      loginPlaceholder: '',
    }
  }
  return {
    loginLabel: 'Логин API',
    passwordLabel: 'Пароль API',
    loginPlaceholder: '',
  }
}
