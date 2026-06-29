import type { schema } from '@cfdm/db'
import { parseApiLogin } from '@cfdm/shared/utils/api-credentials'

type AccountRow = typeof schema.providerAccounts.$inferSelect
type ProviderRow = typeof schema.providers.$inferSelect

export interface VeespSyncAccount extends AccountRow {
  apiType: 'veesp'
  apiBaseUrl: string
  apiLogin: string
  apiPassword: string
  providerBaseCurrency?: string | null
}

function parseApiPassword(credentials: string | null | undefined): string {
  const cred = String(credentials ?? '').trim()
  const idx = cred.indexOf(':')
  return idx > 0 ? cred.slice(idx + 1) : ''
}

export function resolveVeespApi(
  accountRow: AccountRow | null | undefined,
  providerRow: ProviderRow | null | undefined,
): { apiType: string; apiBaseUrl: string } {
  const apiType = String(providerRow?.apiType || accountRow?.apiType || '').trim()
  const apiBaseUrl = String(providerRow?.apiBaseUrl || accountRow?.apiBaseUrl || '').trim()
  return { apiType, apiBaseUrl }
}

export function veespAccountRowForSync(
  accountRow: AccountRow | null | undefined,
  providerRow: ProviderRow | null | undefined,
): VeespSyncAccount | null {
  if (!accountRow) return null
  const { apiType, apiBaseUrl } = resolveVeespApi(accountRow, providerRow)
  const apiLogin = parseApiLogin(accountRow.apiCredentials)
  const apiPassword = parseApiPassword(accountRow.apiCredentials)
  if (apiType !== 'veesp' || !apiBaseUrl || !apiLogin || !apiPassword) return null
  return {
    ...accountRow,
    apiType: 'veesp',
    apiBaseUrl,
    apiLogin,
    apiPassword,
    providerBaseCurrency: providerRow?.baseCurrency ?? null,
  }
}

export function veespCredentialsString(account: VeespSyncAccount): string {
  return `${account.apiLogin}:${account.apiPassword}`
}
