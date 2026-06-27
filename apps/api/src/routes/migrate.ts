import type { FastifyPluginAsync } from 'fastify'
import { consolidateAllProviderApiSources, getSqlite } from '@cfdm/db'

export const migrateRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/migrate', async (req, reply) => {
    const data = req.body
    if (!data || typeof data !== 'object') {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Invalid payload' } })
    }

    const payload = data as Record<string, unknown>
    const sqlite = getSqlite()

    try {
      if (Array.isArray(payload.providers) && payload.providers.length > 0) {
        const stmt = sqlite.prepare(
          `INSERT OR REPLACE INTO providers (id, name, website, contact, baseCurrency, usdRate, eurRate, notes, apiType, apiBaseUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        for (const raw of payload.providers) {
          const p = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
          stmt.run(
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
      }

      if (Array.isArray(payload.providerAccounts) && payload.providerAccounts.length > 0) {
        const stmt = sqlite.prepare(
          `INSERT OR REPLACE INTO provider_accounts (id, providerId, name, panelUrl, currency, billingMode, notes, apiType, apiBaseUrl, apiCredentials) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        for (const raw of payload.providerAccounts) {
          const acc = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
          stmt.run(
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
          )
        }
      }

      if (Array.isArray(payload.vps) && payload.vps.length > 0) {
        const sql = `INSERT OR REPLACE INTO vps (id, ip, ipv6, additionalIps, dns, providerId, providerAccountId, country, city, datacenter, os, vcpu, ramGb, diskGb, diskType, virtualization, bandwidthTb, sshPort, rootUser, purpose, environment, project, projectId, monitoringEnabled, backupEnabled, status, tariffType, currency, dailyRate, monthlyRate, createdAt, paidUntil, notes, userOverrides) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        const stmt = sqlite.prepare(sql)
        for (const raw of payload.vps) {
          const v = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
          const additionalIps = Array.isArray(v.additionalIps) ? JSON.stringify(v.additionalIps) : '[]'
          const dailyRate = v.dailyRate === '' || v.dailyRate == null ? null : Number(v.dailyRate)
          const monthlyRate = v.monthlyRate === '' || v.monthlyRate == null ? null : Number(v.monthlyRate)
          const userOverrides = Array.isArray(v.userOverrides)
            ? JSON.stringify(v.userOverrides)
            : String(v.userOverrides ?? '[]')
          stmt.run(
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
      }

      if (Array.isArray(payload.payments) && payload.payments.length > 0) {
        const stmt = sqlite.prepare(
          `INSERT OR REPLACE INTO payments (id, type, date, amount, currency, providerAccountId, vpsId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        for (const raw of payload.payments) {
          const pm = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
          stmt.run(
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
      }

      if (Array.isArray(payload.balanceLedger) && payload.balanceLedger.length > 0) {
        const stmt = sqlite.prepare(
          `INSERT OR REPLACE INTO balance_ledger (id, type, date, amount, currency, direction, providerAccountId, vpsId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        for (const raw of payload.balanceLedger) {
          const bl = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
          stmt.run(
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
      }

      const settingsList = Array.isArray(payload.settings)
        ? payload.settings
        : payload.settings
          ? [payload.settings]
          : []
      if (settingsList.length > 0) {
        const stmt = sqlite.prepare(
          `INSERT OR REPLACE INTO settings (id, baseCurrency, ratesUrl, autoConvert, ratesUpdatedAt, syncEnabled, syncIntervalMinutes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        for (const raw of settingsList) {
          const s = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
          stmt.run(
            s.id ?? 'settings-main',
            s.baseCurrency ?? 'RUB',
            s.ratesUrl ?? '',
            s.autoConvert !== false ? 1 : 0,
            s.ratesUpdatedAt ?? '',
            s.syncEnabled ? 1 : 0,
            s.syncIntervalMinutes ?? 60,
          )
        }
      }

      consolidateAllProviderApiSources(sqlite)
      return { ok: true }
    } catch (err) {
      req.log.error(err)
      const message = err instanceof Error ? err.message : 'Migration failed'
      return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message } })
    }
  })
}
