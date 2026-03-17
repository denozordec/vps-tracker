/**
 * Sync BILLmanager data into vps-tracker DB
 */

import { fetchVds, fetchPayments, fetchDashboardInfo, fetchVdsOrderPricelistAllDatacenters } from './operations.js'
import { mapVdsToVps, mapPaymentToPayment } from './mappers.js'

/**
 * Sync BILLmanager data into vps-tracker DB
 * @param {object} account - provider_account with apiBaseUrl, apiCredentials
 * @param {object} db - getDb() wrapper
 * @param {object} [opts] - { paymentDaysBack }
 * @returns {{ vpsCount: number, paymentsCount: number, tariffsCount: number, balance?: object }}
 */
export async function syncFromBillmanager(account, db, _opts = {}) {
  const { apiBaseUrl, apiCredentials, providerId, id: accountId } = account
  if (!apiBaseUrl?.trim() || !apiCredentials?.trim()) {
    throw new Error('API URL and credentials are required')
  }
  const authinfo = apiCredentials.trim()

  const [vdsItems, paymentItems, dashboardInfo, tariffResult] = await Promise.all([
    fetchVds(apiBaseUrl, authinfo),
    fetchPayments(apiBaseUrl, authinfo, {}),
    fetchDashboardInfo(apiBaseUrl, authinfo, { fallbackCurrency: account.currency }).catch(() => null),
    fetchVdsOrderPricelistAllDatacenters(apiBaseUrl, authinfo).catch((err) => {
      console.warn('fetchVdsOrderPricelistAllDatacenters failed:', err.message)
      return { tariffItems: [], slist: {} }
    }),
  ])
  const { tariffItems = [], slist = {} } = tariffResult || {}

  let vpsCount = 0
  const vpsInsertSql = `INSERT INTO vps (id, ip, ipv6, additionalIps, dns, providerId, providerAccountId, country, city, datacenter, os, vcpu, ramGb, diskGb, diskType, virtualization, bandwidthTb, sshPort, rootUser, purpose, environment, project, monitoringEnabled, backupEnabled, status, tariffType, currency, dailyRate, monthlyRate, createdAt, paidUntil, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  const vpsUpdateSql = `UPDATE vps SET ip=?, ipv6=?, additionalIps=?, dns=?, country=?, city=?, datacenter=?, os=?, status=?, tariffType=?, currency=?, dailyRate=?, monthlyRate=?, paidUntil=?, notes=?
    WHERE id=?`

  const SYNC_UPDATE_FIELDS = ['country', 'city', 'datacenter', 'os', 'notes', 'status', 'tariffType', 'currency', 'dailyRate', 'monthlyRate', 'paidUntil']

  for (const item of vdsItems) {
    const vps = mapVdsToVps(item, providerId, accountId)
    const id = `vps-bm-${accountId}-${vps.externalId}`
    const additionalIps = JSON.stringify(vps.additionalIps || [])
    const dailyRate = vps.dailyRate
    const monthlyRate = vps.monthlyRate
    const paidUntil = vps.paidUntil || ''
    const notes = vps.notes ? `${vps.notes} [bm-${vps.externalId}]` : `bm-${vps.externalId}`

    const existing = db.prepare('SELECT * FROM vps WHERE providerAccountId = ? AND (ip = ? OR notes LIKE ?)').get(accountId, vps.ip, `%bm-${vps.externalId}%`)
    if (existing) {
      let userOverrides = []
      try {
        userOverrides = existing.userOverrides ? JSON.parse(existing.userOverrides) : []
      } catch {
        userOverrides = []
      }
      const merged = {
        ip: vps.ip,
        ipv6: vps.ipv6,
        additionalIps,
        dns: vps.dns,
        country: vps.country,
        city: vps.city,
        datacenter: vps.datacenter,
        os: vps.os,
        status: vps.status,
        tariffType: vps.tariffType,
        currency: vps.currency,
        dailyRate,
        monthlyRate,
        paidUntil,
        notes,
      }
      for (const f of SYNC_UPDATE_FIELDS) {
        if (userOverrides.includes(f)) {
          merged[f] = existing[f]
        }
      }
      db.run(vpsUpdateSql,
        merged.ip,
        merged.ipv6,
        merged.additionalIps,
        merged.dns,
        merged.country,
        merged.city,
        merged.datacenter,
        merged.os,
        merged.status,
        merged.tariffType,
        merged.currency,
        merged.dailyRate,
        merged.monthlyRate,
        merged.paidUntil,
        merged.notes,
        existing.id,
      )
    } else {
      db.run(vpsInsertSql,
        id,
        vps.ip,
        vps.ipv6,
        additionalIps,
        vps.dns,
        vps.providerId,
        vps.providerAccountId,
        vps.country,
        vps.city,
        vps.datacenter,
        vps.os,
        vps.vcpu,
        vps.ramGb,
        vps.diskGb,
        vps.diskType,
        vps.virtualization,
        vps.bandwidthTb,
        vps.sshPort,
        vps.rootUser,
        vps.purpose,
        vps.environment,
        vps.project,
        vps.monitoringEnabled ? 1 : 0,
        vps.backupEnabled ? 1 : 0,
        vps.status,
        vps.tariffType,
        vps.currency,
        dailyRate,
        monthlyRate,
        vps.createdAt,
        paidUntil,
        notes,
      )
    }
    vpsCount++
  }

  let paymentsCount = 0
  const existingPayments = new Set(
    db.prepare('SELECT note FROM payments WHERE providerAccountId = ?').all(accountId).map((r) => r.note),
  )
  const paymentInsertSql = `INSERT INTO payments (id, type, date, amount, currency, providerAccountId, vpsId, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

  for (const item of paymentItems) {
    const payment = mapPaymentToPayment(item, accountId)
    if (!payment || payment.amount <= 0) continue
    const note = payment.note
    if (existingPayments.has(note)) continue
    const id = `pay-bm-${accountId}-${payment.externalId}`
    db.run(paymentInsertSql, id, payment.type, payment.date, payment.amount, payment.currency, payment.providerAccountId, payment.vpsId, note)
    existingPayments.add(note)
    paymentsCount++
  }

  if (dashboardInfo) {
    db.run(
      'UPDATE provider_accounts SET balance_api=?, balance_currency=?, balance_updated_at=?, enoughmoneyto=? WHERE id=?',
      dashboardInfo.balance,
      dashboardInfo.currency || 'RUB',
      new Date().toISOString(),
      dashboardInfo.enoughmoneyto || '',
      accountId,
    )
  }

  let tariffsCount = 0
  const syncedAt = new Date().toISOString()
  db.run('DELETE FROM active_tariffs WHERE providerAccountId = ?', accountId)
  const tariffInsertSql = `INSERT INTO active_tariffs (id, providerAccountId, providerId, externalId, datacenterKey, datacenterName, name, desc, vcpu, ramGb, diskGb, diskType, virtualization, channel, location, country, cpuModel, orderAvailable, price, syncedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

  for (const t of tariffItems) {
    const dcKey = t.datacenterKey ?? ''
    const dcName = t.datacenterName ?? ''
    const id = dcKey ? `tariff-bm-${accountId}-${t.externalId}-${dcKey}` : `tariff-bm-${accountId}-${t.externalId}`
    db.run(tariffInsertSql,
      id,
      accountId,
      providerId,
      t.externalId,
      dcKey,
      dcName,
      t.name || '',
      t.desc || '',
      t.vcpu || 0,
      t.ramGb || 0,
      t.diskGb || 0,
      t.diskType || 'SSD',
      t.virtualization || 'KVM',
      t.channel || '',
      t.location || '',
      t.country || '',
      t.cpuModel || '',
      t.orderAvailable ? 1 : 0,
      t.price || '',
      syncedAt,
    )
    tariffsCount++
  }

  if (Object.keys(slist).length > 0) {
    const datacenters = Array.isArray(slist.datacenter) ? JSON.stringify(slist.datacenter) : '[]'
    const periods = Array.isArray(slist.period) ? JSON.stringify(slist.period) : '[]'
    db.run(
      `INSERT OR REPLACE INTO tariff_sync_options (providerAccountId, datacenters, periods, syncedAt) VALUES (?, ?, ?, ?)`,
      accountId,
      datacenters,
      periods,
      syncedAt,
    )
  }

  return { vpsCount, paymentsCount, tariffsCount, balance: dashboardInfo }
}
