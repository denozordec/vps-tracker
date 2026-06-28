import { getDb, getSqlite, schema, consolidateAllProviderApiSources } from '@cfdm/db'

export interface BackupPayload {
  providers?: unknown[]
  serverProjects?: unknown[]
  providerAccounts?: unknown[]
  settings?: unknown[] | unknown
  vps?: unknown[]
  payments?: unknown[]
  balanceLedger?: unknown[]
  activeTariffs?: unknown[]
  tariffSyncOptions?: unknown[]
  syncLog?: unknown[]
}

function asObject(v: unknown): Record<string, unknown> {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
}

export function importJsonSnapshot(data: BackupPayload): void {
  const db = getDb()
  const sqlite = getSqlite()

  sqlite.exec('BEGIN')
  try {
    db.delete(schema.syncLog).run()
    db.delete(schema.tariffSyncOptions).run()
    db.delete(schema.activeTariffs).run()
    db.delete(schema.balanceLedger).run()
    db.delete(schema.payments).run()
    db.delete(schema.vps).run()
    db.delete(schema.providerAccounts).run()
    db.delete(schema.serverProjects).run()
    db.delete(schema.providers).run()
    db.delete(schema.settings).run()

    for (const raw of Array.isArray(data.providers) ? data.providers : []) {
      const p = asObject(raw)
      db.insert(schema.providers)
        .values({
          id: String(p.id ?? ''),
          name: String(p.name ?? ''),
          website: String(p.website ?? ''),
          contact: String(p.contact ?? ''),
          baseCurrency: String(p.baseCurrency ?? ''),
          usdRate: String(p.usdRate ?? ''),
          eurRate: String(p.eurRate ?? ''),
          notes: String(p.notes ?? ''),
          apiType: String(p.apiType ?? ''),
          apiBaseUrl: String(p.apiBaseUrl ?? ''),
        })
        .run()
    }

    for (const raw of Array.isArray(data.serverProjects) ? data.serverProjects : []) {
      const sp = asObject(raw)
      db.insert(schema.serverProjects)
        .values({
          id: String(sp.id ?? ''),
          name: String(sp.name ?? ''),
          color: sp.color != null ? String(sp.color) : null,
          sortOrder: Number(sp.sortOrder) || 0,
          notes: sp.notes != null ? String(sp.notes) : null,
          createdAt: sp.createdAt != null ? String(sp.createdAt) : null,
        })
        .run()
    }

    for (const raw of Array.isArray(data.providerAccounts) ? data.providerAccounts : []) {
      const acc = asObject(raw)
      const alertRaw = acc.balance_alert_below ?? acc.balanceAlertBelow
      const alertBelow =
        alertRaw != null && alertRaw !== '' && Number.isFinite(Number(alertRaw)) ? Number(alertRaw) : null
      db.insert(schema.providerAccounts)
        .values({
          id: String(acc.id ?? ''),
          providerId: String(acc.providerId ?? ''),
          name: String(acc.name ?? ''),
          panelUrl: String(acc.panelUrl ?? ''),
          currency: String(acc.currency ?? ''),
          billingMode: String(acc.billingMode ?? ''),
          notes: String(acc.notes ?? ''),
          apiType: String(acc.apiType ?? ''),
          apiBaseUrl: String(acc.apiBaseUrl ?? ''),
          apiCredentials: String(acc.apiCredentials ?? ''),
          balanceApi: acc.balance_api != null ? Number(acc.balance_api) : acc.balanceApi != null ? Number(acc.balanceApi) : null,
          balanceCurrency:
            acc.balance_currency != null ? String(acc.balance_currency) : acc.balanceCurrency != null ? String(acc.balanceCurrency) : null,
          balanceUpdatedAt:
            acc.balance_updated_at != null ? String(acc.balance_updated_at) : acc.balanceUpdatedAt != null ? String(acc.balanceUpdatedAt) : null,
          enoughmoneyto: acc.enoughmoneyto != null ? String(acc.enoughmoneyto) : null,
          balanceAlertBelow: alertBelow,
        })
        .run()
    }

    consolidateAllProviderApiSources(sqlite)

    const settingsList = Array.isArray(data.settings)
      ? data.settings
      : data.settings
        ? [data.settings]
        : []
    for (const raw of settingsList) {
      const s = asObject(raw)
      let customFields = s.customFields
      if (Array.isArray(customFields)) customFields = JSON.stringify(customFields)
      db.insert(schema.settings)
        .values({
          id: String(s.id ?? 'settings-main'),
          baseCurrency: String(s.baseCurrency ?? 'RUB'),
          ratesUrl: String(s.ratesUrl ?? ''),
          autoConvert: s.autoConvert !== false && s.autoConvert !== 0 ? 1 : 0,
          ratesUpdatedAt: String(s.ratesUpdatedAt ?? ''),
          syncEnabled: s.syncEnabled ? 1 : 0,
          syncIntervalMinutes: Number(s.syncIntervalMinutes) || 60,
          syncTariffsIntervalMinutes: Number(s.syncTariffsIntervalMinutes) || 1440,
          telegramBotToken: String(s.telegramBotToken ?? ''),
          telegramChatId: String(s.telegramChatId ?? ''),
          telegramMessageThreadId: String(s.telegramMessageThreadId ?? ''),
          notifyPaymentExpiryEnabled: s.notifyPaymentExpiryEnabled ? 1 : 0,
          notifyNewTariffsEnabled: s.notifyNewTariffsEnabled ? 1 : 0,
          customFields: customFields != null ? String(customFields) : null,
          notifyLowBalanceEnabled: s.notifyLowBalanceEnabled ? 1 : 0,
          notifySyncDigestEnabled: s.notifySyncDigestEnabled ? 1 : 0,
          notifyVpsDownEnabled: s.notifyVpsDownEnabled ? 1 : 0,
          webhookUrl: String(s.webhookUrl ?? ''),
          webhookEnabled: s.webhookEnabled ? 1 : 0,
          notifyIntervalMinutes: Number(s.notifyIntervalMinutes) || 60,
          uptimeCheckIntervalMinutes: Number(s.uptimeCheckIntervalMinutes) || 5,
        })
        .run()
    }

    for (const raw of Array.isArray(data.vps) ? data.vps : []) {
      const v = asObject(raw)
      const additionalIps = Array.isArray(v.additionalIps) ? JSON.stringify(v.additionalIps) : '[]'
      const dailyRate = v.dailyRate === '' || v.dailyRate == null ? null : Number(v.dailyRate)
      const monthlyRate = v.monthlyRate === '' || v.monthlyRate == null ? null : Number(v.monthlyRate)
      const userOverrides = Array.isArray(v.userOverrides)
        ? JSON.stringify(v.userOverrides)
        : String(v.userOverrides ?? '[]')
      db.insert(schema.vps)
        .values({
          id: String(v.id ?? ''),
          ip: String(v.ip ?? ''),
          ipv6: String(v.ipv6 ?? ''),
          additionalIps,
          dns: String(v.dns ?? ''),
          providerId: String(v.providerId ?? ''),
          providerAccountId: String(v.providerAccountId ?? ''),
          country: String(v.country ?? ''),
          city: String(v.city ?? ''),
          datacenter: String(v.datacenter ?? ''),
          os: String(v.os ?? ''),
          vcpu: Number(v.vcpu) || 0,
          ramGb: Number(v.ramGb) || 0,
          diskGb: Number(v.diskGb) || 0,
          diskType: String(v.diskType ?? ''),
          virtualization: String(v.virtualization ?? ''),
          bandwidthTb: Number(v.bandwidthTb) || 0,
          sshPort: Number(v.sshPort) || 22,
          rootUser: String(v.rootUser ?? ''),
          purpose: String(v.purpose ?? ''),
          environment: String(v.environment ?? ''),
          project: String(v.project ?? ''),
          projectId: v.projectId != null && v.projectId !== '' ? String(v.projectId) : null,
          monitoringEnabled: v.monitoringEnabled ? 1 : 0,
          backupEnabled: v.backupEnabled ? 1 : 0,
          status: String(v.status ?? 'active'),
          tariffType: String(v.tariffType ?? ''),
          currency: String(v.currency ?? ''),
          dailyRate,
          monthlyRate,
          createdAt: String(v.createdAt ?? ''),
          paidUntil: String(v.paidUntil ?? ''),
          notes: String(v.notes ?? ''),
          userOverrides,
        })
        .run()
    }

    for (const raw of Array.isArray(data.payments) ? data.payments : []) {
      const pm = asObject(raw)
      db.insert(schema.payments)
        .values({
          id: String(pm.id ?? ''),
          type: String(pm.type ?? ''),
          date: String(pm.date ?? ''),
          amount: Number(pm.amount) || 0,
          currency: String(pm.currency ?? ''),
          providerAccountId: String(pm.providerAccountId ?? ''),
          vpsId: pm.vpsId != null ? String(pm.vpsId) : null,
          note: String(pm.note ?? ''),
        })
        .run()
    }

    for (const raw of Array.isArray(data.balanceLedger) ? data.balanceLedger : []) {
      const bl = asObject(raw)
      db.insert(schema.balanceLedger)
        .values({
          id: String(bl.id ?? ''),
          type: String(bl.type ?? ''),
          date: String(bl.date ?? ''),
          amount: Number(bl.amount) || 0,
          currency: String(bl.currency ?? ''),
          direction: String(bl.direction ?? ''),
          providerAccountId: String(bl.providerAccountId ?? ''),
          vpsId: bl.vpsId != null ? String(bl.vpsId) : null,
          note: String(bl.note ?? ''),
        })
        .run()
    }

    for (const raw of Array.isArray(data.activeTariffs) ? data.activeTariffs : []) {
      const t = asObject(raw)
      db.insert(schema.activeTariffs)
        .values({
          id: String(t.id ?? ''),
          providerAccountId: String(t.providerAccountId ?? ''),
          providerId: String(t.providerId ?? ''),
          externalId: String(t.externalId ?? ''),
          datacenterKey: String(t.datacenterKey ?? ''),
          datacenterName: String(t.datacenterName ?? ''),
          name: String(t.name ?? ''),
          desc: String(t.desc ?? ''),
          vcpu: Number(t.vcpu) || 0,
          ramGb: Number(t.ramGb) || 0,
          diskGb: Number(t.diskGb) || 0,
          diskType: String(t.diskType ?? ''),
          virtualization: String(t.virtualization ?? ''),
          channel: String(t.channel ?? ''),
          location: String(t.location ?? ''),
          country: String(t.country ?? ''),
          cpuModel: String(t.cpuModel ?? ''),
          orderAvailable: t.orderAvailable ? 1 : 0,
          price: String(t.price ?? ''),
          syncedAt: String(t.syncedAt ?? ''),
        })
        .run()
    }

    for (const raw of Array.isArray(data.tariffSyncOptions) ? data.tariffSyncOptions : []) {
      const o = asObject(raw)
      const dcs = typeof o.datacenters === 'string' ? o.datacenters : JSON.stringify(o.datacenters || [])
      const pers = typeof o.periods === 'string' ? o.periods : JSON.stringify(o.periods || [])
      db.insert(schema.tariffSyncOptions)
        .values({
          providerAccountId: String(o.providerAccountId ?? ''),
          datacenters: dcs,
          periods: pers,
          syncedAt: String(o.syncedAt ?? ''),
        })
        .run()
    }

    for (const raw of Array.isArray(data.syncLog) ? data.syncLog : []) {
      const log = asObject(raw)
      db.insert(schema.syncLog)
        .values({
          id: String(log.id ?? ''),
          accountId: String(log.accountId ?? ''),
          startedAt: String(log.startedAt ?? ''),
          finishedAt: log.finishedAt != null ? String(log.finishedAt) : null,
          status: log.status != null ? String(log.status) : null,
          vpsCount: log.vpsCount != null ? Number(log.vpsCount) : null,
          paymentsCount: log.paymentsCount != null ? Number(log.paymentsCount) : null,
          error: log.error != null ? String(log.error) : null,
          summary:
            typeof log.summary === 'string'
              ? log.summary
              : log.summary
                ? JSON.stringify(log.summary)
                : null,
        })
        .run()
    }

    sqlite.exec('COMMIT')
  } catch (err) {
    sqlite.exec('ROLLBACK')
    throw err
  }
}
