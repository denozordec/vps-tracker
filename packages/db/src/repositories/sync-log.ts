import { desc } from 'drizzle-orm'
import { getDb, schema } from '../index.js'

export interface SyncLogDto {
  id: string
  accountId: string
  status: 'ok' | 'error' | 'running' | string | null
  startedAt: string
  finishedAt: string | null
  vpsCount: number | null
  paymentsCount: number | null
  error: string | null
  summary: Record<string, unknown> | null
}

function toDto(row: typeof schema.syncLog.$inferSelect): SyncLogDto {
  let summary: Record<string, unknown> | null = null
  if (row.summary) {
    try {
      const parsed = JSON.parse(row.summary) as unknown
      summary = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    } catch {
      summary = null
    }
  }
  return {
    id: row.id,
    accountId: row.accountId,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    vpsCount: row.vpsCount,
    paymentsCount: row.paymentsCount,
    error: row.error,
    summary,
  }
}

export const syncLogRepository = {
  listRecent(limit = 50): SyncLogDto[] {
    const rows = getDb()
      .select()
      .from(schema.syncLog)
      .orderBy(desc(schema.syncLog.startedAt))
      .limit(limit)
      .all()
    return rows.map(toDto)
  },
}
