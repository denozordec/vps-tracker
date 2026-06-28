export interface SyncSummary {
  added: { id: string; label: string }[]
  updated: { id: string; label: string; fields?: string[] }[]
  paymentsAdded: number
  tariffsOnly?: boolean
}

export interface SyncResult {
  vpsCount: number
  paymentsCount: number
  tariffsCount: number
  balance: { balance?: number; currency?: string } | null
  syncSummary: SyncSummary
  newTariffs: { name: string; price: string; providerId: string }[]
}

export interface ProviderAdapter {
  type: string
  testConnection(apiBaseUrl: string, apiCredentials: string): Promise<{ ok: boolean; message?: string }>
  syncAccount(
    account: unknown,
    options?: { skipTariffs?: boolean; skipVpsPayments?: boolean },
  ): Promise<SyncResult>
}
