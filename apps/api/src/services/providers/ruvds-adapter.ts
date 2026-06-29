import { syncFromRuvds } from '../ruvds/sync.js'
import { fetchBalance, testConnection } from '../ruvds/operations.js'
import type { RuvdsSyncAccount } from '../ruvds/context.js'
import { ruvdsCredentialsString } from '../ruvds/context.js'
import { syncFallbackCurrency } from '@cfdm/shared/utils/account-balance'

import type { ProviderAdapter, SyncResult } from './types.js'

export const ruvdsAdapter: ProviderAdapter = {
  type: 'ruvds',

  async testConnection(apiBaseUrl: string, apiCredentials: string) {
    const result = await testConnection(apiBaseUrl, apiCredentials)
    return { ok: result.ok, message: result.error }
  },

  async syncAccount(
    account: RuvdsSyncAccount,
    options?: { skipTariffs?: boolean; skipVpsPayments?: boolean },
  ): Promise<SyncResult> {
    const result = await syncFromRuvds(account, options)
    return {
      vpsCount: result.vpsCount,
      paymentsCount: result.paymentsCount,
      tariffsCount: result.tariffsCount,
      balance: result.balance,
      syncSummary: result.syncSummary,
      newTariffs: result.newTariffs,
    }
  },

  async fetchBalance(account: RuvdsSyncAccount) {
    const fallbackCurrency = syncFallbackCurrency(account)
    const info = await fetchBalance(
      account.apiBaseUrl,
      ruvdsCredentialsString(account),
      fallbackCurrency,
    )
    return {
      balance: info.balance,
      currency: info.currency || fallbackCurrency,
      enoughmoneyto: info.enoughmoneyto || '',
    }
  },
}
