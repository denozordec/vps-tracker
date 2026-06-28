import { auditLogRepository } from '@cfdm/db/repositories/audit-log'

export function auditCreate(entity: string, entityId: string, data?: Record<string, unknown>): void {
  auditLogRepository.append({ entity, entityId, action: 'create', diff: data })
}

export function auditUpdate(entity: string, entityId: string, patch: Record<string, unknown>): void {
  auditLogRepository.append({ entity, entityId, action: 'update', diff: patch })
}

export function auditDelete(entity: string, entityId: string): void {
  auditLogRepository.append({ entity, entityId, action: 'delete' })
}
