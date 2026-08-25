import { and, desc, eq, isNotNull, isNull, like, or, sql } from 'drizzle-orm'
import type {
  IpregionGroup,
  IpregionRunStatus,
  IpregionStatus,
  IpregionSummary,
} from '@cfdm/shared/contracts/ipregion'
import { getDb, getSqlite, schema } from '../index.js'
import { getCurrentSpaceId } from '../space-context.js'
import { generateId } from './utils.js'
import { vpsRepository } from './vps.js'

type RunRow = typeof schema.ipregionRuns.$inferSelect
type ResultRow = typeof schema.ipregionResults.$inferSelect

export type IpregionResultDto = {
  id: string
  runId: string
  serviceKey: string
  serviceLabel: string
  group: IpregionGroup
  countryIpv4: string | null
  countryIpv6: string | null
  status: IpregionStatus
}

export type IpregionVpsInfo = {
  id: string
  ip: string
  dns: string
  providerId: string
  providerName: string
  country: string
  city: string
  datacenter: string
  vcpu: number
  ramGb: number
  diskGb: number
}

export type IpregionRunDto = {
  id: string
  spaceId: string
  runId: string
  probePublicIp: string
  claimedPublicIp: string | null
  matchedVpsId: string | null
  status: IpregionRunStatus
  schemaVersion: number
  launcherVersion: string | null
  ipregionVersion: string | null
  summary: IpregionSummary
  createdAt: string
  completedAt: string
  observedSourceIp: string | null
  detectedHoster: string | null
  vps: IpregionVpsInfo | null
  results?: IpregionResultDto[]
}

export type IpregionInsertResult = {
  serviceKey: string
  serviceLabel: string
  group: IpregionGroup
  countryIpv4: string | null
  countryIpv6: string | null
  status: IpregionStatus
}

export type IpregionInsertRun = {
  spaceId: string
  runId: string
  probePublicIp: string
  claimedPublicIp: string | null
  matchedVpsId: string | null
  status: IpregionRunStatus
  schemaVersion: number
  launcherVersion: string | null
  ipregionVersion: string | null
  summary: IpregionSummary
  observedSourceIp: string | null
  detectedHoster: string | null
  results: IpregionInsertResult[]
}

export type IpregionHistoryQuery = {
  cursor?: string
  limit?: number
  q?: string
  status?: string
  matched?: boolean
}

function parseSummary(raw: string | null | undefined): IpregionSummary {
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<IpregionSummary>) : {}
    return {
      total: Number(parsed.total) || 0,
      ok: Number(parsed.ok) || 0,
      na: Number(parsed.na) || 0,
      denied: Number(parsed.denied) || 0,
      rate_limit: Number(parsed.rate_limit) || 0,
      server_error: Number(parsed.server_error) || 0,
    }
  } catch {
    return {
      total: 0,
      ok: 0,
      na: 0,
      denied: 0,
      rate_limit: 0,
      server_error: 0,
    }
  }
}

function toResultDto(row: ResultRow): IpregionResultDto {
  return {
    id: row.id,
    runId: row.runId,
    serviceKey: row.serviceKey,
    serviceLabel: row.serviceLabel,
    group: row.serviceGroup as IpregionGroup,
    countryIpv4: row.countryIpv4 ?? null,
    countryIpv6: row.countryIpv6 ?? null,
    status: row.status as IpregionStatus,
  }
}

function providerNameById(providerId: string): string {
  if (!providerId) return ''
  const row = getDb()
    .select({ name: schema.providers.name })
    .from(schema.providers)
    .where(eq(schema.providers.id, providerId))
    .get()
  return row?.name ?? ''
}

function hydrateVps(matchedVpsId: string | null): IpregionVpsInfo | null {
  if (!matchedVpsId) return null
  const vps = vpsRepository.getAnySpace(matchedVpsId)
  if (!vps) return null
  return {
    id: vps.id,
    ip: vps.ip ?? '',
    dns: vps.dns ?? '',
    providerId: vps.providerId ?? '',
    providerName: providerNameById(vps.providerId ?? ''),
    country: vps.country ?? '',
    city: vps.city ?? '',
    datacenter: vps.datacenter ?? '',
    vcpu: Number(vps.vcpu) || 0,
    ramGb: Number(vps.ramGb) || 0,
    diskGb: Number(vps.diskGb) || 0,
  }
}

function toRunDto(row: RunRow, includeResults = false): IpregionRunDto {
  const dto: IpregionRunDto = {
    id: row.id,
    spaceId: row.spaceId,
    runId: row.runId,
    probePublicIp: row.probePublicIp,
    claimedPublicIp: row.claimedPublicIp ?? null,
    matchedVpsId: row.matchedVpsId ?? null,
    status: row.status as IpregionRunStatus,
    schemaVersion: row.schemaVersion,
    launcherVersion: row.launcherVersion ?? null,
    ipregionVersion: row.ipregionVersion ?? null,
    summary: parseSummary(row.summaryJson),
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    observedSourceIp: row.observedSourceIp ?? null,
    detectedHoster: row.detectedHoster ?? null,
    vps: hydrateVps(row.matchedVpsId ?? null),
  }
  if (includeResults) {
    dto.results = listResults(row.id)
  }
  return dto
}

