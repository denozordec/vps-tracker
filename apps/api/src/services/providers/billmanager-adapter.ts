import { syncFromBillmanager } from '../billmanager/sync.js'
import { testConnection as bmTestConnection, fetchDashboardInfo } from '../billmanager/operations.js'
import type { BillmanagerSyncAccount } from '../billmanager/context.js'
import { syncFallbackCurrency } from '@cfdm/shared/utils/account-balance'

import type { ProviderAdapter, SyncResult } from './types.js'

export const billmanagerAdapter: ProviderAdapter = {
  type: 'billmanager',

  async testConnection(apiBaseUrl: string, apiCredentials: string) {
    const result = await bmTestConnection(apiBaseUrl, apiCredentials)
    return { ok: result.ok, message: result.error }
  },

  async syncAccount(
    account: BillmanagerSyncAccount,
    options?: { skipTariffs?: boolean; skipVpsPayments?: boolean },
  ): Promise<SyncResult> {
    const result = await syncFromBillmanager(account, options)
    return {
      vpsCount: result.vpsCount,
      paymentsCount: result.paymentsCount,
      tariffsCount: result.tariffsCount,
      balance: result.balance,
      syncSummary: result.syncSummary,
      newTariffs: result.newTariffs,
    }
  },

  async fetchBalance(account: BillmanagerSyncAccount) {
    const fallbackCurrency = syncFallbackCurrency(account)
    const info = await fetchDashboardInfo(account.apiBaseUrl, String(account.apiCredentials).trim(), {
      fallbackCurrency,
    })
    return {
      balance: info.balance,
      currency: info.currency || fallbackCurrency,
      enoughmoneyto: info.enoughmoneyto || '',
    }
  },
}
