/** Portal JWT storage + claims helpers for VPS Tracker UI. */

const TOKEN_KEY = 'vps_auth_token'

export type AccessClaims = {
  sub: string
  email: string
  name: string
  apps: string[]
  permissions: string[]
  is_admin?: boolean
  iss?: string
  exp?: number
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthEnabled(): boolean {
  return (
    import.meta.env.VITE_AUTH_ENABLED === 'true' ||
    import.meta.env.VITE_AUTH_ENABLED === '1'
  )
}

export function authPortalUrl(): string {
  return (import.meta.env.VITE_AUTH_PORTAL_URL ?? 'http://localhost:5175').replace(
    /\/$/,
    '',
  )
}

export function redirectToPortalLogin(returnTo?: string) {
  const callback =
    returnTo ?? `${window.location.origin}/auth/callback`
  const url = new URL(authPortalUrl())
  url.searchParams.set('return_to', callback)
  window.location.href = url.toString()
}

export function parseHashToken(hash: string): {
  accessToken: string | null
  expiresAt: string | null
} {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  return {
    accessToken: params.get('access_token'),
    expiresAt: params.get('expires_at'),
  }
}

export function decodeClaims(token: string): AccessClaims | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const json = atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as Record<string, unknown>
    return {
      sub: String(payload.sub ?? ''),
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      apps: Array.isArray(payload.apps) ? payload.apps.map(String) : [],
      permissions: Array.isArray(payload.permissions)
        ? payload.permissions.map(String)
        : [],
      is_admin: Boolean(payload.is_admin),
      iss: payload.iss ? String(payload.iss) : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    }
  } catch {
    return null
  }
}

export function getClaims(): AccessClaims | null {
  const token = getToken()
  if (!token) return null
  const claims = decodeClaims(token)
  if (!claims) return null
  if (claims.exp && claims.exp * 1000 < Date.now()) {
    clearToken()
    return null
  }
  return claims
}

export function hasPermission(
  granted: readonly string[],
  required: string,
): boolean {
  if (granted.includes(required)) return true
  const parts = required.split(':')
  if (parts.length !== 3) return false
  const [app, section, action] = parts
  if (action === 'read') {
    return (
      granted.includes(`${app}:${section}:write`) ||
      granted.includes(`${app}:${section}:admin`)
    )
  }
  if (action === 'write') {
    return granted.includes(`${app}:${section}:admin`)
  }
  return false
}

export function can(required: string): boolean {
  if (!isAuthEnabled()) return true
  const claims = getClaims()
  if (!claims) return false
  if (!claims.apps.includes('vps')) return false
  return hasPermission(claims.permissions, required)
}

/** Nav path → minimum permission to show the item. */
export function permissionForPath(pathname: string): string | null {
  if (pathname.startsWith('/dashboard')) return 'vps:dashboard:read'
  if (
    pathname.startsWith('/vps') ||
    pathname.startsWith('/tariffs') ||
    pathname.startsWith('/projects') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/resources') ||
    pathname.startsWith('/renewals')
  ) {
    return 'vps:vps:read'
  }
  if (pathname.startsWith('/providers') || pathname.startsWith('/accounts')) {
    return 'vps:accounts:read'
  }
  if (pathname.startsWith('/payments') || pathname.startsWith('/balance')) {
    return 'vps:payments:read'
  }
  if (pathname.startsWith('/sync-journal')) return 'vps:sync:write'
  if (pathname.startsWith('/settings') || pathname.startsWith('/audit')) {
    return 'vps:settings:admin'
  }
  return 'vps:dashboard:read'
}

export function firstAllowedPath(): string {
  const candidates = [
    '/dashboard',
    '/vps',
    '/accounts',
    '/payments',
    '/sync-journal',
    '/settings',
  ]
  for (const path of candidates) {
    const perm = permissionForPath(path)
    if (!perm || can(perm)) return path
  }
  return '/dashboard'
}
