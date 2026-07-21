export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  vps: 'VPS',
  payment: 'Платёж',
  providerAccount: 'Аккаунт',
  provider: 'Хостер',
  settings: 'Настройки',
  balanceLedger: 'Баланс',
  serverProject: 'Проект',
}

export const ACTION_LABELS: Record<string, string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
}

export type AuditAction = 'create' | 'update' | 'delete' | string

export type AuditActionBadgeVariant =
  | 'success-light'
  | 'info-light'
  | 'destructive-light'
  | 'outline'

export function auditEntityLabel(entity: string): string {
  return AUDIT_ENTITY_LABELS[entity] ?? entity
}

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

export function auditActionBadgeVariant(action: string): AuditActionBadgeVariant {
  if (action === 'create') return 'success-light'
  if (action === 'update') return 'info-light'
  if (action === 'delete') return 'destructive-light'
  return 'outline'
}

export function formatDiffValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string') return value || '—'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function diffFieldEntries(diff: Record<string, unknown> | null | undefined) {
  if (!diff) return []
  return Object.entries(diff)
}

export function diffPreview(diff: Record<string, unknown> | null | undefined, maxKeys = 3): string {
  const entries = diffFieldEntries(diff)
  if (entries.length === 0) return '—'
  const head = entries
    .slice(0, maxKeys)
    .map(([key, value]) => `${key}: ${formatDiffValue(value)}`)
    .join(', ')
  const rest = entries.length - maxKeys
  return rest > 0 ? `${head} (+${rest})` : head
}

export type AuditEntityLookup = {
  vps?: Map<string, { dns?: string | null; ip?: string | null }>
  provider?: Map<string, { name?: string | null }>
  providerAccount?: Map<string, { name?: string | null }>
  serverProject?: Map<string, { name?: string | null }>
}

function strFromDiff(diff: Record<string, unknown> | null | undefined, key: string): string {
  const v = diff?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

/** Человекочитаемое имя сущности: dns/ip для VPS, name для хостера/аккаунта/проекта. */
export function auditEntityTitle(
  entity: string,
  entityId: string,
  diff?: Record<string, unknown> | null,
  lookup?: AuditEntityLookup,
): string {
  if (entity === 'vps') {
    const row = lookup?.vps?.get(entityId)
    const fromSnap = (row?.dns || row?.ip || '').trim()
    if (fromSnap) return fromSnap
    const fromDiff = strFromDiff(diff, 'dns') || strFromDiff(diff, 'ip')
    if (fromDiff) return fromDiff
  }
  if (entity === 'provider') {
    const name = (lookup?.provider?.get(entityId)?.name || strFromDiff(diff, 'name')).trim()
    if (name) return name
  }
  if (entity === 'providerAccount') {
    const name = (lookup?.providerAccount?.get(entityId)?.name || strFromDiff(diff, 'name')).trim()
    if (name) return name
  }
  if (entity === 'serverProject') {
    const name = (lookup?.serverProject?.get(entityId)?.name || strFromDiff(diff, 'name')).trim()
    if (name) return name
  }
  return entityId
}
