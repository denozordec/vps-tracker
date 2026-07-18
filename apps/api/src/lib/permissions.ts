/**
 * Portal JWT RBAC helpers (mirrors @authportal/shared hasPermission).
 * Format: vps:<section>:<read|write|admin>
 */

export type AuthUser = {
  id: string
  email: string
  name: string
  apps: string[]
  permissions: string[]
  isAdmin?: boolean
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

type Rule = {
  methods: string[]
  match: (path: string) => boolean
  permission: string
}

const RULES: Rule[] = [
  {
    methods: ['GET'],
    match: (p) => p.startsWith('/api/dashboard'),
    permission: 'vps:dashboard:read',
  },
  {
    methods: ['GET'],
    match: (p) =>
      p === '/api/vps' ||
      p.startsWith('/api/vps/') ||
      p.startsWith('/api/projects') ||
      p.startsWith('/api/data'),
    permission: 'vps:vps:read',
  },
  {
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    match: (p) =>
      p.startsWith('/api/vps') || p.startsWith('/api/projects'),
    permission: 'vps:vps:write',
  },
  {
    methods: ['GET'],
    match: (p) =>
      p.startsWith('/api/providers') ||
      p.startsWith('/api/provider-accounts'),
    permission: 'vps:accounts:read',
  },
  {
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    match: (p) =>
      p.startsWith('/api/providers') ||
      p.startsWith('/api/provider-accounts'),
    permission: 'vps:accounts:write',
  },
  {
    methods: ['GET'],
    match: (p) =>
      p.startsWith('/api/payments') ||
      p.startsWith('/api/balance-ledger') ||
      p.startsWith('/api/rates'),
    permission: 'vps:payments:read',
  },
  {
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    match: (p) =>
      p.startsWith('/api/payments') ||
      p.startsWith('/api/balance-ledger'),
    permission: 'vps:payments:write',
  },
  {
    methods: ['GET', 'POST'],
    match: (p) => p.startsWith('/api/sync'),
    permission: 'vps:sync:write',
  },
  {
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    match: (p) => p.startsWith('/api/spaces'),
    permission: 'vps:dashboard:read',
  },
  {
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    match: (p) =>
      p.startsWith('/api/settings') ||
      p.startsWith('/api/backup') ||
      p.startsWith('/api/audit') ||
      p.startsWith('/api/migrate') ||
      p.startsWith('/api/notifications') ||
      p.startsWith('/api/app-switcher'),
    permission: 'vps:settings:admin',
  },
]

/** Resolve required permission for method+path, or null if public / unknown. */
export function permissionForRequest(
  method: string,
  path: string,
): string | null {
  const m = method.toUpperCase()
  const pathname = path.split('?')[0] ?? path
  for (const rule of RULES) {
    if (!rule.methods.includes(m)) continue
    if (rule.match(pathname)) return rule.permission
  }
  // Default: any authenticated vps user for unmatched /api/*
  if (pathname.startsWith('/api/')) return 'vps:dashboard:read'
  return null
}