function listResults(internalRunId: string): IpregionResultDto[] {
  return getDb()
    .select()
    .from(schema.ipregionResults)
    .where(eq(schema.ipregionResults.runId, internalRunId))
    .all()
    .map(toResultDto)
}

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, 'utf8').toString('base64url')
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8')
    const idx = raw.indexOf('|')
    if (idx <= 0) return null
    return { createdAt: raw.slice(0, idx), id: raw.slice(idx + 1) }
  } catch {
    return null
  }
}

export const ipregionRepository = {
  getByClientRunId(runId: string): IpregionRunDto | undefined {
    const row = getDb()
      .select()
      .from(schema.ipregionRuns)
      .where(eq(schema.ipregionRuns.runId, runId))
      .get()
    return row ? toRunDto(row, true) : undefined
  },

  getById(id: string): IpregionRunDto | undefined {
    const spaceId = getCurrentSpaceId()
    const row = getDb()
      .select()
      .from(schema.ipregionRuns)
      .where(and(eq(schema.ipregionRuns.id, id), eq(schema.ipregionRuns.spaceId, spaceId)))
      .get()
    return row ? toRunDto(row, true) : undefined
  },

  create(input: IpregionInsertRun): IpregionRunDto {
    const db = getDb()
    const now = new Date().toISOString()
    const id = generateId('iprun')
    db.transaction(() => {
      db.insert(schema.ipregionRuns)
        .values({
          id,
          spaceId: input.spaceId,
          runId: input.runId,
          probePublicIp: input.probePublicIp,
          claimedPublicIp: input.claimedPublicIp,
          matchedVpsId: input.matchedVpsId,
          status: input.status,
          schemaVersion: input.schemaVersion,
          launcherVersion: input.launcherVersion,
          ipregionVersion: input.ipregionVersion,
          summaryJson: JSON.stringify(input.summary),
          createdAt: now,
          completedAt: now,
          observedSourceIp: input.observedSourceIp,
          detectedHoster: input.detectedHoster,
        })
        .run()
      for (const result of input.results) {
        db.insert(schema.ipregionResults)
          .values({
            id: generateId('ipres'),
            runId: id,
            serviceKey: result.serviceKey,
            serviceLabel: result.serviceLabel,
            serviceGroup: result.group,
            countryIpv4: result.countryIpv4,
            countryIpv6: result.countryIpv6,
            status: result.status,
          })
          .run()
      }
    })
    return this.getByClientRunId(input.runId)!
  },

  listCurrent(): IpregionRunDto[] {
    const spaceId = getCurrentSpaceId()
    const sqlite = getSqlite()
    const rows = sqlite
      .prepare(
        `SELECT * FROM ipregion_runs r
         WHERE r.spaceId = ?
           AND r.id = (
             SELECT r2.id FROM ipregion_runs r2
             WHERE r2.spaceId = r.spaceId AND r2.probePublicIp = r.probePublicIp
             ORDER BY r2.createdAt DESC, r2.id DESC
             LIMIT 1
           )
         ORDER BY r.createdAt DESC`,
      )
      .all(spaceId) as RunRow[]
    return rows.map((row) => toRunDto(row, true))
  },

  listHistory(query: IpregionHistoryQuery = {}): {
    items: IpregionRunDto[]
    nextCursor: string | null
  } {
    const spaceId = getCurrentSpaceId()
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200)
    const q = query.q?.trim()
    const clauses = [eq(schema.ipregionRuns.spaceId, spaceId)]

    if (q) {
      const pattern = `%${q}%`
      clauses.push(
        or(
          like(schema.ipregionRuns.probePublicIp, pattern),
          like(schema.ipregionRuns.claimedPublicIp, pattern),
          like(schema.ipregionRuns.runId, pattern),
          like(schema.ipregionRuns.detectedHoster, pattern),
        )!,
      )
    }
    if (query.status) {
      clauses.push(eq(schema.ipregionRuns.status, query.status))
    }
    if (query.matched === true) {
      clauses.push(isNotNull(schema.ipregionRuns.matchedVpsId))
    } else if (query.matched === false) {
      clauses.push(isNull(schema.ipregionRuns.matchedVpsId))
    }

    const cursor = query.cursor ? decodeCursor(query.cursor) : null
    if (cursor) {
      clauses.push(
        sql`(${schema.ipregionRuns.createdAt} < ${cursor.createdAt} OR (${schema.ipregionRuns.createdAt} = ${cursor.createdAt} AND ${schema.ipregionRuns.id} < ${cursor.id}))`,
      )
    }

    const rows = getDb()
      .select()
      .from(schema.ipregionRuns)
      .where(and(...clauses))
      .orderBy(desc(schema.ipregionRuns.createdAt), desc(schema.ipregionRuns.id))
      .limit(limit + 1)
      .all()

    const page = rows.slice(0, limit)
    const last = page[page.length - 1]
    return {
      items: page.map((row) => toRunDto(row, true)),
      nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
    }
  },
}
