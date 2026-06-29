/**
 * RuVDS API v2 HTTP client
 * @see https://ruvds.com/api-docs
 */

import type { RuvdsApiErrorBody } from './types.js'

export class RuvdsApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuvdsApiError'
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export interface RuvdsRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  query?: Record<string, string | number | boolean | undefined>
  body?: Record<string, unknown>
}

function extractErrorMessage(json: unknown, status: number): string {
  if (json && typeof json === 'object') {
    const obj = json as RuvdsApiErrorBody
    if (typeof obj.message === 'string' && obj.message.trim()) return obj.message
    if (typeof obj.id === 'string' && obj.id.trim()) return obj.id
  }
  return `RuVDS API HTTP ${status}`
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export class RuvdsClient {
  constructor(
    readonly baseUrl: string,
    readonly token: string,
  ) {}

  async request<T = unknown>(path: string, opts: RuvdsRequestOptions = {}): Promise<T> {
    const { method = 'GET', query, body } = opts
    const url = new URL(joinUrl(this.baseUrl, path))
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value != null && value !== '') {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.token.trim()}`,
    }
    if (body && method !== 'GET') {
      headers['Content-Type'] = 'application/json'
    }

    const init: RequestInit = { method, headers }
    if (body && method !== 'GET') {
      init.body = JSON.stringify(body)
    }

    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(500 * attempt)

      const res = await fetch(url.toString(), init)

      let json: unknown
      try {
        json = await res.json()
      } catch {
        if (!res.ok) throw new RuvdsApiError(`RuVDS API HTTP ${res.status}`)
        return undefined as T
      }

      if (res.status === 429 && attempt < 2) {
        lastError = new RuvdsApiError('Превышен лимит запросов RuVDS API')
        continue
      }

      if (!res.ok) {
        throw new RuvdsApiError(extractErrorMessage(json, res.status))
      }

      return json as T
    }

    throw lastError ?? new RuvdsApiError('RuVDS API request failed')
  }
}

export function createRuvdsClient(baseUrl: string, token: string): RuvdsClient {
  const trimmed = token.trim()
  if (!trimmed) throw new RuvdsApiError('Укажите API-токен RuVDS')
  return new RuvdsClient(baseUrl.trim(), trimmed)
}
