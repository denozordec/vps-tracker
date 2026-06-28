import type { schema } from '@cfdm/db'

import { billmanagerAccountRowForSync } from '../billmanager/context.js'
import { fourvpsAccountRowForSync } from '../fourvps/context.js'
import type { BillmanagerSyncAccount } from '../billmanager/context.js'
import type { FourvpsSyncAccount } from '../fourvps/context.js'

import { billmanagerAdapter } from './billmanager-adapter.js'
import { fourvpsAdapter } from './fourvps-adapter.js'
import type { ProviderAdapter } from './types.js'

export { billmanagerAdapter } from './billmanager-adapter.js'
export { fourvpsAdapter } from './fourvps-adapter.js'

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
  '4vps': fourvpsAdapter,
  manual: manualAdapter,
  none: manualAdapter,
}

export function getProviderAdapter(apiType: string | null | undefined): ProviderAdapter {
  const key = (apiType || 'none').toLowerCase().trim()
  return adapters[key] ?? manualAdapter
}

type AccountRow = typeof schema.providerAccounts.$inferSelect
type ProviderRow = typeof schema.providers.$inferSelect

export type SyncReadyAccount = BillmanagerSyncAccount | FourvpsSyncAccount

export function resolveSyncAccount(
  accountRow: AccountRow | null | undefined,
  providerRow: ProviderRow | null | undefined,
): { apiType: string; account: SyncReadyAccount } | null {
  if (!accountRow) return null
  const apiType = String(providerRow?.apiType || accountRow.apiType || '')
    .trim()
    .toLowerCase()

  if (apiType === 'billmanager') {
    const account = billmanagerAccountRowForSync(accountRow, providerRow)
    return account ? { apiType, account } : null
  }
  if (apiType === '4vps') {
    const account = fourvpsAccountRowForSync(accountRow, providerRow)
    return account ? { apiType, account } : null
  }
  return null
}

export const SYNC_SETUP_ERRORS: Record<string, string> = {
  billmanager: 'Укажите в настройках хостера тип API BILLmanager и URL; в аккаунте — логин и пароль API',
  '4vps': 'Укажите в настройках хостера тип API 4VPS и URL; в аккаунте — Panel ID и API Key',
}
