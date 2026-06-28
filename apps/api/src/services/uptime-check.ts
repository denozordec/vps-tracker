import { randomUUID } from 'node:crypto'
import { createConnection } from 'node:net'
import { desc, eq } from 'drizzle-orm'
import { getDb, schema } from '@cfdm/db'

const CHECK_TIMEOUT_MS = 5000

export interface VpsHealthTransition {
  id: string
  label: string
  previousStatus: string | null
  currentStatus: 'up' | 'down'
}

export interface UptimeCheckResult {
  checked: number
  down: number
  newlyDown: VpsHealthTransition[]
  newlyUp: VpsHealthTransition[]
}

function tcpCheck(host: string, port: number): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now()
  return new Promise((resolve) => {
    const socket = createConnection({ host, port, timeout: CHECK_TIMEOUT_MS })
    const done = (ok: boolean, error?: string) => {
      socket.destroy()
      resolve({ ok, latencyMs: Date.now() - started, error })
    }
    socket.on('connect', () => done(true))
    socket.on('timeout', () => done(false, 'timeout'))
    socket.on('error', (err) => done(false, err.message))
  })
}

export async function runVpsUptimeChecks(): Promise<UptimeCheckResult> {
  const db = getDb()
  const rows = db
    .select()
    .from(schema.vps)
    .where(eq(schema.vps.monitoringEnabled, 1))
    .all()

  let checked = 0
  let down = 0
  const newlyDown: VpsHealthTransition[] = []
  const newlyUp: VpsHealthTransition[] = []
  const now = new Date().toISOString()

  for (const row of rows) {
    if (row.status !== 'active') continue
    const host = (row.ip || '').trim()
    if (!host) continue
    const port = Number(row.sshPort) || 22
    const result = await tcpCheck(host, port)
    checked++
    const status: 'up' | 'down' = result.ok ? 'up' : 'down'
    if (status === 'down') down++

    const previous = row.lastHealthStatus
    const label = row.dns || row.ip || row.id
    if (status === 'down' && previous !== 'down') {
      newlyDown.push({ id: row.id, label, previousStatus: previous, currentStatus: 'down' })
    } else if (status === 'up' && previous === 'down') {
      newlyUp.push({ id: row.id, label, previousStatus: previous, currentStatus: 'up' })
    }

    db.insert(schema.vpsHealthChecks)
      .values({
        id: `hc-${randomUUID()}`,
        vpsId: row.id,
        checkedAt: now,
        status,
        latencyMs: result.latencyMs,
        error: result.error ?? null,
      })
      .run()

    db.update(schema.vps)
      .set({
        lastHealthStatus: status,
        lastHealthCheckedAt: now,
      })
      .where(eq(schema.vps.id, row.id))
      .run()
  }

  return { checked, down, newlyDown, newlyUp }
}

export function listRecentHealthChecks(vpsId: string, limit = 20) {
  return getDb()
    .select()
    .from(schema.vpsHealthChecks)
    .where(eq(schema.vpsHealthChecks.vpsId, vpsId))
    .orderBy(desc(schema.vpsHealthChecks.checkedAt))
    .limit(limit)
    .all()
}
