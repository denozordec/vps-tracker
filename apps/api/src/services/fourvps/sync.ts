/**
 * Sync 4VPS data into vps-tracker DB (Drizzle / @cfdm/db)
 */

import { and, eq, like, or } from 'drizzle-orm'
import { getDb, schema } from '@cfdm/db'

import type { FourvpsSyncAccount } from './context.js'
import { syncFallbackCurrency } from '@cfdm/shared/utils/account-balance'
import { mapServerToVps } from './mappers.js'
import {
  fetchDcList,
  fetchMyServers,
  fetchTarifList,
  fetchUserBalance,
  type FourVpsBalanceInfo,
} from './operations.js'

export interface SyncFromFourvpsOptions {
  skipTariffs?: boolean
  skipVpsPayments?: boolean
}

export interface SyncSummary {
  added: { id: string; label: string }[]
  updated: { id: string; label: string; fields: string[] }[]
  paymentsAdded: number
  tariffsOnly?: boolean
}

export interface SyncFromFourvpsResult {
  vpsCount: number
  paymentsCount: number
  tariffsCount: number
  newTariffs: { name: string; price: string; providerId: string }[]
  balance: FourVpsBalanceInfo | null
  syncSummary: SyncSummary
}

const SYNC_UPDATE_FIELDS = [
  'country',
  'city',
  'datacenter',
  'os',
  'notes',
  'status',
  'tariffType',
  'currency',
  'dailyRate',
  'monthlyRate',
  'paidUntil',
] as const

function normVal(v: unknown): string {
  if (v == null || v === '') return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  return String(v)
}

function buildCredentials(account: FourvpsSyncAccount): string {
  const { panelId, apiKey } = account
  if (panelId != null) return `${panelId}:${apiKey}`
  return apiKey
}

