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
