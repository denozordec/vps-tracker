import { Router } from 'express'
import express from 'express'
import { readFileSync, existsSync } from 'node:fs'
import { getDb, saveDb, DB_PATH, reloadDatabaseFromBuffer } from '../db.js'
import { consolidateAllProviderApiSources } from '../db/migrations.js'
import { rowToVps } from './vps.js'
import { rowToActiveTariff, rowToTariffSyncOptions } from '../utils/row-mappers.js'

const router = Router()
const BACKUP_VERSION = 1

function buildJsonSnapshot() {
  saveDb()
  const db = getDb()
  const vps = db.prepare('SELECT * FROM vps ORDER BY createdAt DESC').all()
  const providers = db.prepare('SELECT * FROM providers ORDER BY name').all()
  const providerAccounts = db.prepare('SELECT * FROM provider_accounts ORDER BY name').all()
  const payments = db.prepare('SELECT * FROM payments ORDER BY date DESC').all()
  const balanceLedger = db.prepare('SELECT * FROM balance_ledger ORDER BY date DESC').all()
  const settingsRows = db.prepare('SELECT * FROM settings ORDER BY id').all()
  const activeTariffs = db.prepare('SELECT * FROM active_tariffs ORDER BY name').all()
  const tariffSyncOptions = db.prepare('SELECT * FROM tariff_sync_options').all()
  let serverProjects = []
  try {
    serverProjects = db
      .prepare('SELECT id, name, color, sortOrder, notes, createdAt FROM server_projects ORDER BY name')
      .all()
  } catch {
    serverProjects = []
  }
  let syncLog = []
  try {
    syncLog = db.prepare('SELECT * FROM sync_log ORDER BY startedAt DESC LIMIT 500').all()
  } catch {
    syncLog = []
  }

  return {
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    vps: vps.map(rowToVps),
    serverProjects,
    providers,
    providerAccounts,
    payments,
    balanceLedger,
    settings: settingsRows,
    activeTariffs: activeTariffs.map(rowToActiveTariff),
    tariffSyncOptions: tariffSyncOptions.map(rowToTariffSyncOptions),
    syncLog,
  }
}

