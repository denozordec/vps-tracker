/** Portal JWT storage + claims helpers for VPS Tracker UI. */

const TOKEN_KEY = 'vps_auth_token'
const HANDOFF_KEY = 'vps_auth_401_handoff'
const HANDOFF_AT_KEY = 'vps_portal_handoff_at'
/** Min gap between portal handoffs — breaks SSO↔401 redirect storms. */
const HANDOFF_COOLDOWN_MS = 12_000
const API_BASE = import.meta.env.VITE_API_URL ?? ''

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

export type RuntimeAuthConfig = {
  required: boolean
  portalUrl: string
}

let runtimeConfig: RuntimeAuthConfig | null = null
let runtimeConfigPromise: Promise<RuntimeAuthConfig> | null = null

function viteAuthEnabled(): boolean {
  return (
    import.meta.env.VITE_AUTH_ENABLED === 'true' ||
    import.meta.env.VITE_AUTH_ENABLED === '1'
  )
}

function vitePortalUrl(): string {
  return (import.meta.env.VITE_AUTH_PORTAL_URL ?? 'http://localhost:5175').replace(
    /\/$/,
    '',
  )
}

/** Load auth mode from API (Docker-friendly). Falls back to VITE_* flags. */
export async function ensureAuthConfig(): Promise<RuntimeAuthConfig> {
  if (runtimeConfig) return runtimeConfig
  if (runtimeConfigPromise) return runtimeConfigPromise

  runtimeConfigPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/config`)
      if (res.ok) {
        const data = (await res.json()) as {
          required?: boolean
          portal_url?: string
        }
        runtimeConfig = {
          required: Boolean(data.required) || viteAuthEnabled(),
          portalUrl: (data.portal_url || vitePortalUrl()).replace(/\/$/, ''),
        }
        return runtimeConfig
      }
    } catch {
      /* ignore — use vite defaults */
    }
    runtimeConfig = {
      required: viteAuthEnabled(),
      portalUrl: vitePortalUrl(),
    }
    return runtimeConfig
  })().finally(() => {
    runtimeConfigPromise = null
  })

  return runtimeConfigPromise
}

export function getAuthConfigSync(): RuntimeAuthConfig | null {
  return runtimeConfig
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
  if (runtimeConfig) return runtimeConfig.required
  return viteAuthEnabled()
}

export function authPortalUrl(): string {
  if (runtimeConfig?.portalUrl) return runtimeConfig.portalUrl
  return vitePortalUrl()
}

/** True when another portal handoff happened too recently (SSO loop guard). */
export function isPortalHandoffCoolingDown(): boolean {
  const raw = sessionStorage.getItem(HANDOFF_AT_KEY)
  if (!raw) return false
  const at = Number(raw)
  if (!Number.isFinite(at)) return false
  return Date.now() - at < HANDOFF_COOLDOWN_MS
}

export function markPortalHandoff(): void {
  sessionStorage.setItem(HANDOFF_KEY, '1')
  sessionStorage.setItem(HANDOFF_AT_KEY, String(Date.now()))
}

export function clearPortalHandoffFlag(): void {
  sessionStorage.removeItem(HANDOFF_KEY)
}

/** Clear cooldown too — use on intentional logout so next login is allowed. */
export function resetPortalHandoff(): void {
  sessionStorage.removeItem(HANDOFF_KEY)
  sessionStorage.removeItem(HANDOFF_AT_KEY)
}

export function hasPortalHandoffFlag(): boolean {
  return sessionStorage.getItem(HANDOFF_KEY) === '1'
}

/**
 * Redirect to auth-portal SSO. Returns false if cooldown blocks the handoff
 * (clears local token) — prevents infinite SSO when API rejects JWT.
 */
export function redirectToPortalLogin(returnTo?: string): boolean {
  if (isPortalHandoffCoolingDown()) {
    clearToken()
    return false
  }
  markPortalHandoff()
  const callback =
    returnTo ?? `${window.location.origin}/auth/callback`
  const url = new URL(authPortalUrl())
  url.searchParams.set('return_to', callback)
  window.location.assign(url.toString())
  return true
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
  if (
    pathname.startsWith('/settings') ||
    pathname.startsWith('/audit') ||
    pathname.startsWith('/spaces')
  ) {
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
