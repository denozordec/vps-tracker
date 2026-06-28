import type { schema } from '@cfdm/db'
import { isUserApiType, type UserApiType } from '@cfdm/shared/contracts/provider'
import { parseUserApiToken } from '@cfdm/shared/utils/api-credentials'

type AccountRow = typeof schema.providerAccounts.$inferSelect
type ProviderRow = typeof schema.providers.$inferSelect

export interface UserApiSyncAccount extends AccountRow {
  apiType: UserApiType
  apiBaseUrl: string
  apiToken: string
}

export function resolveUserApi(
  accountRow: AccountRow | null | undefined,
  providerRow: ProviderRow | null | undefined,
): { apiType: UserApiType; apiBaseUrl: string } | null {
  const rawType = String(providerRow?.apiType || accountRow?.apiType || '')
    .trim()
    .toLowerCase()
  if (!isUserApiType(rawType)) return null
  const apiBaseUrl = String(providerRow?.apiBaseUrl || accountRow?.apiBaseUrl || '').trim()
  return { apiType: rawType, apiBaseUrl }
}

export function userApiAccountRowForSync(
  accountRow: AccountRow | null | undefined,
  providerRow: ProviderRow | null | undefined,
): UserApiSyncAccount | null {
  if (!accountRow) return null
  const resolved = resolveUserApi(accountRow, providerRow)
  const apiToken = parseUserApiToken(accountRow.apiCredentials)
  if (!resolved || !resolved.apiBaseUrl || !apiToken) return null
  return { ...accountRow, apiType: resolved.apiType, apiBaseUrl: resolved.apiBaseUrl, apiToken }
}
