/** Логин из BILLmanager-кредов формата `login:password`. */
export function parseApiLogin(credentials: string | null | undefined): string {
  const cred = String(credentials ?? '').trim()
  const idx = cred.indexOf(':')
  return idx > 0 ? cred.slice(0, idx) : ''
}

/** Собрать креды для API из отдельных полей формы. */
export function buildApiCredentials(login: string, password: string): string {
  const l = login.trim()
  const p = password
  if (!l && !p) return ''
  if (!l) return p
  return p ? `${l}:${p}` : ''
}

export interface FourVpsCredentials {
  panelId: number | null
  apiKey: string
}

/** Разбор 4VPS-кредов формата `panelId:apiKey` (panelId опционален). */
export function parseFourVpsCredentials(credentials: string | null | undefined): FourVpsCredentials {
  const cred = String(credentials ?? '').trim()
  if (!cred) return { panelId: null, apiKey: '' }
  const idx = cred.indexOf(':')
  if (idx <= 0) return { panelId: null, apiKey: cred }
  const panelPart = cred.slice(0, idx).trim()
  const apiKey = cred.slice(idx + 1)
  const panelId = panelPart ? Number.parseInt(panelPart, 10) : null
  return {
    panelId: panelId != null && Number.isFinite(panelId) ? panelId : null,
    apiKey,
  }
}

/** Bearer token для Macloud / VDSina UserAPI. */
export function parseUserApiToken(credentials: string | null | undefined): string {
  return String(credentials ?? '').trim()
}

/** Bearer token для RuVDS API v2. */
export function parseRuvdsToken(credentials: string | null | undefined): string {
  return String(credentials ?? '').trim()
}

/** Собрать 4VPS-креды: panelId + API key. */
export function buildFourVpsCredentials(panelId: string, apiKey: string): string {
  const pid = panelId.trim()
  const key = apiKey
  if (!pid && !key) return ''
  if (!pid) return key
  return key ? `${pid}:${key}` : pid
}
