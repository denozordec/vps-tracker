import { Router } from 'express'
import { getDb, saveDb } from '../db.js'

const router = Router()

router.post('/', (req, res) => {
  try {
    const db = getDb()
    const data = req.body
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    const settingsList = Array.isArray(data.settings) ? data.settings : (data.settings ? [data.settings] : [])

    if (Array.isArray(data.providers) && data.providers.length > 0) {
      const sql = `INSERT OR REPLACE INTO providers (id, name, website, contact, baseCurrency, usdRate, eurRate, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      for (const r of data.providers) {
        const p = typeof r === 'object' ? r : {}
        db.run(sql, p.id ?? '', p.name ?? '', p.website ?? '', p.contact ?? '', p.baseCurrency ?? '', p.usdRate ?? '', p.eurRate ?? '', p.notes ?? '')
      }
    }
    if (Array.isArray(data.providerAccounts) && data.providerAccounts.length > 0) {
      const sql = `INSERT OR REPLACE INTO provider_accounts (id, providerId, name, panelUrl, currency, billingMode, notes, apiType, apiBaseUrl, apiCredentials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      for (const r of data.providerAccounts) {
        const acc = typeof r === 'object' ? r : {}
        db.run(sql, acc.id ?? '', acc.providerId ?? '', acc.name ?? '', acc.panelUrl ?? '', acc.currency ?? '', acc.billingMode ?? '', acc.notes ?? '', acc.apiType ?? '', acc.apiBaseUrl ?? '', acc.apiCredentials ?? '')
      }
    }
    if (Array.isArray(data.vps) && data.vps.length > 0) {
      const sql = `INSERT OR REPLACE INTO vps (id, ip, ipv6, additionalIps, dns, providerId, providerAccountId, country, city, datacenter, os, vcpu, ramGb, diskGb, diskType, virtualization, bandwidthTb, sshPort, rootUser, purpose, environment, project, projectId, monitoringEnabled, backupEnabled, status, tariffType, currency, dailyRate, monthlyRate, createdAt, paidUntil, notes, userOverrides) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      for (const r of data.vps) {
        const v = typeof r === 'object' ? r : {}
        const additionalIps = Array.isArray(v.additionalIps) ? JSON.stringify(v.additionalIps) : '[]'
        const dailyRate = v.dailyRate === '' || v.dailyRate == null ? null : Number(v.dailyRate)
        const monthlyRate = v.monthlyRate === '' || v.monthlyRate == null ? null : Number(v.monthlyRate)
        const userOverrides = Array.isArray(v.userOverrides) ? JSON.stringify(v.userOverrides) : (v.userOverrides ?? '[]')
        db.run(sql, v.id ?? '', v.ip ?? '', v.ipv6 ?? '', additionalIps, v.dns ?? '', v.providerId ?? '', v.providerAccountId ?? '', v.country ?? '', v.city ?? '', v.datacenter ?? '', v.os ?? '', v.vcpu ?? 0, v.ramGb ?? 0, v.diskGb ?? 0, v.diskType ?? '', v.virtualization ?? '', v.bandwidthTb ?? 0, v.sshPort ?? 22, v.rootUser ?? '', v.purpose ?? '', v.environment ?? '', v.project ?? '', v.projectId ?? null, v.monitoringEnabled ? 1 : 0, v.backupEnabled ? 1 : 0, v.status ?? 'active', v.tariffType ?? '', v.currency ?? '', dailyRate, monthlyRate, v.createdAt ?? '', v.paidUntil ?? '', v.notes ?? '', userOverrides)
      }
    }
    if (Array.isArray(data.payments) && data.payments.length > 0) {
      const sql = `INSERT OR REPLACE INTO payments (id, type, date, amount, currency, providerAccountId, vpsId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      for (const r of data.payments) {
        const pm = typeof r === 'object' ? r : {}
        db.run(sql, pm.id ?? '', pm.type ?? '', pm.date ?? '', Number(pm.amount) || 0, pm.currency ?? '', pm.providerAccountId ?? '', pm.vpsId ?? '', pm.note ?? '')
      }
    }
    if (Array.isArray(data.balanceLedger) && data.balanceLedger.length > 0) {
      const sql = `INSERT OR REPLACE INTO balance_ledger (id, type, date, amount, currency, direction, providerAccountId, vpsId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      for (const r of data.balanceLedger) {
        const bl = typeof r === 'object' ? r : {}
        db.run(sql, bl.id ?? '', bl.type ?? '', bl.date ?? '', Number(bl.amount) || 0, bl.currency ?? '', bl.direction ?? '', bl.providerAccountId ?? '', bl.vpsId ?? '', bl.note ?? '')
      }
    }
    if (settingsList.length > 0) {
      const sql = `INSERT OR REPLACE INTO settings (id, baseCurrency, ratesUrl, autoConvert, ratesUpdatedAt, syncEnabled, syncIntervalMinutes) VALUES (?, ?, ?, ?, ?, ?, ?)`
      for (const r of settingsList) {
        const s = typeof r === 'object' ? r : {}
        db.run(sql, s.id ?? 'settings-main', s.baseCurrency ?? 'RUB', s.ratesUrl ?? '', s.autoConvert !== false ? 1 : 0, s.ratesUpdatedAt ?? '', s.syncEnabled ? 1 : 0, s.syncIntervalMinutes ?? 60)
      }
    }
    saveDb()

    res.json({ ok: true })
  } catch (err) {
    console.error('Migrate error:', err)
    res.status(500).json({ error: err.message || 'Migration failed' })
  }
})

export default router
