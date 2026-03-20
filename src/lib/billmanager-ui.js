/**
 * BILLmanager: URL на хостере, учётные данные на аккаунте.
 */

export function providerByIdMap(providers) {
  return new Map(providers.map((p) => [p.id, p]))
}

/** Аккаунты, для которых можно вызывать синк (есть URL у хостера и креды у аккаунта). */
export function billmanagerSyncableAccounts(providerAccounts, providers) {
  const pmap = providerByIdMap(providers)
  return providerAccounts.filter((a) => {
    const p = pmap.get(a.providerId)
    return p?.apiType === 'billmanager' && (p.apiBaseUrl || '').trim() && a.apiCredentialsSet
  })
}

/** Показывать кнопки баланса/синка и брать баланс из API. */
export function accountBillmanagerUiReady(account, provider) {
  return (
    provider?.apiType === 'billmanager' &&
    (provider.apiBaseUrl || '').trim() &&
    account.apiCredentialsSet
  )
}

export function accountUsesBillmanagerBalanceApi(account, provider) {
  return provider?.apiType === 'billmanager' && account.balance_api != null
}
