import { randomUUID } from 'node:crypto'
import { desc, eq } from 'drizzle-orm'
import { getDb, schema } from '../index.js'

export type NotificationChannel = 'telegram' | 'webhook'
export type NotificationLogStatus = 'sent' | 'failed' | 'skipped'

export interface NotificationLogRow {
  id: string
  event: string
  channel: NotificationChannel
  status: NotificationLogStatus
  fingerprint: string | null
  message: string | null
  payload: Record<string, unknown> | null
  createdAt: string
}

function parsePayload(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function toLogDto(row: typeof schema.notificationLog.$inferSelect): NotificationLogRow {
  return {
    id: row.id,
    event: row.event,
    channel: row.channel as NotificationChannel,
    status: row.status as NotificationLogStatus,
    fingerprint: row.fingerprint,
    message: row.message,
    payload: parsePayload(row.payload),
    createdAt: row.createdAt,
  }
}

export const notificationRepository = {
  listRecent(limit = 50): NotificationLogRow[] {
    const rows = getDb()
      .select()
      .from(schema.notificationLog)
      .orderBy(desc(schema.notificationLog.createdAt))
      .limit(Math.min(200, Math.max(1, limit)))
      .all()
    return rows.map(toLogDto)
  },

  append(entry: {
    event: string
    channel: NotificationChannel
    status: NotificationLogStatus
    fingerprint?: string | null
    message?: string | null
    payload?: Record<string, unknown> | null
  }): void {
    getDb()
      .insert(schema.notificationLog)
      .values({
        id: `nlog-${randomUUID()}`,
        event: entry.event,
        channel: entry.channel,
        status: entry.status,
        fingerprint: entry.fingerprint ?? null,
        message: entry.message ?? null,
        payload: entry.payload ? JSON.stringify(entry.payload) : null,
        createdAt: new Date().toISOString(),
      })
      .run()
  },

  getState(key: string) {
    return getDb().select().from(schema.notificationState).where(eq(schema.notificationState.key, key)).get()
  },

  upsertState(key: string, patch: { lastFingerprint?: string; lastSentAt?: string; lastStatus?: string }) {
    const db = getDb()
    const existing = this.getState(key)
    const values = {
      key,
      lastFingerprint: patch.lastFingerprint ?? existing?.lastFingerprint ?? null,
      lastSentAt: patch.lastSentAt ?? existing?.lastSentAt ?? null,
      lastStatus: patch.lastStatus ?? existing?.lastStatus ?? null,
    }
    if (existing) {
      db.update(schema.notificationState).set(values).where(eq(schema.notificationState.key, key)).run()
    } else {
      db.insert(schema.notificationState).values(values).run()
    }
  },
}
