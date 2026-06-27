/**
 * Запуск синхронизации BILLmanager с записью в sync_log
 */

import { eq } from 'drizzle-orm'
import { getDb, schema } from '@cfdm/db'

import type { BillmanagerSyncAccount } from './context.js'
import { syncFromBillmanager, type SyncFromBillmanagerOptions, type SyncFromBillmanagerResult } from './sync.js'

export interface RunBillmanagerAccountSyncResult extends SyncFromBillmanagerResult {
  ok: true
  logId: string
}

export async function runBillmanagerAccountSync(
  account: BillmanagerSyncAccount,
  opts: SyncFromBillmanagerOptions = {},
): Promise<RunBillmanagerAccountSyncResult> {
  const db = getDb()
  const logId = `sync-${account.id}-${Date.now()}`

  db.insert(schema.syncLog)
    .values({
      id: logId,
      accountId: account.id,
      startedAt: new Date().toISOString(),
      status: 'running',
    })
    .run()

  try {
    const result = await syncFromBillmanager(account, opts)
    const summaryPayload = {
      ...(result.syncSummary || {}),
      vpsCount: result.vpsCount,
      paymentsCount: result.paymentsCount,
      tariffsCount: result.tariffsCount ?? 0,
    }
    db.update(schema.syncLog)
      .set({
        finishedAt: new Date().toISOString(),
        status: 'ok',
        vpsCount: result.vpsCount,
        paymentsCount: result.paymentsCount,
        summary: JSON.stringify(summaryPayload),
      })
      .where(eq(schema.syncLog.id, logId))
      .run()
    return { ok: true, logId, ...result }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    db.update(schema.syncLog)
      .set({
        finishedAt: new Date().toISOString(),
        status: 'error',
        error: message,
        summary: JSON.stringify({ error: message }),
      })
      .where(eq(schema.syncLog.id, logId))
      .run()
    throw err
  }
}