router.get('/json', (req, res) => {
  try {
    const snapshot = buildJsonSnapshot()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="vps-tracker-backup.json"')
    res.send(JSON.stringify(snapshot, null, 2))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/database', (req, res) => {
  try {
    saveDb()
    if (!existsSync(DB_PATH)) {
      return res.status(404).json({ error: 'Файл базы не найден' })
    }
    const buf = readFileSync(DB_PATH)
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader('Content-Disposition', 'attachment; filename="vps-tracker.db"')
    res.send(buf)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/json', (req, res) => {
  try {
    const payload = req.body
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Неверное тело запроса' })
    }
    importJsonSnapshot(payload)
    res.json({ ok: true })
  } catch (err) {
    console.error('Backup JSON import error:', err)
    res.status(500).json({ error: err.message || 'Импорт не удался' })
  }
})

/**
 * @param {object} data
 */
function importJsonSnapshot(data) {
  const db = getDb()
  const run = (sql, ...params) => db.prepare(sql).run(...params)

  run('DELETE FROM sync_log')
  run('DELETE FROM tariff_sync_options')
  run('DELETE FROM active_tariffs')
  run('DELETE FROM balance_ledger')
  run('DELETE FROM payments')
  run('DELETE FROM vps')
  run('DELETE FROM provider_accounts')
  run('DELETE FROM server_projects')
  run('DELETE FROM providers')
  run('DELETE FROM settings')

  const providers = Array.isArray(data.providers) ? data.providers : []
  for (const p of providers) {
    run(
      `INSERT OR REPLACE INTO providers (id, name, website, contact, baseCurrency, usdRate, eurRate, notes, apiType, apiBaseUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      p.id ?? '',
      p.name ?? '',
      p.website ?? '',
      p.contact ?? '',
      p.baseCurrency ?? '',
      p.usdRate ?? '',
      p.eurRate ?? '',
      p.notes ?? '',
      p.apiType ?? '',
      p.apiBaseUrl ?? '',
    )
  }

  const projects = Array.isArray(data.serverProjects) ? data.serverProjects : []
  for (const sp of projects) {
    run(
      `INSERT OR REPLACE INTO server_projects (id, name, color, sortOrder, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      sp.id ?? '',
      sp.name ?? '',
      sp.color ?? null,
      sp.sortOrder ?? 0,
      sp.notes ?? null,
      sp.createdAt ?? null,
    )
  }

  const accounts = Array.isArray(data.providerAccounts) ? data.providerAccounts : []
  for (const acc of accounts) {
    run(
      `INSERT OR REPLACE INTO provider_accounts (id, providerId, name, panelUrl, currency, billingMode, notes, apiType, apiBaseUrl, apiCredentials, balance_api, balance_currency, balance_updated_at, enoughmoneyto, balance_alert_below)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      acc.id ?? '',
      acc.providerId ?? '',
      acc.name ?? '',
      acc.panelUrl ?? '',
      acc.currency ?? '',
      acc.billingMode ?? '',
      acc.notes ?? '',
      acc.apiType ?? '',
      acc.apiBaseUrl ?? '',
      acc.apiCredentials ?? '',
      acc.balance_api ?? null,
      acc.balance_currency ?? null,
      acc.balance_updated_at ?? null,
      acc.enoughmoneyto ?? null,
      acc.balance_alert_below != null && acc.balance_alert_below !== '' ? Number(acc.balance_alert_below) : null,
    )
  }

  consolidateAllProviderApiSources(db)

  const settingsList = Array.isArray(data.settings) ? data.settings : data.settings ? [data.settings] : []
  for (const s of settingsList) {
    let customFields = s.customFields
    if (Array.isArray(customFields)) customFields = JSON.stringify(customFields)
    if (customFields === undefined) customFields = null
    run(
      `INSERT OR REPLACE INTO settings (id, baseCurrency, ratesUrl, autoConvert, ratesUpdatedAt, syncEnabled, syncIntervalMinutes, syncTariffsIntervalMinutes, telegramBotToken, telegramChatId, telegramMessageThreadId, notifyPaymentExpiryEnabled, notifyNewTariffsEnabled, customFields, notifyLowBalanceEnabled, notifySyncDigestEnabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s.id ?? 'settings-main',
      s.baseCurrency ?? 'RUB',
      s.ratesUrl ?? '',
      s.autoConvert !== false && s.autoConvert !== 0 ? 1 : 0,
      s.ratesUpdatedAt ?? '',
      s.syncEnabled ? 1 : 0,
      s.syncIntervalMinutes ?? 60,
      s.syncTariffsIntervalMinutes ?? 1440,
      s.telegramBotToken ?? '',
      s.telegramChatId ?? '',
      s.telegramMessageThreadId ?? '',
      s.notifyPaymentExpiryEnabled ? 1 : 0,
      s.notifyNewTariffsEnabled ? 1 : 0,
      customFields,
      s.notifyLowBalanceEnabled ? 1 : 0,
      s.notifySyncDigestEnabled ? 1 : 0,
    )
  }

  const vpsRows = Array.isArray(data.vps) ? data.vps : []
  const vpsSql = `INSERT OR REPLACE INTO vps (id, ip, ipv6, additionalIps, dns, providerId, providerAccountId, country, city, datacenter, os, vcpu, ramGb, diskGb, diskType, virtualization, bandwidthTb, sshPort, rootUser, purpose, environment, project, projectId, monitoringEnabled, backupEnabled, status, tariffType, currency, dailyRate, monthlyRate, createdAt, paidUntil, notes, userOverrides)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  for (const v of vpsRows) {
    const additionalIps = Array.isArray(v.additionalIps) ? JSON.stringify(v.additionalIps) : '[]'
    const dailyRate = v.dailyRate === '' || v.dailyRate == null ? null : Number(v.dailyRate)
    const monthlyRate = v.monthlyRate === '' || v.monthlyRate == null ? null : Number(v.monthlyRate)
    const userOverrides = Array.isArray(v.userOverrides) ? JSON.stringify(v.userOverrides) : (v.userOverrides ?? '[]')
    run(
      vpsSql,
      v.id ?? '',
      v.ip ?? '',
      v.ipv6 ?? '',
      additionalIps,
      v.dns ?? '',
      v.providerId ?? '',
      v.providerAccountId ?? '',
      v.country ?? '',
      v.city ?? '',
      v.datacenter ?? '',
      v.os ?? '',
      v.vcpu ?? 0,
      v.ramGb ?? 0,
      v.diskGb ?? 0,
      v.diskType ?? '',
      v.virtualization ?? '',
      v.bandwidthTb ?? 0,
      v.sshPort ?? 22,
      v.rootUser ?? '',
      v.purpose ?? '',
      v.environment ?? '',
      v.project ?? '',
      v.projectId ?? null,
      v.monitoringEnabled ? 1 : 0,
      v.backupEnabled ? 1 : 0,
      v.status ?? 'active',
      v.tariffType ?? '',
      v.currency ?? '',
      dailyRate,
      monthlyRate,
      v.createdAt ?? '',
      v.paidUntil ?? '',
      v.notes ?? '',
      userOverrides,
    )
  }

  const payments = Array.isArray(data.payments) ? data.payments : []
  for (const pm of payments) {
    run(
      `INSERT OR REPLACE INTO payments (id, type, date, amount, currency, providerAccountId, vpsId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      pm.id ?? '',
      pm.type ?? '',
      pm.date ?? '',
      Number(pm.amount) || 0,
      pm.currency ?? '',
      pm.providerAccountId ?? '',
      pm.vpsId ?? '',
      pm.note ?? '',
    )
  }

  const ledger = Array.isArray(data.balanceLedger) ? data.balanceLedger : []
  for (const bl of ledger) {
    run(
      `INSERT OR REPLACE INTO balance_ledger (id, type, date, amount, currency, direction, providerAccountId, vpsId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      bl.id ?? '',
      bl.type ?? '',
      bl.date ?? '',
      Number(bl.amount) || 0,
      bl.currency ?? '',
      bl.direction ?? '',
      bl.providerAccountId ?? '',
      bl.vpsId ?? '',
      bl.note ?? '',
    )
  }

  const tariffs = Array.isArray(data.activeTariffs) ? data.activeTariffs : []
  for (const t of tariffs) {
    run(
      `INSERT OR REPLACE INTO active_tariffs (id, providerAccountId, providerId, externalId, datacenterKey, datacenterName, name, desc, vcpu, ramGb, diskGb, diskType, virtualization, channel, location, country, cpuModel, orderAvailable, price, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      t.id ?? '',
      t.providerAccountId ?? '',
      t.providerId ?? '',
      t.externalId ?? '',
      t.datacenterKey ?? '',
      t.datacenterName ?? '',
      t.name ?? '',
      t.desc ?? '',
      t.vcpu ?? 0,
      t.ramGb ?? 0,
      t.diskGb ?? 0,
      t.diskType ?? '',
      t.virtualization ?? '',
      t.channel ?? '',
      t.location ?? '',
      t.country ?? '',
      t.cpuModel ?? '',
      t.orderAvailable ? 1 : 0,
      t.price ?? '',
      t.syncedAt ?? '',
    )
  }

  const tso = Array.isArray(data.tariffSyncOptions) ? data.tariffSyncOptions : []
  for (const o of tso) {
    const dcs = typeof o.datacenters === 'string' ? o.datacenters : JSON.stringify(o.datacenters || [])
    const pers = typeof o.periods === 'string' ? o.periods : JSON.stringify(o.periods || [])
    run(
      `INSERT OR REPLACE INTO tariff_sync_options (providerAccountId, datacenters, periods, syncedAt) VALUES (?, ?, ?, ?)`,
      o.providerAccountId ?? '',
      dcs,
      pers,
      o.syncedAt ?? '',
    )
  }

  const logs = Array.isArray(data.syncLog) ? data.syncLog : []
  for (const log of logs) {
    run(
      `INSERT OR REPLACE INTO sync_log (id, accountId, startedAt, finishedAt, status, vpsCount, paymentsCount, error, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      log.id ?? '',
      log.accountId ?? '',
      log.startedAt ?? '',
      log.finishedAt ?? null,
      log.status ?? '',
      log.vpsCount ?? null,
      log.paymentsCount ?? null,
      log.error ?? null,
      typeof log.summary === 'string' ? log.summary : log.summary ? JSON.stringify(log.summary) : null,
    )
  }

  saveDb()
}

router.post('/database', express.raw({ limit: '100mb', type: '*/*' }), async (req, res) => {
  try {
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || [])
    if (!buf.length) {
      return res.status(400).json({ error: 'Пустой файл' })
    }
    await reloadDatabaseFromBuffer(buf)
    const { startScheduler } = await import('../sync-scheduler.js')
    startScheduler()
    res.json({ ok: true })
  } catch (err) {
    console.error('Backup DB restore error:', err)
    res.status(500).json({ error: err.message || 'Восстановление не удалось' })
  }
})

export default router
