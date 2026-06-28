import type { schema } from '@cfdm/db'
import { parseFourVpsCredentials } from '@cfdm/shared/utils/api-credentials'

type AccountRow = typeof schema.providerAccounts.$inferSelect
type ProviderRow = typeof schema.providers.$inferSelect

export interface FourvpsSyncAccount extends AccountRow {
  apiType: '4vps'
  apiBaseUrl: string
  panelId: number | null
  apiKey: string
}

export function resolveFourvpsApi(
  accountRow: AccountRow | null | undefined,
  providerRow: ProviderRow | null | undefined,
): { apiType: string; apiBaseUrl: string } {
  const apiType = String(providerRow?.apiType || accountRow?.apiType || '').trim()
  const apiBaseUrl = String(providerRow?.apiBaseUrl || accountRow?.apiBaseUrl || '').trim()
  return { apiType, apiBaseUrl }
}

export function fourvpsAccountRowForSync(
  accountRow: AccountRow | null | undefined,
  providerRow: ProviderRow | null | undefined,
): FourvpsSyncAccount | null {
  if (!accountRow) return null
  const { apiType, apiBaseUrl } = resolveFourvpsApi(accountRow, providerRow)
  const cred = String(accountRow.apiCredentials || '').trim()
  const { panelId, apiKey } = parseFourVpsCredentials(cred)
  if (apiType !== '4vps' || !apiBaseUrl || !apiKey) return null
  return { ...accountRow, apiType: '4vps', apiBaseUrl, panelId, apiKey }
}
