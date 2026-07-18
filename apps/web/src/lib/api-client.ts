import type {
  DataSnapshot,
  RatesData,
  Settings,
  Vps,
  Provider,
  ProviderAccount,
  Payment,
  BalanceLedgerRow,
} from '@/types/entities'
import { clearToken, ensureAuthConfig, getToken, isAuthEnabled, redirectToPortalLogin } from '@/lib/auth'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(options.headers)
  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  // Always attach token if present (API may require it even without VITE_AUTH_ENABLED)
  const token = getToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const res = await fetch(url, {
    ...options,
    headers,
  })
  if (!res.ok) {
    if (res.status === 401) {
      // Avoid redirect storms: only hand off once per page load
      const handoffKey = 'vps_auth_401_handoff'
      const already = sessionStorage.getItem(handoffKey)
      clearToken()
      const cfg = await ensureAuthConfig()
      if ((cfg.required || isAuthEnabled()) && !already) {
        sessionStorage.setItem(handoffKey, '1')
        redirectToPortalLogin(`${window.location.origin}/auth/callback`)
      }
    }
    let message = res.statusText || 'API error'
    try {
      const data = (await res.json()) as {
        error?: string | { message?: string; code?: string }
        message?: string
      }
      if (typeof data?.error === 'string') message = data.error
      else if (data?.error?.message) message = data.error.message
      else if (typeof data?.message === 'string') message = data.message
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status)
  }
  if (res.status === 204) return null as T
  return (await res.json()) as T
}

export type CollectionName =
  | 'vps'
  | 'providers'
  | 'providerAccounts'
  | 'payments'
  | 'balanceLedger'
  | 'settings'

const COLLECTION_PATHS: Record<CollectionName, string> = {
  vps: '/api/vps',
  providers: '/api/providers',
  providerAccounts: '/api/provider-accounts',
  payments: '/api/payments',
  balanceLedger: '/api/balance-ledger',
  settings: '/api/settings',
}

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const api = {
  fetchData: () => fetchApi<DataSnapshot>('/api/data'),
  get: <T>(path: string) => fetchApi<T>(`/api/${path.replace(/^\//, '')}`),
  fetchCollection: <T>(name: CollectionName) => fetchApi<T[]>(COLLECTION_PATHS[name]),

  create: <T extends { id?: string }>(name: CollectionName, record: T) =>
    fetchApi<T[]>(COLLECTION_PATHS[name], {
      method: 'POST',
      body: JSON.stringify({ ...record, id: record.id || uid() }),
    }),

  update: <T>(name: CollectionName, id: string, patch: Partial<T>) =>
    fetchApi<T[]>(`${COLLECTION_PATHS[name]}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  remove: <T>(name: CollectionName, id: string) =>
    fetchApi<T[]>(`${COLLECTION_PATHS[name]}/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  bulkUpdateVps: (ids: string[], action: string, value: unknown) =>
    fetchApi('/api/vps/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids, action, value }),
    }),

  syncAccount: (accountId: string, opts: Record<string, unknown> = {}) =>
    fetchApi(`/api/sync/${encodeURIComponent(accountId)}`, {
      method: 'POST',
      body: JSON.stringify(opts),
    }),

  fetchAccountBalance: (accountId: string) =>
    fetchApi<{ balance: number; currency: string }>(
      `/api/sync/${encodeURIComponent(accountId)}/balance`,
    ),

  testConnection: (apiBaseUrl: string, apiCredentials: string, apiType?: string) =>
    fetchApi('/api/sync/test-connection', {
      method: 'POST',
      body: JSON.stringify({ apiBaseUrl, apiCredentials, apiType }),
    }),

  fetchSyncStatus: () => fetchApi('/api/sync/status'),
  sendTelegramTest: (body?: {
    telegramBotToken?: string
    telegramChatId?: string
    telegramMessageThreadId?: string
  }) =>
    fetchApi<{ ok: boolean; error?: string }>('/api/settings/telegram/test', {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),

  sendWebhookTest: () =>
    fetchApi<{ ok: boolean; error?: string }>('/api/settings/webhook/test', { method: 'POST' }),

  fetchNotificationLog: (limit = 50) =>
    fetchApi<import('@/types/entities').NotificationLogRow[]>(
      `/api/notifications/log?limit=${limit}`,
    ),

  fetchProjectSuggestions: (q = '', limit = 25) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    params.set('limit', String(limit))
    return fetchApi<string[]>(`/api/projects/suggest?${params.toString()}`)
  },

  downloadBackupJson: async (): Promise<Blob> => {
    const headers = new Headers()
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const res = await fetch(`${API_BASE}/api/backup/json`, { headers })
    if (!res.ok) {
      if (res.status === 401) {
        clearToken()
        const cfg = await ensureAuthConfig()
        if (cfg.required || isAuthEnabled()) {
          redirectToPortalLogin(`${window.location.origin}/auth/callback`)
        }
      }
      throw new ApiError(res.statusText || 'Ошибка выгрузки', res.status)
    }
    return res.blob()
  },

  downloadBackupDatabase: async (): Promise<Blob> => {
    const headers = new Headers()
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const res = await fetch(`${API_BASE}/api/backup/database`, { headers })
    if (!res.ok) {
      if (res.status === 401) {
        clearToken()
        const cfg = await ensureAuthConfig()
        if (cfg.required || isAuthEnabled()) {
          redirectToPortalLogin(`${window.location.origin}/auth/callback`)
        }
      }
      throw new ApiError(res.statusText || 'Ошибка выгрузки', res.status)
    }
    return res.blob()
  },

  importBackupJson: (payload: unknown) =>
    fetchApi('/api/backup/json', { method: 'POST', body: JSON.stringify(payload) }),

  importBackupDatabase: async (buffer: ArrayBuffer) => {
    const headers = new Headers({ 'Content-Type': 'application/octet-stream' })
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const res = await fetch(`${API_BASE}/api/backup/database`, {
      method: 'POST',
      headers,
      body: buffer,
    })
    if (!res.ok) {
      if (res.status === 401) {
        clearToken()
        const cfg = await ensureAuthConfig()
        if (cfg.required || isAuthEnabled()) {
          redirectToPortalLogin(`${window.location.origin}/auth/callback`)
        }
      }
      throw new ApiError(res.statusText || 'Ошибка восстановления', res.status)
    }
    return res.json()
  },

  fetchDashboardStats: () =>
    fetchApi<import('@/queries/dashboard').DashboardStats>('/api/dashboard/stats'),

  fetchProjects: () => fetchApi<{ id: string; name: string }[]>('/api/projects'),

  createProject: (payload: { name: string; color?: string | null; notes?: string | null }) =>
    fetchApi<import('@/types/entities').ServerProject>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProject: (id: string, patch: { name?: string; color?: string | null; notes?: string | null }) =>
    fetchApi<{ id: string; name: string }>(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  deleteProject: (id: string) =>
    fetchApi<void>(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  fetchAuditLog: (limit = 100) =>
    fetchApi<Array<{
      id: string
      entity: string
      entityId: string
      action: string
      diff: Record<string, unknown> | null
      createdAt: string
    }>>(`/api/audit?limit=${limit}`),
}

export type {
  DataSnapshot,
  RatesData,
  Settings,
  Vps,
  Provider,
  ProviderAccount,
  Payment,
  BalanceLedgerRow,
}
