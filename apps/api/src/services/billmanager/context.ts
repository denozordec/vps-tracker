import type { schema } from '@cfdm/db'

type AccountRow = typeof schema.providerAccounts.$inferSelect
type ProviderRow = typeof schema.providers.$inferSelect

export interface BillmanagerSyncAccount extends AccountRow {
  apiType: 'billmanager'
  apiBaseUrl: string
  providerBaseCurrency?: string | null
}

export function resolveBillmanagerApi(
  accountRow: AccountRow | null | undefined,
  providerRow: ProviderRow | null | undefined,
): { apiType: string; apiBaseUrl: string } {
  const apiType = String(providerRow?.apiType || accountRow?.apiType || '').trim()
  const apiBaseUrl = String(providerRow?.apiBaseUrl || accountRow?.apiBaseUrl || '').trim()
  return { apiType, apiBaseUrl }
}

export function billmanagerAccountRowForSync(
  accountRow: AccountRow | null | undefined,
  providerRow: ProviderRow | null | undefined,
): BillmanagerSyncAccount | null {
  if (!accountRow) return null
  const { apiType, apiBaseUrl } = resolveBillmanagerApi(accountRow, providerRow)
  const cred = String(accountRow.apiCredentials || '').trim()
  if (apiType !== 'billmanager' || !apiBaseUrl || !cred) return null
  return { ...accountRow, apiType: 'billmanager', apiBaseUrl, providerBaseCurrency: providerRow?.baseCurrency ?? null }
}
