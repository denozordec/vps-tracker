import type { ProviderAdapter, SyncResult } from './types.js'
import { syncFromBillmanager } from '../billmanager/sync.js'
import type { BillmanagerSyncAccount } from '../billmanager/context.js'
import { testConnection as bmTestConnection } from '../billmanager/operations.js'

export const billmanagerAdapter: ProviderAdapter = {
  type: 'billmanager',

  async testConnection(apiBaseUrl: string, apiCredentials: string) {
    const result = await bmTestConnection(apiBaseUrl, apiCredentials)
    return { ok: result.ok, message: result.error }
  },

  async syncAccount(account: BillmanagerSyncAccount, options?: { skipTariffs?: boolean; skipVpsPayments?: boolean }): Promise<SyncResult> {
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
}

export const manualAdapter: ProviderAdapter = {
  type: 'manual',
  async testConnection() {
    return { ok: true, message: 'Ручной учёт — API не требуется' }
  },
  async syncAccount() {
    return {
      vpsCount: 0,
      paymentsCount: 0,
      tariffsCount: 0,
      balance: null,
      syncSummary: { added: [], updated: [], paymentsAdded: 0 },
      newTariffs: [],
    }
  },
}

const adapters: Record<string, ProviderAdapter> = {
  billmanager: billmanagerAdapter,
  manual: manualAdapter,
  none: manualAdapter,
}

export function getProviderAdapter(apiType: string | null | undefined): ProviderAdapter {
  const key = (apiType || 'none').toLowerCase().trim()
  return adapters[key] ?? manualAdapter
}
