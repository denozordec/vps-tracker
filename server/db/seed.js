/**
 * Seed database with initial data from public/data/*.json
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * @param {string} path - path to JSON file
 * @returns {Array}
 */
function loadJson(path) {
  if (!existsSync(path)) return []
  const raw = readFileSync(path, 'utf-8')
  try {
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : [data]
  } catch {
    return []
  }
}

/**
 * @param {object} db - raw sql.js database (not wrapper)
 * @param {string} seedDir - path to public/data
 */
export function seed(db, seedDir) {
  const providers = loadJson(join(seedDir, 'providers.json'))
  if (providers.length === 0) return

  const run = db.run.bind(db)
  for (const r of providers) {
    run(
      'INSERT OR IGNORE INTO providers (id, name, website, contact, baseCurrency, usdRate, eurRate, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.name ?? '', r.website ?? '', r.contact ?? '', r.baseCurrency ?? '', r.usdRate ?? '', r.eurRate ?? '', r.notes ?? ''],
    )
  }

  const providerAccounts = loadJson(join(seedDir, 'provider-accounts.json'))
  for (const r of providerAccounts) {
    run(
      'INSERT OR IGNORE INTO provider_accounts (id, providerId, name, panelUrl, currency, billingMode, notes, apiType, apiBaseUrl, apiCredentials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.providerId ?? '', r.name ?? '', r.panelUrl ?? '', r.currency ?? '', r.billingMode ?? '', r.notes ?? '', r.apiType ?? '', r.apiBaseUrl ?? '', r.apiCredentials ?? ''],
    )
  }

  const vpsList = loadJson(join(seedDir, 'vps.json'))
  for (const r of vpsList) {
    const additionalIps = Array.isArray(r.additionalIps) ? JSON.stringify(r.additionalIps) : '[]'
    const dailyRate = r.dailyRate === '' || r.dailyRate == null ? null : Number(r.dailyRate)
    const monthlyRate = r.monthlyRate === '' || r.monthlyRate == null ? null : Number(r.monthlyRate)
    run(
      `INSERT OR IGNORE INTO vps (id, ip, ipv6, additionalIps, dns, providerId, providerAccountId, country, city, datacenter, os, vcpu, ramGb, diskGb, diskType, virtualization, bandwidthTb, sshPort, rootUser, purpose, environment, project, projectId, monitoringEnabled, backupEnabled, status, tariffType, currency, dailyRate, monthlyRate, createdAt, paidUntil, notes, userOverrides) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.ip ?? '',
        r.ipv6 ?? '',
        additionalIps,
        r.dns ?? '',
        r.providerId ?? '',
        r.providerAccountId ?? '',
        r.country ?? '',
        r.city ?? '',
        r.datacenter ?? '',
        r.os ?? '',
        r.vcpu ?? 0,
        r.ramGb ?? 0,
        r.diskGb ?? 0,
        r.diskType ?? '',
        r.virtualization ?? '',
        r.bandwidthTb ?? 0,
        r.sshPort ?? 22,
        r.rootUser ?? '',
        r.purpose ?? '',
        r.environment ?? '',
        r.project ?? '',
        r.projectId ?? null,
        r.monitoringEnabled ? 1 : 0,
        r.backupEnabled ? 1 : 0,
        r.status ?? 'active',
        r.tariffType ?? '',
        r.currency ?? '',
        dailyRate,
        monthlyRate,
        r.createdAt ?? '',
        r.paidUntil ?? '',
        r.notes ?? '',
        '[]',
      ],
    )
  }

  const payments = loadJson(join(seedDir, 'payments.json'))
  for (const r of payments) {
    run(
      'INSERT OR IGNORE INTO payments (id, type, date, amount, currency, providerAccountId, vpsId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.type ?? '', r.date ?? '', Number(r.amount) || 0, r.currency ?? '', r.providerAccountId ?? '', r.vpsId ?? '', r.note ?? ''],
    )
  }

  const ledger = loadJson(join(seedDir, 'balance-ledger.json'))
  for (const r of ledger) {
    run(
      'INSERT OR IGNORE INTO balance_ledger (id, type, date, amount, currency, direction, providerAccountId, vpsId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [r.id, r.type ?? '', r.date ?? '', Number(r.amount) || 0, r.currency ?? '', r.direction ?? '', r.providerAccountId ?? '', r.vpsId ?? '', r.note ?? ''],
    )
  }

  const settingsList = loadJson(join(seedDir, 'settings.json'))
  for (const r of settingsList) {
    run(
      'INSERT OR IGNORE INTO settings (id, baseCurrency, ratesUrl, autoConvert, ratesUpdatedAt, syncEnabled, syncIntervalMinutes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [r.id ?? 'settings-main', r.baseCurrency ?? 'RUB', r.ratesUrl ?? '', r.autoConvert !== false ? 1 : 0, r.ratesUpdatedAt ?? '', r.syncEnabled ? 1 : 0, r.syncIntervalMinutes ?? 60],
    )
  }
}

/**
 * @param {object} db - raw sql.js database
 * @returns {boolean}
 */
export function isDbEmpty(db) {
  const result = db.exec('SELECT COUNT(*) as c FROM providers')
  if (!result.length || !result[0].values.length) return true
  return result[0].values[0][0] === 0
}
