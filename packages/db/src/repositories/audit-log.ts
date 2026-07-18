import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../index.js'
import { getCurrentSpaceId } from '../space-context.js'

export interface AuditEntryInput {
  entity: string
  entityId: string
  action: 'create' | 'update' | 'delete'
  diff?: Record<string, unknown>
  actorUserId?: string | null
}

function parseDiff(row: { diff: string | null }) {
  if (!row.diff) return null
  try {
    return JSON.parse(row.diff) as Record<string, unknown>
  } catch {
    return null
  }
}

export const auditLogRepository = {
  append(input: AuditEntryInput): void {
    getDb()
      .insert(schema.auditLog)
      .values({
        id: `audit-${randomUUID()}`,
        spaceId: getCurrentSpaceId(),
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        diff: input.diff ? JSON.stringify(input.diff) : null,
        actorUserId: input.actorUserId ?? null,
        createdAt: new Date().toISOString(),
      })
      .run()
  },

  list(limit = 100) {
    const spaceId = getCurrentSpaceId()
    return getDb()
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.spaceId, spaceId))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(Math.min(500, Math.max(1, limit)))
      .all()
      .map((row) => ({ ...row, diff: parseDiff(row) }))
  },

  listForEntity(entity: string, entityId: string, limit = 50) {
    const spaceId = getCurrentSpaceId()
    return getDb()
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.spaceId, spaceId),
          eq(schema.auditLog.entity, entity),
          eq(schema.auditLog.entityId, entityId),
        ),
      )
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(limit)
      .all()
      .map((row) => ({ ...row, diff: parseDiff(row) }))
  },
}
