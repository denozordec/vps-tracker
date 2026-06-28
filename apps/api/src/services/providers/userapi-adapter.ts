import { syncFromUserApi } from '../userapi/sync.js'
import { fetchBalance, testConnection } from '../userapi/operations.js'
import type { UserApiSyncAccount } from '../userapi/context.js'

import type { ProviderAdapter, SyncResult } from './types.js'

export const userapiAdapter: ProviderAdapter = {
  type: 'userapi',

  async testConnection(apiBaseUrl: string, apiCredentials: string) {
    const result = await testConnection(apiBaseUrl, apiCredentials)
    return { ok: result.ok, message: result.error }
  },

  async syncAccount(
    account: UserApiSyncAccount,
    options?: { skipTariffs?: boolean; skipVpsPayments?: boolean },
  ): Promise<SyncResult> {
    const result = await syncFromUserApi(account, options)
    return {
      vpsCount: result.vpsCount,
      paymentsCount: result.paymentsCount,
      tariffsCount: result.tariffsCount,
      balance: result.balance,
      syncSummary: result.syncSummary,
      newTariffs: result.newTariffs,
    }
  },

  async fetchBalance(account: UserApiSyncAccount) {
    const info = await fetchBalance(
      account.apiBaseUrl,
      account.apiToken,
      account.currency || 'RUB',
    )
    return {
      balance: info.balance,
      currency: info.currency || 'RUB',
      enoughmoneyto: info.enoughmoneyto || '',
    }
  },
}
