import { asc, eq, isNull } from 'drizzle-orm'
import type { CfdmBindingSyncItem } from '@cfdm/shared/contracts/integration-cfdm'
import { getDb, schema } from '../index.js'
import { generateId } from './utils.js'
import { vpsRepository } from './vps.js'

type Row = typeof schema.vpsDomains.$inferSelect

export type VpsDomainDto = Row

function normalizeIp(ip: string): string {
  return ip.trim().toLowerCase()
}

function collectVpsIps(vps: { ip?: string | null; additionalIps?: string[] }): string[] {
  const ips: string[] = []
  if (vps.ip?.trim()) ips.push(normalizeIp(vps.ip))
  for (const raw of vps.additionalIps ?? []) {
    if (raw?.trim()) ips.push(normalizeIp(raw))
  }
  return ips
}

function findVpsIdByIps(
  allVps: ReturnType<typeof vpsRepository.list>,
  ips: string[],
): string | null {
  const normalized = [...new Set(ips.map(normalizeIp).filter(Boolean))]
  if (normalized.length === 0) return null

  const matches: string[] = []
  for (const v of allVps) {
    const vips = collectVpsIps(v)
    if (normalized.some((ip) => vips.includes(ip))) {
      matches.push(v.id)
    }
  }
  if (matches.length === 1) return matches[0]!
  return null
}

function resolveMatchStatus(vpsId: string | null): 'matched' | 'unmatched' {
  return vpsId ? 'matched' : 'unmatched'
}

export const vpsDomainsRepository = {
  list(): VpsDomainDto[] {
    return getDb()
      .select()
      .from(schema.vpsDomains)
      .orderBy(asc(schema.vpsDomains.fqdn))
      .all()
  },

  listByVpsId(vpsId: string): VpsDomainDto[] {
    return getDb()
      .select()
      .from(schema.vpsDomains)
      .where(eq(schema.vpsDomains.vpsId, vpsId))
      .orderBy(asc(schema.vpsDomains.fqdn))
      .all()
  },

  getByCfdmBindingId(bindingId: number): VpsDomainDto | undefined {
    return getDb()
      .select()
      .from(schema.vpsDomains)
      .where(eq(schema.vpsDomains.cfdmBindingId, bindingId))
      .get()
  },

  deleteByCfdmBindingId(bindingId: number): boolean {
    const row = this.getByCfdmBindingId(bindingId)
    if (!row) return false
    getDb().delete(schema.vpsDomains).where(eq(schema.vpsDomains.id, row.id)).run()
    return true
  },

  rematchAll(): { updated: number } {
    const db = getDb()
    const allVps = vpsRepository.list()
    const rows = db.select().from(schema.vpsDomains).all()
    let updated = 0
    const vpsIds = new Set(allVps.map((v) => v.id))

    for (const row of rows) {
      let storedIps: string[] = []
      try {
        storedIps = row.targetIps ? JSON.parse(row.targetIps) : []
      } catch {
        storedIps = []
      }

      let vpsId = row.vpsId
      if (vpsId && !vpsIds.has(vpsId)) {
        vpsId = null
      }
      if (!vpsId && storedIps.length > 0) {
        vpsId = findVpsIdByIps(allVps, storedIps)
      }
      const matchStatus =
        vpsId && vpsIds.has(vpsId)
          ? 'matched'
          : row.vpsId && !vpsIds.has(row.vpsId)
            ? 'orphaned'
            : resolveMatchStatus(vpsId)

      if (vpsId !== row.vpsId || matchStatus !== row.matchStatus) {
        db.update(schema.vpsDomains)
          .set({ vpsId, matchStatus })
          .where(eq(schema.vpsDomains.id, row.id))
          .run()
        updated++
      }
    }
    return { updated }
  },

  syncBindings(items: CfdmBindingSyncItem[]): {
    matched: number
    unmatched: number
    deleted: number
    upserted: number
  } {
    const db = getDb()
    const allVps = vpsRepository.list()
    const now = new Date().toISOString()
    let matched = 0
    let unmatched = 0
    let deleted = 0
    let upserted = 0

    for (const item of items) {
      if (item.deleted) {
        if (this.deleteByCfdmBindingId(item.bindingId)) deleted++
        continue
      }

      const vpsId = findVpsIdByIps(allVps, item.ips)
      const matchStatus = resolveMatchStatus(vpsId)
      if (matchStatus === 'matched') matched++
      else unmatched++

      const existing = this.getByCfdmBindingId(item.bindingId)
      const values = {
        vpsId,
        fqdn: item.fqdn,
        zoneName: item.zoneName,
        hostname: item.hostname,
        serviceName: item.serviceName,
        serviceSlug: item.serviceSlug,
        cfdmServiceId: item.serviceId,
        cfdmBindingId: item.bindingId,
        source: 'cfdm' as const,
        matchStatus,
        targetIps: JSON.stringify(item.ips),
        syncedAt: now,
      }

      if (existing) {
        db.update(schema.vpsDomains).set(values).where(eq(schema.vpsDomains.id, existing.id)).run()
      } else {
        db.insert(schema.vpsDomains).values({ id: generateId('vd'), ...values }).run()
      }
      upserted++
    }

    return { matched, unmatched, deleted, upserted }
  },

  markOrphanedForMissingBindings(serviceId: number, keptBindingIds: number[]): number {
    const db = getDb()
    const rows = db
      .select()
      .from(schema.vpsDomains)
      .where(eq(schema.vpsDomains.cfdmServiceId, serviceId))
      .all()
    let removed = 0
    for (const row of rows) {
      if (!keptBindingIds.includes(row.cfdmBindingId)) {
        db.delete(schema.vpsDomains).where(eq(schema.vpsDomains.id, row.id)).run()
        removed++
      }
    }
    return removed
  },

  listUnmatched(): VpsDomainDto[] {
    return getDb()
      .select()
      .from(schema.vpsDomains)
      .where(isNull(schema.vpsDomains.vpsId))
      .orderBy(asc(schema.vpsDomains.fqdn))
      .all()
  },
}
