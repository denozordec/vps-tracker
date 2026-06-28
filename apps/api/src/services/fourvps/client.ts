/**
 * 4VPS.SU REST API HTTP client
 * @see https://4vps.su/page/api
 */

export interface FourVpsResponse<T = unknown> {
  error: boolean
  errorMessage?: string | Record<string, unknown>
  data: T
}

export class FourVpsApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FourVpsApiError'
  }
}

function formatErrorMessage(errorMessage: FourVpsResponse['errorMessage']): string {
  if (!errorMessage) return '4VPS API error'
  if (typeof errorMessage === 'string') return errorMessage
  const msg = errorMessage.message
  if (typeof msg === 'string') return msg
  return JSON.stringify(errorMessage)
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export interface FourVpsRequestOptions {
  method?: 'GET' | 'POST'
  panelId?: number | null
  body?: Record<string, string | number>
}

export async function fourvpsRequest<T = unknown>(
  baseUrl: string,
  apiKey: string,
  path: string,
  opts: FourVpsRequestOptions = {},
): Promise<T> {
  const { method = 'GET', panelId, body } = opts
  const url = new URL(joinUrl(baseUrl, path))
  if (panelId != null) {
    url.searchParams.set('panel_id', String(panelId))
  }

  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      Accept: 'application/json',
    },
  }

  if (method === 'POST') {
    const payload: Record<string, string | number> = { ...(body ?? {}) }
    if (panelId != null && payload.panel_id == null) {
      payload.panel_id = panelId
    }
    init.headers = { ...init.headers, 'Content-Type': 'application/json' }
    init.body = JSON.stringify(payload)
  }

  const res = await fetch(url.toString(), init)
  if (!res.ok) {
    throw new FourVpsApiError(`4VPS API HTTP ${res.status}: ${res.statusText}`)
  }

  const json = (await res.json()) as FourVpsResponse<T>
  if (json.error) {
    throw new FourVpsApiError(formatErrorMessage(json.errorMessage))
  }
  return json.data
}
