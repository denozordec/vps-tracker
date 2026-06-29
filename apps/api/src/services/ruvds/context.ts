import type { schema } from '@cfdm/db'
import { parseRuvdsToken } from '@cfdm/shared/utils/api-credentials'

type AccountRow = typeof schema.providerAccounts.$inferSelect
type ProviderRow = typeof schema.providers.$inferSelect

export interface RuvdsSyncAccount extends AccountRow {
  apiType: 'ruvds'
  apiBaseUrl: string
  apiToken: string
  providerBaseCurrency?: string | null
}

export function resolveRuvdsApi(
  accountRow: AccountRow | null | undefined,
  providerRow: ProviderRow | null | undefined,
): { apiType: string; apiBaseUrl: string } {
  const apiType = String(providerRow?.apiType || accountRow?.apiType || '').trim()
  const apiBaseUrl = String(providerRow?.apiBaseUrl || accountRow?.apiBaseUrl || '').trim()
  return { apiType, apiBaseUrl }
}

export function ruvdsAccountRowForSync(
  accountRow: AccountRow | null | undefined,
  providerRow: ProviderRow | null | undefined,
): RuvdsSyncAccount | null {
  if (!accountRow) return null
  const { apiType, apiBaseUrl } = resolveRuvdsApi(accountRow, providerRow)
  const apiToken = parseRuvdsToken(accountRow.apiCredentials)
  if (apiType !== 'ruvds' || !apiBaseUrl || !apiToken) return null
  return {
    ...accountRow,
    apiType: 'ruvds',
    apiBaseUrl,
    apiToken,
    providerBaseCurrency: providerRow?.baseCurrency ?? null,
  }
}

export function ruvdsCredentialsString(account: RuvdsSyncAccount): string {
  return account.apiToken
}
