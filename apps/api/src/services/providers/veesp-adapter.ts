import { syncFromVeesp } from '../veesp/sync.js'
import { fetchBalance, testConnection } from '../veesp/operations.js'
import type { VeespSyncAccount } from '../veesp/context.js'
import { veespCredentialsString } from '../veesp/context.js'
import { syncFallbackCurrency } from '@cfdm/shared/utils/account-balance'

import type { ProviderAdapter, SyncResult } from './types.js'

export const veespAdapter: ProviderAdapter = {
  type: 'veesp',

  async testConnection(apiBaseUrl: string, apiCredentials: string) {
    const result = await testConnection(apiBaseUrl, apiCredentials)
    return { ok: result.ok, message: result.error }
  },

  async syncAccount(
    account: VeespSyncAccount,
    options?: { skipTariffs?: boolean; skipVpsPayments?: boolean },
  ): Promise<SyncResult> {
    const result = await syncFromVeesp(account, options)
    return {
      vpsCount: result.vpsCount,
      paymentsCount: result.paymentsCount,
      tariffsCount: result.tariffsCount,
      balance: result.balance,
      syncSummary: result.syncSummary,
      newTariffs: result.newTariffs,
    }
  },

  async fetchBalance(account: VeespSyncAccount) {
    const fallbackCurrency = syncFallbackCurrency(account)
    const info = await fetchBalance(
      account.apiBaseUrl,
      veespCredentialsString(account),
      fallbackCurrency,
    )
    return {
      balance: info.balance,
      currency: info.currency || fallbackCurrency,
      enoughmoneyto: info.enoughmoneyto || '',
    }
  },
}
