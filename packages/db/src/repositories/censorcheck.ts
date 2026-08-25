import { and, desc, eq, isNotNull, isNull, like, or, sql } from 'drizzle-orm'
import type {
  CensorcheckCategory,
  CensorcheckRunStatus,
  CensorcheckStatus,
  CensorcheckSummary,
} from '@cfdm/shared/contracts/censorcheck'
import { getDb, getSqlite, schema } from '../index.js'
import { getCurrentSpaceId } from '../space-context.js'
import { generateId } from './utils.js'
import { vpsRepository } from './vps.js'

type RunRow = typeof schema.censorcheckRuns.$inferSelect
type ResultRow = typeof schema.censorcheckResults.$inferSelect

export type CensorcheckResultDto = {
  id: string
  runId: string
  serviceKey: string
  serviceLabel: string
  category: CensorcheckCategory
  status: CensorcheckStatus
  httpStatus: number | null
  detail: string | null
  rawJson: string | null
}

export type CensorcheckVpsInfo = {
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

export type CensorcheckRunDto = {
  id: string
  spaceId: string
  runId: string
  probePublicIp: string
  claimedPublicIp: string | null
  matchedVpsId: string | null
  status: CensorcheckRunStatus
  schemaVersion: number
  launcherVersion: string | null
  censorcheckVersion: string | null
  summary: CensorcheckSummary
  createdAt: string
  completedAt: string
  observedSourceIp: string | null
  detectedHoster: string | null
  vps: CensorcheckVpsInfo | null
  results?: CensorcheckResultDto[]
}

export type CensorcheckInsertResult = {
  serviceKey: string
  serviceLabel: string
  category: CensorcheckCategory
  status: CensorcheckStatus
  httpStatus: number | null
  detail: string | null
  rawJson: string | null
}

export type CensorcheckInsertRun = {
  spaceId: string
  runId: string
  probePublicIp: string
  claimedPublicIp: string | null
  matchedVpsId: string | null
  status: CensorcheckRunStatus
  schemaVersion: number
  launcherVersion: string | null
  censorcheckVersion: string | null
  summary: CensorcheckSummary
  observedSourceIp: string | null
  detectedHoster: string | null
  results: CensorcheckInsertResult[]
}

export type CensorcheckHistoryQuery = {
  cursor?: string
  limit?: number
  q?: string
  status?: string
  matched?: boolean
}

function parseSummary(raw: string | null | undefined): CensorcheckSummary {
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<CensorcheckSummary>) : {}
    return {
      total: Number(parsed.total) || 0,
      available: Number(parsed.available) || 0,
      redirected: Number(parsed.redirected) || 0,
      denied: Number(parsed.denied) || 0,
      blocked: Number(parsed.blocked) || 0,
      timeout: Number(parsed.timeout) || 0,
      error: Number(parsed.error) || 0,
    }
  } catch {
    return {
      total: 0,
      available: 0,
      redirected: 0,
      denied: 0,
      blocked: 0,
      timeout: 0,
      error: 0,
    }
  }
}

