import { syncFromFourvps } from '../fourvps/sync.js'
import {
  fetchUserBalance as fetchFourvpsBalance,
  testConnection as fourvpsTestConnection,
} from '../fourvps/operations.js'
import type { FourvpsSyncAccount } from '../fourvps/context.js'
import { syncFallbackCurrency } from '@cfdm/shared/utils/account-balance'

import type { ProviderAdapter, SyncResult } from './types.js'

export const fourvpsAdapter: ProviderAdapter = {
  type: '4vps',

  async testConnection(apiBaseUrl: string, apiCredentials: string) {
    const result = await fourvpsTestConnection(apiBaseUrl, apiCredentials)
    return { ok: result.ok, message: result.error }
  },

  async syncAccount(
    account: FourvpsSyncAccount,
    options?: { skipTariffs?: boolean; skipVpsPayments?: boolean },
  ): Promise<SyncResult> {
    const result = await syncFromFourvps(account, options)
    return {
      vpsCount: result.vpsCount,
      paymentsCount: result.paymentsCount,
      tariffsCount: result.tariffsCount,
      balance: result.balance,
      syncSummary: result.syncSummary,
      newTariffs: result.newTariffs,
    }
  },

  async fetchBalance(account: FourvpsSyncAccount) {
    const cred =
      account.panelId != null ? `${account.panelId}:${account.apiKey}` : account.apiKey
    const fallbackCurrency = syncFallbackCurrency(account)
    const info = await fetchFourvpsBalance(account.apiBaseUrl, cred, fallbackCurrency)
    return {
      balance: info.balance,
      currency: info.currency || fallbackCurrency,
      enoughmoneyto: '',
    }
  },
}
