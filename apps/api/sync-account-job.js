/**
 * Запуск синхронизации BILLmanager с записью в sync_log (для API и планировщика)
 */

import { getDb } from './db.js'
import { syncFromBillmanager } from './adapters/billmanager/index.js'

/**
 * @param {object} account - строка provider_accounts
 * @param {object} [opts] - { skipTariffs, skipVpsPayments }
 * @returns {Promise<object>} результат syncFromBillmanager + ok, logId
 */
export async function runBillmanagerAccountSync(account, opts = {}) {
  const db = getDb()
  const logId = `sync-${account.id}-${Date.now()}`
  db.prepare(`
    INSERT INTO sync_log (id, accountId, startedAt, status)
    VALUES (?, ?, ?, ?)
  `).run(logId, account.id, new Date().toISOString(), 'running')

  try {
    const result = await syncFromBillmanager(account, db, opts)
    const summaryPayload = {
      ...(result.syncSummary || {}),
      vpsCount: result.vpsCount,
      paymentsCount: result.paymentsCount,
      tariffsCount: result.tariffsCount ?? 0,
    }
    db.prepare(`
      UPDATE sync_log SET finishedAt=?, status=?, vpsCount=?, paymentsCount=?, summary=?
      WHERE id=?
    `).run(
      new Date().toISOString(),
      'ok',
      result.vpsCount,
      result.paymentsCount,
      JSON.stringify(summaryPayload),
      logId,
    )
    return { ok: true, logId, ...result }
  } catch (err) {
    db.prepare(`
      UPDATE sync_log SET finishedAt=?, status=?, error=?, summary=?
      WHERE id=?
    `).run(
      new Date().toISOString(),
      'error',
      err.message || 'Unknown error',
      JSON.stringify({ error: err.message || 'Unknown error' }),
      logId,
    )
    throw err
  }
}
