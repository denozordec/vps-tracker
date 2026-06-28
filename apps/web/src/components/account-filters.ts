import type { ProviderAccount, Provider } from '@/types/entities'
import {
  getAccountHealthFlags,
  isAccountSyncable,
  type AccountHealthContext,
} from '@/lib/account-health'

export interface AccountFiltersState {
  search: string
  providerIds: string[]
  billingMode: '' | 'daily' | 'monthly'
  syncableOnly: boolean
  issuesOnly: boolean
  lowBalanceOnly: boolean
}

export function buildDefaultAccountFilters(): AccountFiltersState {
  return {
    search: '',
    providerIds: [],
    billingMode: '',
    syncableOnly: false,
    issuesOnly: false,
    lowBalanceOnly: false,
  }
}

export function hasActiveAccountFilters(filters: AccountFiltersState): boolean {
  return Boolean(
    filters.search.trim() ||
      filters.providerIds.length ||
      filters.billingMode ||
      filters.syncableOnly ||
      filters.issuesOnly ||
      filters.lowBalanceOnly,
  )
}

export function matchesAccountFilterPreset(
  filters: AccountFiltersState,
  preset: Partial<AccountFiltersState>,
): boolean {
  const expected = { ...buildDefaultAccountFilters(), ...preset }
  return (
    filters.search === expected.search &&
    filters.providerIds.join(',') === expected.providerIds.join(',') &&
    filters.billingMode === expected.billingMode &&
    filters.syncableOnly === expected.syncableOnly &&
    filters.issuesOnly === expected.issuesOnly &&
    filters.lowBalanceOnly === expected.lowBalanceOnly
  )
}

export function applyAccountFilters(
  accounts: ProviderAccount[],
  filters: AccountFiltersState,
  providers: Provider[],
  healthCtx: AccountHealthContext,
): ProviderAccount[] {
  const q = filters.search.trim().toLowerCase()
  return accounts.filter((account) => {
    if (q) {
      const hay = `${account.name} ${account.apiLogin ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (filters.providerIds.length && !filters.providerIds.includes(account.providerId)) return false
    if (filters.billingMode && (account.billingMode ?? 'monthly') !== filters.billingMode) return false
    if (filters.syncableOnly && !isAccountSyncable(account, providers)) return false
    const flags = getAccountHealthFlags(account, healthCtx)
    if (filters.issuesOnly && flags.length === 0) return false
    if (filters.lowBalanceOnly && !flags.includes('low-balance')) return false
    return true
  })
}
