/**
 * Sync Macloud / VDSina UserAPI data into vps-tracker DB
 */

import { and, eq, like, or } from 'drizzle-orm'
import { getDb, schema } from '@cfdm/db'

import type { UserApiSyncAccount } from './context.js'
import { syncFallbackCurrency } from '@cfdm/shared/utils/account-balance'
import { mapOperationToPayment, mapServerToVps } from './mappers.js'
import {
  fetchBalance,
  fetchOperations,
  fetchServersWithDetails,
  fetchTariffList,
  type UserApiBalanceResult,
} from './operations.js'

export interface SyncFromUserApiOptions {
  skipTariffs?: boolean
  skipVpsPayments?: boolean
}

export interface SyncSummary {
  added: { id: string; label: string }[]
  updated: { id: string; label: string; fields: string[] }[]
  paymentsAdded: number
  tariffsOnly?: boolean
}

export interface SyncFromUserApiResult {
  vpsCount: number
  paymentsCount: number
  tariffsCount: number
  newTariffs: { name: string; price: string; providerId: string }[]
  balance: UserApiBalanceResult | null
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

export async function syncFromUserApi(
  account: UserApiSyncAccount,
  opts: SyncFromUserApiOptions = {},
): Promise<SyncFromUserApiResult> {
  const { skipTariffs = false, skipVpsPayments = false } = opts
  const { apiBaseUrl, apiType, providerId, id: accountId, apiToken } = account
  if (!apiBaseUrl?.trim() || !apiToken?.trim()) {
    throw new Error('API URL and credentials are required')
  }
  const db = getDb()
  const credentials = apiToken
  const idPrefix = apiType

  const fetchVpsData = !skipVpsPayments
  const fetchTariffs = !skipTariffs

  const fallbackCurrency = syncFallbackCurrency(account)

  const [servers, balanceInfo, tariffItems, operations] = await Promise.all([
    fetchVpsData ? fetchServersWithDetails(apiBaseUrl, credentials) : [],
    fetchVpsData
      ? fetchBalance(apiBaseUrl, credentials, fallbackCurrency).catch(() => null)
      : null,
    fetchTariffs ? fetchTariffList(apiBaseUrl, credentials).catch(() => []) : [],
    fetchVpsData ? fetchOperations(apiBaseUrl, credentials).catch(() => []) : [],
  ])

  let vpsCount = 0
  const syncSummary: SyncSummary = { added: [], updated: [], paymentsAdded: 0 }

  if (fetchVpsData) {
    for (const server of servers) {
      const vps = mapServerToVps(server, apiType, providerId, accountId)
      const id = `vps-${idPrefix}-${accountId}-${vps.externalId}`
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
            or(
              ...(vps.ip ? [eq(schema.vps.ip, vps.ip)] : []),
              like(schema.vps.notes, `%${idPrefix}-${vps.externalId}%`),
            ),
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

  let paymentsCount = 0
  if (fetchVpsData) {
    const existingPaymentRows = db
      .select({ note: schema.payments.note })
      .from(schema.payments)
      .where(eq(schema.payments.providerAccountId, accountId))
      .all()
    const existingPayments = new Set(
      existingPaymentRows.map((r) => r.note).filter((n): n is string => Boolean(n)),
    )

    for (const item of operations) {
      const payment = mapOperationToPayment(item, apiType, accountId, fallbackCurrency)
      if (!payment) continue
      const note = payment.note
      if (existingPayments.has(note)) continue
      const payId = `pay-${idPrefix}-${accountId}-${payment.externalId}`
      db.insert(schema.payments)
        .values({
          id: payId,
          type: payment.type,
          date: payment.date,
          amount: payment.amount,
          currency: payment.currency,
          providerAccountId: payment.providerAccountId,
          vpsId: payment.vpsId,
          note,
        })
        .run()
      existingPayments.add(note)
      paymentsCount++
      syncSummary.paymentsAdded += 1
    }
  }

  if (fetchVpsData && balanceInfo) {
    db.update(schema.providerAccounts)
      .set({
        balanceApi: balanceInfo.balance,
        balanceCurrency: balanceInfo.currency || fallbackCurrency,
        balanceUpdatedAt: new Date().toISOString(),
        enoughmoneyto: balanceInfo.enoughmoneyto || '',
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
        ? `tariff-${idPrefix}-${accountId}-${t.externalId}-${dcKey}`
        : `tariff-${idPrefix}-${accountId}-${t.externalId}`
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
    paymentsCount,
    tariffsCount,
    newTariffs,
    balance: balanceInfo,
    syncSummary,
  }
}
