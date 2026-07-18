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
import {
  clearToken,
  ensureAuthConfig,
  getToken,
  hasPortalHandoffFlag,
  isAuthEnabled,
  isPortalHandoffCoolingDown,
  redirectToPortalLogin,
} from '@/lib/auth'
import { getStoredSpaceId } from '@/lib/space'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function handoffOnUnauthorized(): Promise<void> {
  clearToken()
  const cfg = await ensureAuthConfig()
  if (
    (cfg.required || isAuthEnabled()) &&
    !hasPortalHandoffFlag() &&
    !isPortalHandoffCoolingDown()
  ) {
    redirectToPortalLogin(`${window.location.origin}/auth/callback`)
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
  const spaceId = getStoredSpaceId()
  if (spaceId && !headers.has('X-Space-Id')) {
    headers.set('X-Space-Id', spaceId)
  }
  const res = await fetch(url, {
    ...options,
    headers,
  })
  if (!res.ok) {
    if (res.status === 401) {
      await handoffOnUnauthorized()
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
    const spaceId = getStoredSpaceId()
    if (spaceId) headers.set('X-Space-Id', spaceId)
    const res = await fetch(`${API_BASE}/api/backup/json`, { headers })
    if (!res.ok) {
      if (res.status === 401) {
        await handoffOnUnauthorized()
      }
      throw new ApiError(res.statusText || 'Ошибка выгрузки', res.status)
    }
    return res.blob()
  },

  downloadBackupDatabase: async (): Promise<Blob> => {
    const headers = new Headers()
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const spaceId = getStoredSpaceId()
    if (spaceId) headers.set('X-Space-Id', spaceId)
    const res = await fetch(`${API_BASE}/api/backup/database`, { headers })
    if (!res.ok) {
      if (res.status === 401) {
        await handoffOnUnauthorized()
      }
      throw new ApiError(res.statusText || 'Ошибка выгрузки', res.status)
    }
    return res.blob()
  },

  fetchSpaces: () => fetchApi<import('@/lib/space').SpaceDto[]>('/api/spaces'),

  createSpace: (body: { name: string; slug?: string }) =>
    fetchApi<import('@/lib/space').SpaceDto>('/api/spaces', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  fetchSpaceMembers: (spaceId: string) =>
    fetchApi<{ spaceId: string; userId: string; role: string; createdAt: string }[]>(
      `/api/spaces/${encodeURIComponent(spaceId)}/members`,
    ),

  addSpaceMember: (spaceId: string, body: { userId: string; role?: string }) =>
    fetchApi(`/api/spaces/${encodeURIComponent(spaceId)}/members`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateSpaceMember: (spaceId: string, userId: string, role: string) =>
    fetchApi(`/api/spaces/${encodeURIComponent(spaceId)}/members/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  removeSpaceMember: (spaceId: string, userId: string) =>
    fetchApi(`/api/spaces/${encodeURIComponent(spaceId)}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),

  shareVps: (
    fromSpaceId: string,
    vpsId: string,
    body: { toSpaceId: string; permission: 'read' | 'write' },
  ) =>
    fetchApi(`/api/spaces/${encodeURIComponent(fromSpaceId)}/vps/${encodeURIComponent(vpsId)}/share`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  assignVps: (fromSpaceId: string, vpsId: string, toSpaceId: string) =>
    fetchApi(
      `/api/spaces/${encodeURIComponent(fromSpaceId)}/vps/${encodeURIComponent(vpsId)}/assign`,
      {
        method: 'POST',
        body: JSON.stringify({ toSpaceId }),
      },
    ),

  fetchSpaceGrants: (spaceId: string) =>
    fetchApi<{
      incoming: unknown[]
      outgoing: unknown[]
    }>(`/api/spaces/${encodeURIComponent(spaceId)}/vps-grants`),

  importBackupJson: (payload: unknown) =>
    fetchApi('/api/backup/json', { method: 'POST', body: JSON.stringify(payload) }),

  importBackupDatabase: async (buffer: ArrayBuffer) => {
    const headers = new Headers({ 'Content-Type': 'application/octet-stream' })
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const spaceId = getStoredSpaceId()
    if (spaceId) headers.set('X-Space-Id', spaceId)
    const res = await fetch(`${API_BASE}/api/backup/database`, {
      method: 'POST',
      headers,
      body: buffer,
    })
    if (!res.ok) {
      if (res.status === 401) {
        await handoffOnUnauthorized()
      }
      let message = res.statusText || 'Ошибка восстановления'
      if (res.status === 413) {
        message =
          'Файл слишком большой для импорта (лимит тела запроса). Увеличьте BACKUP_BODY_LIMIT_BYTES на API или используйте копирование data/*.db на сервере.'
      } else {
        try {
          const data = (await res.json()) as {
            error?: string | { message?: string }
            message?: string
          }
          if (typeof data?.error === 'string') message = data.error
          else if (data?.error && typeof data.error === 'object' && data.error.message) {
            message = data.error.message
          } else if (typeof data?.message === 'string') message = data.message
        } catch {
          /* ignore */
        }
      }
      throw new ApiError(message, res.status)
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

  fetchTopologyList: () =>
    fetchApi<import('@cfdm/shared/contracts/topology').TopologyDiagramListItem[]>('/api/topology'),

  fetchTopology: (id: string) =>
    fetchApi<import('@cfdm/shared/contracts/topology').TopologyDiagram>(
      `/api/topology/${encodeURIComponent(id)}`,
    ),

  createTopology: (payload: import('@cfdm/shared/contracts/topology').TopologyCreateInput) =>
    fetchApi<import('@cfdm/shared/contracts/topology').TopologyDiagram>('/api/topology', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTopology: (
    id: string,
    payload: import('@cfdm/shared/contracts/topology').TopologyUpdateInput,
  ) =>
    fetchApi<import('@cfdm/shared/contracts/topology').TopologyDiagram>(
      `/api/topology/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),

  deleteTopology: (id: string) =>
    fetchApi<void>(`/api/topology/${encodeURIComponent(id)}`, { method: 'DELETE' }),

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
