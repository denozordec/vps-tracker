import { and, asc, eq, isNull } from 'drizzle-orm'
// and used in markOrphaned / listUnmatched
import type { CfdmBindingSyncItem } from '@cfdm/shared/contracts/integration-cfdm'
import { getDb, schema } from '../index.js'
import { getCurrentSpaceId } from '../space-context.js'
import { generateId } from './utils.js'
import { vpsRepository } from './vps.js'

type Row = typeof schema.vpsDomains.$inferSelect

export type VpsDomainDto = Row

function normalizeIp(ip: string): string {
  return ip.trim().toLowerCase()
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, '')
}

function isIpLiteral(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(v)) {
    return v.split('.').every((p) => {
      const n = Number(p)
      return Number.isInteger(n) && n >= 0 && n <= 255
    })
  }
  // грубый IPv6 — отсекает hostname вроде ihome.rkns.top
  return v.includes(':') && !v.includes(' ')
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
  const normalized = [
    ...new Set(ips.map(normalizeIp).filter((ip) => ip && isIpLiteral(ip))),
  ]
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

/** Точное совпадение hostname с полем VPS.dns. */
function findVpsIdByDns(
  allVps: ReturnType<typeof vpsRepository.list>,
  hostname: string,
): string | null {
  const key = normalizeHost(hostname)
  if (!key || isIpLiteral(key)) return null
  const matches = allVps.filter((v) => normalizeHost(v.dns ?? '') === key)
  if (matches.length === 1) return matches[0]!.id
  return null
}

function findVpsIdForBinding(
  allVps: ReturnType<typeof vpsRepository.list>,
  item: Pick<CfdmBindingSyncItem, 'ips' | 'fqdn' | 'cnameTarget'>,
): string | null {
  return (
    findVpsIdByIps(allVps, item.ips) ??
    findVpsIdByDns(allVps, item.fqdn) ??
    (item.cnameTarget ? findVpsIdByDns(allVps, item.cnameTarget) : null)
  )
}

function resolveMatchStatus(vpsId: string | null): 'matched' | 'unmatched' {
  return vpsId ? 'matched' : 'unmatched'
}

function applyInheritedMatch(
  db: ReturnType<typeof getDb>,
  rowId: string,
  vpsId: string,
  counters: { matched: number; unmatched: number },
): void {
  db.update(schema.vpsDomains)
    .set({ vpsId, matchStatus: 'matched' })
    .where(eq(schema.vpsDomains.id, rowId))
    .run()
  counters.matched++
  counters.unmatched = Math.max(0, counters.unmatched - 1)
}

