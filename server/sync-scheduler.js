import { getDb } from './db.js'
import { syncFromBillmanager } from './adapters/billmanager/index.js'

let syncIntervalId = null
let syncTariffsIntervalId = null

export function runScheduledSync() {
  try {
    const db = getDb()
    const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('settings-main')
    if (!settings?.syncEnabled) return
    const accounts = db.prepare(`
      SELECT * FROM provider_accounts
      WHERE apiType = 'billmanager' AND apiBaseUrl IS NOT NULL AND apiBaseUrl != '' AND apiCredentials IS NOT NULL AND apiCredentials != ''
    `).all()
    for (const account of accounts) {
      syncFromBillmanager(account, db, { skipTariffs: true }).catch((err) => {
        console.warn(`Sync VPS/payments failed for account ${account.id}:`, err.message)
      })
    }
  } catch (err) {
    console.warn('Scheduled sync error:', err.message)
  }
}

export function runScheduledSyncTariffs() {
  try {
    const db = getDb()
    const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('settings-main')
    if (!settings?.syncEnabled) return
    const accounts = db.prepare(`
      SELECT * FROM provider_accounts
      WHERE apiType = 'billmanager' AND apiBaseUrl IS NOT NULL AND apiBaseUrl != '' AND apiCredentials IS NOT NULL AND apiCredentials != ''
    `).all()
    for (const account of accounts) {
      syncFromBillmanager(account, db, { skipVpsPayments: true }).catch((err) => {
        console.warn(`Sync tariffs failed for account ${account.id}:`, err.message)
      })
    }
  } catch (err) {
    console.warn('Scheduled sync tariffs error:', err.message)
  }
}

export function startScheduler() {
  if (syncIntervalId) clearInterval(syncIntervalId)
  syncIntervalId = null
  if (syncTariffsIntervalId) clearInterval(syncTariffsIntervalId)
  syncTariffsIntervalId = null
  try {
    const db = getDb()
    const settings = db.prepare('SELECT * FROM settings WHERE id = ?').get('settings-main')
    if (!settings?.syncEnabled) return
    const interval = Math.max(15, Number(settings.syncIntervalMinutes) || 60)
    const tariffsInterval = Math.max(60, Number(settings.syncTariffsIntervalMinutes) || 1440)
    syncIntervalId = setInterval(runScheduledSync, interval * 60 * 1000)
    syncTariffsIntervalId = setInterval(runScheduledSyncTariffs, tariffsInterval * 60 * 1000)
    console.log(`Scheduled sync enabled: VPS/payments every ${interval} min, tariffs every ${tariffsInterval} min`)
  } catch {
    // ignore
  }
}
