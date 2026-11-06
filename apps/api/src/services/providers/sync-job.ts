import { eq } from 'drizzle-orm'
import { getDb, schema, getCurrentSpaceId } from '@cfdm/db'

import type { ProviderAdapter, SyncResult } from './types.js'

export interface RunAccountSyncResult extends SyncResult {
  ok: true
  logId: string
}

/** Manual and scheduled syncs of one account must not interleave (duplicate inserts, tariff wipe). */
const inFlightAccounts = new Set<string>()

export class SyncInProgressError extends Error {
  constructor() {
    super('Синхронизация этого аккаунта уже выполняется')
  }
}

export async function runAccountSync(
  adapter: ProviderAdapter,
  account: unknown,
  opts: { skipTariffs?: boolean; skipVpsPayments?: boolean } = {},
): Promise<RunAccountSyncResult> {
  const accountRow = account as { id: string; spaceId?: string }
  if (inFlightAccounts.has(accountRow.id)) throw new SyncInProgressError()
  inFlightAccounts.add(accountRow.id)
  try {
    return await runAccountSyncLocked(adapter, account, accountRow, opts)
  } finally {
    inFlightAccounts.delete(accountRow.id)
  }
}

async function runAccountSyncLocked(
  adapter: ProviderAdapter,
  account: unknown,
  accountRow: { id: string; spaceId?: string },
  opts: { skipTariffs?: boolean; skipVpsPayments?: boolean },
): Promise<RunAccountSyncResult> {
  const db = getDb()
  const logId = `sync-${accountRow.id}-${Date.now()}`
  const spaceId = accountRow.spaceId ?? getCurrentSpaceId()

  db.insert(schema.syncLog)
    .values({
      id: logId,
      spaceId,
      accountId: accountRow.id,
      startedAt: new Date().toISOString(),
      status: 'running',
    })
    .run()

  try {
    const result = await adapter.syncAccount(account, opts)
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