export const vpsDomainsRepository = {
  list(): VpsDomainDto[] {
    const spaceId = getCurrentSpaceId()
    return getDb()
      .select()
      .from(schema.vpsDomains)
      .where(eq(schema.vpsDomains.spaceId, spaceId))
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
    const spaceId = getCurrentSpaceId()
    const allVps = vpsRepository.list()
    const rows = db
      .select()
      .from(schema.vpsDomains)
      .where(eq(schema.vpsDomains.spaceId, spaceId))
      .all()
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
      if (!vpsId) {
        vpsId = findVpsIdByDns(allVps, row.fqdn)
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

  syncBindings(
    items: CfdmBindingSyncItem[],
    opts?: { fullSync?: boolean },
  ): {
    matched: number
    unmatched: number
    deleted: number
    upserted: number
  } {
    const db = getDb()
    const spaceId = getCurrentSpaceId()
    const allVps = vpsRepository.list()
    const now = new Date().toISOString()
    let matched = 0
    let unmatched = 0
    let deleted = 0
    let upserted = 0
    const keptBindingIds = new Set<number>()
    const fqdnToVpsId = new Map<string, string>()
    const serviceMatchedVps = new Map<number, Set<string>>()
    const counters = { matched: 0, unmatched: 0 }

    for (const item of items) {
      if (item.deleted) {
        if (this.deleteByCfdmBindingId(item.bindingId)) deleted++
        continue
      }

      keptBindingIds.add(item.bindingId)

      const vpsId = findVpsIdForBinding(allVps, item)
      const matchStatus = resolveMatchStatus(vpsId)
      if (matchStatus === 'matched') {
        counters.matched++
        fqdnToVpsId.set(normalizeHost(item.fqdn), vpsId!)
        const set = serviceMatchedVps.get(item.serviceId) ?? new Set<string>()
        set.add(vpsId!)
        serviceMatchedVps.set(item.serviceId, set)
      } else {
        counters.unmatched++
      }

      const existing = this.getByCfdmBindingId(item.bindingId)
      const values = {
        spaceId,
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
        targetIps: JSON.stringify(item.ips.filter(isIpLiteral)),
        syncedAt: now,
      }

      if (existing) {
        db.update(schema.vpsDomains).set(values).where(eq(schema.vpsDomains.id, existing.id)).run()
      } else {
        db.insert(schema.vpsDomains).values({ id: generateId('vd'), ...values }).run()
      }
      upserted++
    }

    // CNAME → уже matched FQDN (например imsk → ihome)
    let inherited = true
    while (inherited) {
      inherited = false
      for (const item of items) {
        if (item.deleted || !item.cnameTarget) continue
        const existing = this.getByCfdmBindingId(item.bindingId)
        if (!existing || existing.vpsId) continue
        const parentVpsId = fqdnToVpsId.get(normalizeHost(item.cnameTarget))
        if (!parentVpsId) continue
        applyInheritedMatch(db, existing.id, parentVpsId, counters)
        fqdnToVpsId.set(normalizeHost(item.fqdn), parentVpsId)
        const set = serviceMatchedVps.get(item.serviceId) ?? new Set<string>()
        set.add(parentVpsId)
        serviceMatchedVps.set(item.serviceId, set)
        inherited = true
      }
    }

    // Sibling bindings того же CFDM-сервиса → один уникальный VPS
    for (const item of items) {
      if (item.deleted) continue
      const existing = this.getByCfdmBindingId(item.bindingId)
      if (!existing || existing.vpsId) continue
      const matched = serviceMatchedVps.get(item.serviceId)
      if (!matched || matched.size !== 1) continue
      const siblingVpsId = [...matched][0]!
      applyInheritedMatch(db, existing.id, siblingVpsId, counters)
      fqdnToVpsId.set(normalizeHost(item.fqdn), siblingVpsId)
    }

    matched = counters.matched
    unmatched = counters.unmatched

    if (opts?.fullSync) {
      const rows = db
        .select()
        .from(schema.vpsDomains)
        .where(
          and(
            eq(schema.vpsDomains.spaceId, spaceId),
            eq(schema.vpsDomains.source, 'cfdm'),
          ),
        )
        .all()
      for (const row of rows) {
        if (!keptBindingIds.has(row.cfdmBindingId)) {
          db.delete(schema.vpsDomains).where(eq(schema.vpsDomains.id, row.id)).run()
          deleted++
        }
      }
    }

    return { matched, unmatched, deleted, upserted }
  },

  markOrphanedForMissingBindings(serviceId: number, keptBindingIds: number[]): number {
    const db = getDb()
    const spaceId = getCurrentSpaceId()
    const rows = db
      .select()
      .from(schema.vpsDomains)
      .where(
        and(
          eq(schema.vpsDomains.cfdmServiceId, serviceId),
          eq(schema.vpsDomains.spaceId, spaceId),
        ),
      )
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
    const spaceId = getCurrentSpaceId()
    return getDb()
      .select()
      .from(schema.vpsDomains)
      .where(
        and(eq(schema.vpsDomains.spaceId, spaceId), isNull(schema.vpsDomains.vpsId)),
      )
      .orderBy(asc(schema.vpsDomains.fqdn))
      .all()
  },
}
