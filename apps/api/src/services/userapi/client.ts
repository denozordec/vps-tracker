/**
 * Macloud / VDSina UserAPI HTTP client (OpenAPI v1.2.3.1)
 */

export interface UserApiEnvelope<T = unknown> {
  status: string
  status_msg: string
  data: T | null
  description?: string
}

export class UserApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserApiError'
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export interface UserApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  query?: Record<string, string | number | undefined>
  body?: Record<string, unknown>
}

export async function userApiRequest<T = unknown>(
  baseUrl: string,
  token: string,
  path: string,
  opts: UserApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', query, body } = opts
  const url = new URL(joinUrl(baseUrl, path))
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/json',
    },
  }

  if (body && method !== 'GET') {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }

  const res = await fetch(url.toString(), init)
  const json = (await res.json()) as UserApiEnvelope<T>

  if (!res.ok) {
    throw new UserApiError(json.status_msg || json.description || `HTTP ${res.status}`)
  }
  if (json.status !== 'ok') {
    throw new UserApiError(json.status_msg || json.description || 'UserAPI error')
  }

  return json.data as T
}
