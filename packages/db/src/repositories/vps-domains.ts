import { and, asc, eq, isNull } from 'drizzle-orm'
import type { CfdmBindingSyncItem } from '@cfdm/shared/contracts/integration-cfdm'
import { getDb, schema } from '../index.js'
import { getCurrentSpaceId } from '../space-context.js'
import { generateId } from './utils.js'
import { findVpsIdsByIps, isIpLiteral } from './ip-match.js'
import { vpsRepository } from './vps.js'

type Row = typeof schema.vpsDomains.$inferSelect
type Db = ReturnType<typeof getDb>

export type VpsDomainDto = Row

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.+$/, '')
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

function findVpsIdsForBinding(
  allVps: ReturnType<typeof vpsRepository.list>,
  item: Pick<CfdmBindingSyncItem, 'ips' | 'fqdn' | 'cnameTarget'>,
): string[] {
  const byIps = findVpsIdsByIps(allVps, item.ips)
  if (byIps.length > 0) return byIps
  const byDns = findVpsIdByDns(allVps, item.fqdn)
  if (byDns) return [byDns]
  if (item.cnameTarget) {
    const byCname = findVpsIdByDns(allVps, item.cnameTarget)
    if (byCname) return [byCname]
  }
  return []
}

function parseStoredIps(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

type BindingFields = {
  spaceId: string
  fqdn: string
  zoneName: string
  hostname: string
  serviceName: string
  serviceSlug: string
  cfdmServiceId: number
  cfdmBindingId: number
  source: 'cfdm'
  targetIps: string
  syncedAt: string
}

function listByCfdmBindingId(bindingId: number): VpsDomainDto[] {
  return getDb()
    .select()
    .from(schema.vpsDomains)
    .where(eq(schema.vpsDomains.cfdmBindingId, bindingId))
    .all()
}

function deleteAllByCfdmBindingId(bindingId: number): boolean {
  const result = getDb()
    .delete(schema.vpsDomains)
    .where(eq(schema.vpsDomains.cfdmBindingId, bindingId))
    .run()
  return result.changes > 0
}

/**
 * Одна unmatched-строка (vpsId NULL) либо N matched-строк — по одной на VPS.
 * Лишние строки binding удаляются.
 */
function reconcileBindingToVpsIds(
  db: Db,
  existing: VpsDomainDto[],
  fields: BindingFields,
  vpsIds: string[],
  emptyStatus: 'unmatched' | 'orphaned' = 'unmatched',
): { upserted: number; deleted: number } {
  let upserted = 0
  let deleted = 0
  const keepIds = new Set<string>()

  if (vpsIds.length === 0) {
    const reusable = existing.find((r) => !r.vpsId) ?? existing[0]
    const values = {
      ...fields,
      vpsId: null,
      matchStatus: emptyStatus,
    }
    if (reusable) {
      db.update(schema.vpsDomains)
        .set(values)
        .where(eq(schema.vpsDomains.id, reusable.id))
        .run()
      keepIds.add(reusable.id)
      upserted++
    } else {
      const id = generateId('vd')
      db.insert(schema.vpsDomains).values({ id, ...values }).run()
      keepIds.add(id)
      upserted++
    }
  } else {
    const byVpsId = new Map<string, VpsDomainDto>()
    for (const row of existing) {
      if (row.vpsId && !byVpsId.has(row.vpsId)) byVpsId.set(row.vpsId, row)
    }
    const unmatchedPool = existing.filter((r) => !r.vpsId)
    for (const vpsId of vpsIds) {
      const values = {
        ...fields,
        vpsId,
        matchStatus: 'matched' as const,
      }
      const row = byVpsId.get(vpsId) ?? unmatchedPool.shift()
      if (row) {
        db.update(schema.vpsDomains)
          .set(values)
          .where(eq(schema.vpsDomains.id, row.id))
          .run()
        keepIds.add(row.id)
      } else {
        const id = generateId('vd')
        db.insert(schema.vpsDomains).values({ id, ...values }).run()
        keepIds.add(id)
      }
      upserted++
    }
  }

  for (const row of existing) {
    if (keepIds.has(row.id)) continue
    db.delete(schema.vpsDomains).where(eq(schema.vpsDomains.id, row.id)).run()
    deleted++
  }

  return { upserted, deleted }
}

function addToSetMap(map: Map<string, Set<string>>, key: string, ids: string[]): void {
  const set = map.get(key) ?? new Set<string>()
  for (const id of ids) set.add(id)
  map.set(key, set)
}

function addServiceVps(map: Map<number, Set<string>>, serviceId: number, ids: string[]): void {
  const set = map.get(serviceId) ?? new Set<string>()
  for (const id of ids) set.add(id)
  map.set(serviceId, set)
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
    return listByCfdmBindingId(bindingId)[0]
  },

  deleteByCfdmBindingId(bindingId: number): boolean {
    return deleteAllByCfdmBindingId(bindingId)
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
    const vpsIdSet = new Set(allVps.map((v) => v.id))
    const byBinding = new Map<number, VpsDomainDto[]>()
    for (const row of rows) {
      const group = byBinding.get(row.cfdmBindingId) ?? []
      group.push(row)
      byBinding.set(row.cfdmBindingId, group)
    }

    let updated = 0
    const now = new Date().toISOString()
    for (const group of byBinding.values()) {
      const seed = group[0]!
      const storedIps = parseStoredIps(seed.targetIps)
      let wanted = storedIps.length > 0 ? findVpsIdsByIps(allVps, storedIps) : []
      if (wanted.length === 0) {
        const byDns = findVpsIdByDns(allVps, seed.fqdn)
        if (byDns) wanted = [byDns]
      }
      wanted = wanted.filter((id) => vpsIdSet.has(id))

      const hadMissingVps = group.some((r) => r.vpsId && !vpsIdSet.has(r.vpsId))
      const emptyStatus: 'unmatched' | 'orphaned' =
        wanted.length === 0 && hadMissingVps ? 'orphaned' : 'unmatched'

      const before = new Set(group.map((r) => `${r.vpsId ?? ''}:${r.matchStatus}`))
      const fields: BindingFields = {
        spaceId,
        fqdn: seed.fqdn,
        zoneName: seed.zoneName,
        hostname: seed.hostname,
        serviceName: seed.serviceName,
        serviceSlug: seed.serviceSlug,
        cfdmServiceId: seed.cfdmServiceId,
        cfdmBindingId: seed.cfdmBindingId,
        source: 'cfdm',
        targetIps: seed.targetIps ?? JSON.stringify(storedIps),
        syncedAt: now,
      }
      const result = reconcileBindingToVpsIds(db, group, fields, wanted, emptyStatus)
      const afterRows = listByCfdmBindingId(seed.cfdmBindingId)
      const after = new Set(afterRows.map((r) => `${r.vpsId ?? ''}:${r.matchStatus}`))
      const same =
        before.size === after.size && [...before].every((k) => after.has(k))
      if (!same) updated += result.upserted + result.deleted
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
    let deleted = 0
    let upserted = 0
    const keptBindingIds = new Set<number>()
    const fqdnToVpsIds = new Map<string, Set<string>>()
    const serviceMatchedVps = new Map<number, Set<string>>()
    const counters = { matched: 0, unmatched: 0 }

    const fieldsOf = (item: CfdmBindingSyncItem): BindingFields => ({
      spaceId,
      fqdn: item.fqdn,
      zoneName: item.zoneName,
      hostname: item.hostname,
      serviceName: item.serviceName,
      serviceSlug: item.serviceSlug,
      cfdmServiceId: item.serviceId,
      cfdmBindingId: item.bindingId,
      source: 'cfdm',
      targetIps: JSON.stringify(item.ips.filter(isIpLiteral)),
      syncedAt: now,
    })

    for (const item of items) {
      if (item.deleted) {
        if (deleteAllByCfdmBindingId(item.bindingId)) deleted++
        continue
      }

      keptBindingIds.add(item.bindingId)
      const vpsIds = findVpsIdsForBinding(allVps, item)
      if (vpsIds.length > 0) {
        counters.matched++
        addToSetMap(fqdnToVpsIds, normalizeHost(item.fqdn), vpsIds)
        addServiceVps(serviceMatchedVps, item.serviceId, vpsIds)
      } else {
        counters.unmatched++
      }

      const result = reconcileBindingToVpsIds(db, listByCfdmBindingId(item.bindingId), fieldsOf(item), vpsIds)
      upserted += result.upserted
      deleted += result.deleted
    }

    let inherited = true
    while (inherited) {
      inherited = false
      for (const item of items) {
        if (item.deleted || !item.cnameTarget) continue
        const existing = listByCfdmBindingId(item.bindingId)
        if (existing.some((r) => r.vpsId)) continue
        const parentIds = fqdnToVpsIds.get(normalizeHost(item.cnameTarget))
        if (!parentIds || parentIds.size === 0) continue
        const ids = [...parentIds]
        const wasUnmatched = existing.length === 0 || existing.every((r) => !r.vpsId)
        const result = reconcileBindingToVpsIds(db, existing, fieldsOf(item), ids)
        upserted += result.upserted
        deleted += result.deleted
        addToSetMap(fqdnToVpsIds, normalizeHost(item.fqdn), ids)
        addServiceVps(serviceMatchedVps, item.serviceId, ids)
        if (wasUnmatched) {
          counters.matched++
          counters.unmatched = Math.max(0, counters.unmatched - 1)
        }
        inherited = true
      }
    }

    for (const item of items) {
      if (item.deleted) continue
      const existing = listByCfdmBindingId(item.bindingId)
      if (existing.some((r) => r.vpsId)) continue
      const matched = serviceMatchedVps.get(item.serviceId)
      if (!matched || matched.size !== 1) continue
      const siblingVpsId = [...matched][0]!
      const wasUnmatched = existing.length === 0 || existing.every((r) => !r.vpsId)
      const result = reconcileBindingToVpsIds(db, existing, fieldsOf(item), [siblingVpsId])
      upserted += result.upserted
      deleted += result.deleted
      addToSetMap(fqdnToVpsIds, normalizeHost(item.fqdn), [siblingVpsId])
      if (wasUnmatched) {
        counters.matched++
        counters.unmatched = Math.max(0, counters.unmatched - 1)
      }
    }

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

    return {
      matched: counters.matched,
      unmatched: counters.unmatched,
      deleted,
      upserted,
    }
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