function toResultDto(row: ResultRow): CensorcheckResultDto {
  return {
    id: row.id,
    runId: row.runId,
    serviceKey: row.serviceKey,
    serviceLabel: row.serviceLabel,
    category: row.category as CensorcheckCategory,
    status: row.status as CensorcheckStatus,
    httpStatus: row.httpStatus ?? null,
    detail: row.detail ?? null,
    rawJson: row.rawJson ?? null,
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

function hydrateVps(matchedVpsId: string | null): CensorcheckVpsInfo | null {
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

function toRunDto(row: RunRow, includeResults = false): CensorcheckRunDto {
  const dto: CensorcheckRunDto = {
    id: row.id,
    spaceId: row.spaceId,
    runId: row.runId,
    probePublicIp: row.probePublicIp,
    claimedPublicIp: row.claimedPublicIp ?? null,
    matchedVpsId: row.matchedVpsId ?? null,
    status: row.status as CensorcheckRunStatus,
    schemaVersion: row.schemaVersion,
    launcherVersion: row.launcherVersion ?? null,
    censorcheckVersion: row.censorcheckVersion ?? null,
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

function listResults(internalRunId: string): CensorcheckResultDto[] {
  return getDb()
    .select()
    .from(schema.censorcheckResults)
    .where(eq(schema.censorcheckResults.runId, internalRunId))
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

export const censorcheckRepository = {
  getByClientRunId(runId: string): CensorcheckRunDto | undefined {
    const row = getDb()
      .select()
      .from(schema.censorcheckRuns)
      .where(eq(schema.censorcheckRuns.runId, runId))
      .get()
    return row ? toRunDto(row, true) : undefined
  },

  getById(id: string): CensorcheckRunDto | undefined {
    const spaceId = getCurrentSpaceId()
    const row = getDb()
      .select()
      .from(schema.censorcheckRuns)
      .where(and(eq(schema.censorcheckRuns.id, id), eq(schema.censorcheckRuns.spaceId, spaceId)))
      .get()
    return row ? toRunDto(row, true) : undefined
  },

  create(input: CensorcheckInsertRun): CensorcheckRunDto {
    const db = getDb()
    const now = new Date().toISOString()
    const id = generateId('ccrun')
    db.transaction(() => {
      db.insert(schema.censorcheckRuns)
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
          censorcheckVersion: input.censorcheckVersion,
          summaryJson: JSON.stringify(input.summary),
          createdAt: now,
          completedAt: now,
          observedSourceIp: input.observedSourceIp,
          detectedHoster: input.detectedHoster,
        })
        .run()
      for (const result of input.results) {
        db.insert(schema.censorcheckResults)
          .values({
            id: generateId('ccres'),
            runId: id,
            serviceKey: result.serviceKey,
            serviceLabel: result.serviceLabel,
            category: result.category,
            status: result.status,
            httpStatus: result.httpStatus,
            detail: result.detail,
            rawJson: result.rawJson,
          })
          .run()
      }
    })
    return this.getByClientRunId(input.runId)!
  },

  listCurrent(): CensorcheckRunDto[] {
    const spaceId = getCurrentSpaceId()
    const sqlite = getSqlite()
    const rows = sqlite
      .prepare(
        `SELECT * FROM censorcheck_runs r
         WHERE r.spaceId = ?
           AND r.id = (
             SELECT r2.id FROM censorcheck_runs r2
             WHERE r2.spaceId = r.spaceId AND r2.probePublicIp = r.probePublicIp
             ORDER BY r2.createdAt DESC, r2.id DESC
             LIMIT 1
           )
         ORDER BY r.createdAt DESC`,
      )
      .all(spaceId) as RunRow[]
    return rows.map((row) => toRunDto(row, true))
  },

  listHistory(query: CensorcheckHistoryQuery = {}): {
    items: CensorcheckRunDto[]
    nextCursor: string | null
  } {
    const spaceId = getCurrentSpaceId()
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200)
    const q = query.q?.trim()
    const clauses = [eq(schema.censorcheckRuns.spaceId, spaceId)]

    if (q) {
      const pattern = `%${q}%`
      clauses.push(
        or(
          like(schema.censorcheckRuns.probePublicIp, pattern),
          like(schema.censorcheckRuns.claimedPublicIp, pattern),
          like(schema.censorcheckRuns.runId, pattern),
          like(schema.censorcheckRuns.detectedHoster, pattern),
        )!,
      )
    }
    if (query.status) {
      clauses.push(eq(schema.censorcheckRuns.status, query.status))
    }
    if (query.matched === true) {
      clauses.push(isNotNull(schema.censorcheckRuns.matchedVpsId))
    } else if (query.matched === false) {
      clauses.push(isNull(schema.censorcheckRuns.matchedVpsId))
    }

    const cursor = query.cursor ? decodeCursor(query.cursor) : null
    if (cursor) {
      clauses.push(
        sql`(${schema.censorcheckRuns.createdAt} < ${cursor.createdAt} OR (${schema.censorcheckRuns.createdAt} = ${cursor.createdAt} AND ${schema.censorcheckRuns.id} < ${cursor.id}))`,
      )
    }

    const rows = getDb()
      .select()
      .from(schema.censorcheckRuns)
      .where(and(...clauses))
      .orderBy(desc(schema.censorcheckRuns.createdAt), desc(schema.censorcheckRuns.id))
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
