import { and, eq, like, or } from 'drizzle-orm'
import { getDb, schema } from '@cfdm/db'

type VpsRow = typeof schema.vps.$inferSelect

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Existing VPS of a synced account: deterministic id → exact note token (bm-1 ≠ bm-12) → non-empty IP.
 */
export function findSyncedVps(
  accountId: string,
  id: string,
  tokens: string[],
  ip?: string | null,
): VpsRow | undefined {
  const rows = getDb()
    .select()
    .from(schema.vps)
    .where(
      and(
        eq(schema.vps.providerAccountId, accountId),
        or(
          eq(schema.vps.id, id),
          ...(ip ? [eq(schema.vps.ip, ip)] : []),
          ...tokens.map((t) => like(schema.vps.notes, `%${t}%`)),
        ),
      ),
    )
    .all()
  const byId = rows.find((r) => r.id === id)
  if (byId) return byId
  for (const t of tokens) {
    const re = new RegExp(`(^|[^\\w-])${escapeRe(t)}(?![\\w-])`)
    const hit = rows.find((r) => re.test(r.notes ?? ''))
    if (hit) return hit
  }
  return ip ? rows.find((r) => r.ip === ip) : undefined
}
