/**
 * Veesp client area REST API HTTP client
 * @see https://secure.veesp.com/userapi
 */

export class VeespApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VeespApiError'
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export interface VeespCredentials {
  username: string
  password: string
}

export interface VeespLoginResponse {
  token?: string
  refresh?: string
}

export interface VeespRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: Record<string, unknown>
}

export function parseVeespCredentials(credentials: string): VeespCredentials {
  const cred = credentials.trim()
  const idx = cred.indexOf(':')
  if (idx <= 0) {
    throw new VeespApiError('Укажите учётные данные в формате email:password')
  }
  const username = cred.slice(0, idx).trim()
  const password = cred.slice(idx + 1)
  if (!username || !password) {
    throw new VeespApiError('Укажите email и пароль client area Veesp')
  }
  return { username, password }
}

function basicAuthHeader(creds: VeespCredentials): string {
  const encoded = Buffer.from(`${creds.username}:${creds.password}`).toString('base64')
  return `Basic ${encoded}`
}

function extractErrorMessage(json: unknown, status: number): string {
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>
    const msg = obj.message ?? obj.error ?? obj.description
    if (typeof msg === 'string' && msg.trim()) return msg
    if (obj.success === false && typeof obj.info === 'string') return obj.info
  }
  return `Veesp API HTTP ${status}`
}

export async function veespLogin(baseUrl: string, creds: VeespCredentials): Promise<string> {
  const url = joinUrl(baseUrl, '/login')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: creds.username, password: creds.password }),
  })
  const json = (await res.json()) as VeespLoginResponse & Record<string, unknown>
  if (!res.ok || !json.token) {
    throw new VeespApiError(extractErrorMessage(json, res.status) || 'Не удалось получить JWT token')
  }
  return String(json.token)
}

export class VeespClient {
  private token: string | null = null

  constructor(
    readonly baseUrl: string,
    readonly creds: VeespCredentials,
  ) {}

  async ensureToken(): Promise<string> {
    if (this.token) return this.token
    try {
      this.token = await veespLogin(this.baseUrl, this.creds)
      return this.token
    } catch {
      return ''
    }
  }

  async request<T = unknown>(path: string, opts: VeespRequestOptions = {}): Promise<T> {
    const { method = 'GET', body } = opts
    const url = joinUrl(this.baseUrl, path)
    const token = await this.ensureToken()

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: token ? `Bearer ${token}` : basicAuthHeader(this.creds),
    }
    if (body && method !== 'GET') {
      headers['Content-Type'] = 'application/json'
    }

    const init: RequestInit = { method, headers }
    if (body && method !== 'GET') {
      init.body = JSON.stringify(body)
    }

    let res = await fetch(url, init)

    if (res.status === 401 && token) {
      this.token = null
      const retryToken = await this.ensureToken()
      if (retryToken) {
        headers.Authorization = `Bearer ${retryToken}`
        res = await fetch(url, { ...init, headers })
      }
    }

    let json: unknown
    try {
      json = await res.json()
    } catch {
      if (!res.ok) throw new VeespApiError(`Veesp API HTTP ${res.status}`)
      return undefined as T
    }

    if (!res.ok) {
      throw new VeespApiError(extractErrorMessage(json, res.status))
    }

    if (json && typeof json === 'object') {
      const obj = json as Record<string, unknown>
      if (obj.success === false) {
        throw new VeespApiError(extractErrorMessage(json, res.status))
      }
    }

    return json as T
  }
}

export function createVeespClient(baseUrl: string, credentials: string): VeespClient {
  return new VeespClient(baseUrl.trim(), parseVeespCredentials(credentials))
}