export async function syncFromFourvps(
  account: FourvpsSyncAccount,
  opts: SyncFromFourvpsOptions = {},
): Promise<SyncFromFourvpsResult> {
  const { skipTariffs = false, skipVpsPayments = false } = opts
  const { apiBaseUrl, providerId, id: accountId } = account
  const credentials = buildCredentials(account)
  if (!apiBaseUrl?.trim() || !account.apiKey?.trim()) {
    throw new Error('API URL and credentials are required')
  }
  const db = getDb()

  const fetchVpsData = !skipVpsPayments
  const fetchTariffs = !skipTariffs

  const fallbackCurrency = syncFallbackCurrency(account)

  const [servers, balanceInfo, tariffItems, dcMap] = await Promise.all([
    fetchVpsData ? fetchMyServers(apiBaseUrl, credentials) : [],
    fetchVpsData
      ? fetchUserBalance(apiBaseUrl, credentials, fallbackCurrency).catch(() => null)
      : null,
    fetchTariffs ? fetchTarifList(apiBaseUrl, credentials).catch(() => []) : [],
    fetchVpsData || fetchTariffs ? fetchDcList(apiBaseUrl, credentials).catch(() => new Map()) : new Map(),
  ])

  let vpsCount = 0
  const syncSummary: SyncSummary = { added: [], updated: [], paymentsAdded: 0 }

  if (fetchVpsData) {
    for (const server of servers) {
      const vps = mapServerToVps(server, providerId, accountId, dcMap)
      const id = `vps-4vps-${accountId}-${vps.externalId}`
      const additionalIps = JSON.stringify(vps.additionalIps || [])
      const dailyRate = vps.dailyRate
      const monthlyRate = vps.monthlyRate
      const paidUntil = vps.paidUntil || ''
      const notes = vps.notes

      const existing = db
        .select()
        .from(schema.vps)
        .where(
          and(
            eq(schema.vps.providerAccountId, accountId),
            or(eq(schema.vps.ip, vps.ip), like(schema.vps.notes, `%4vps-${vps.externalId}%`)),
          ),
        )
        .get()

      if (existing) {
        let userOverrides: string[] = []
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
            merged[f] = existing[f as keyof typeof existing] as never
          }
        }
        const compareFields = ['ip', 'ipv6', 'dns', ...SYNC_UPDATE_FIELDS] as const
        const changedFields = compareFields.filter(
          (f) => normVal(merged[f as keyof typeof merged]) !== normVal(existing[f as keyof typeof existing]),
        )
        if (changedFields.length > 0) {
          const label = merged.dns || merged.ip || existing.id
          syncSummary.updated.push({ id: existing.id, label, fields: [...changedFields] })
        }
        db.update(schema.vps)
          .set({
            ip: merged.ip,
            ipv6: merged.ipv6,
            additionalIps: merged.additionalIps,
            dns: merged.dns,
            country: merged.country,
            city: merged.city,
            datacenter: merged.datacenter,
            os: merged.os,
            status: merged.status,
            tariffType: merged.tariffType,
            currency: merged.currency,
            dailyRate: merged.dailyRate,
            monthlyRate: merged.monthlyRate,
            paidUntil: merged.paidUntil,
            notes: merged.notes,
          })
          .where(eq(schema.vps.id, existing.id))
          .run()
      } else {
        const label = vps.dns || vps.ip || id
        syncSummary.added.push({ id, label })
        db.insert(schema.vps)
          .values({
            id,
            ip: vps.ip,
            ipv6: vps.ipv6,
            additionalIps,
            dns: vps.dns,
            providerId: vps.providerId,
            providerAccountId: vps.providerAccountId,
            country: vps.country,
            city: vps.city,
            datacenter: vps.datacenter,
            os: vps.os,
            vcpu: vps.vcpu,
            ramGb: vps.ramGb,
            diskGb: vps.diskGb,
            diskType: vps.diskType,
            virtualization: vps.virtualization,
            bandwidthTb: vps.bandwidthTb,
            sshPort: vps.sshPort,
            rootUser: vps.rootUser,
            purpose: vps.purpose,
            environment: vps.environment,
            project: vps.project,
            projectId: null,
            monitoringEnabled: vps.monitoringEnabled ? 1 : 0,
            backupEnabled: vps.backupEnabled ? 1 : 0,
            status: vps.status,
            tariffType: vps.tariffType,
            currency: vps.currency,
            dailyRate,
            monthlyRate,
            createdAt: vps.createdAt || new Date().toISOString().slice(0, 10),
            paidUntil,
            notes,
            userOverrides: '[]',
          })
          .run()
      }
      vpsCount++
    }
  }

  if (fetchVpsData && balanceInfo) {
    db.update(schema.providerAccounts)
      .set({
        balanceApi: balanceInfo.balance,
        balanceCurrency: balanceInfo.currency || fallbackCurrency,
        balanceUpdatedAt: new Date().toISOString(),
        enoughmoneyto: '',
      })
      .where(eq(schema.providerAccounts.id, accountId))
      .run()
  }

  let tariffsCount = 0
  const newTariffs: { name: string; price: string; providerId: string }[] = []
  if (fetchTariffs) {
    const existingTariffIds = new Set(
      db
        .select({ id: schema.activeTariffs.id })
        .from(schema.activeTariffs)
        .where(eq(schema.activeTariffs.providerAccountId, accountId))
        .all()
        .map((r) => r.id),
    )
    const syncedAt = new Date().toISOString()
    db.delete(schema.activeTariffs)
      .where(eq(schema.activeTariffs.providerAccountId, accountId))
      .run()

    for (const t of tariffItems) {
      const dcKey = t.datacenterKey ?? ''
      const dcName = t.datacenterName ?? ''
      const tariffId = dcKey
        ? `tariff-4vps-${accountId}-${t.externalId}-${dcKey}`
        : `tariff-4vps-${accountId}-${t.externalId}`
      if (!existingTariffIds.has(tariffId)) {
        newTariffs.push({ name: t.name || '', price: t.price || '', providerId })
      }
      db.insert(schema.activeTariffs)
        .values({
          id: tariffId,
          providerAccountId: accountId,
          providerId,
          externalId: t.externalId,
          datacenterKey: dcKey,
          datacenterName: dcName,
          name: t.name || '',
          desc: t.desc || '',
          vcpu: t.vcpu || 0,
          ramGb: t.ramGb || 0,
          diskGb: t.diskGb || 0,
          diskType: t.diskType || 'NVMe',
          virtualization: t.virtualization || 'KVM',
          channel: t.channel || '',
          location: t.location || '',
          country: t.country || '',
          cpuModel: t.cpuModel || '',
          orderAvailable: t.orderAvailable ? 1 : 0,
          price: t.price || '',
          syncedAt,
        })
        .run()
      tariffsCount++
    }
  }

  if (!fetchVpsData) {
    syncSummary.tariffsOnly = true
  }

  return {
    vpsCount,
    paymentsCount: 0,
    tariffsCount,
    newTariffs,
    balance: balanceInfo,
    syncSummary,
  }
}
