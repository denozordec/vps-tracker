import {
  emptyCensorcheckSummary,
  inferCensorcheckCategory,
  type CensorcheckCategory,
  type CensorcheckIngestResult,
  type CensorcheckRunStatus,
  type CensorcheckStatus,
  type CensorcheckSummary,
} from '@cfdm/shared/contracts/censorcheck'

function parseHttpStatus(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function protocolStatus(proto: unknown): { httpStatus: number | null; redirectUrl?: string } {
  if (!proto || typeof proto !== 'object') return { httpStatus: null }
  const rec = proto as { status?: unknown; redirect_url?: unknown }
  const redirectUrl = typeof rec.redirect_url === 'string' ? rec.redirect_url : undefined
  return { httpStatus: parseHttpStatus(rec.status), redirectUrl }
}

function pickPrimaryProtocol(raw: Record<string, unknown>): {
  httpStatus: number | null
  redirectUrl?: string
} {
  const https = raw.https
  if (https && typeof https === 'object') {
    const ipv4 = (https as { ipv4?: unknown }).ipv4
    if (ipv4) return protocolStatus(ipv4)
  }
  const http = raw.http
  if (http && typeof http === 'object') {
    const ipv4 = (http as { ipv4?: unknown }).ipv4
    if (ipv4) return protocolStatus(ipv4)
  }
  return { httpStatus: null }
}

export function statusFromHttpCode(code: number | null): CensorcheckStatus {
  if (code == null) return 'error'
  if (code === 200) return 'available'
  if (code === 403) return 'denied'
  if (code >= 300 && code < 400) return 'redirected'
  if (code === 0) return 'timeout'
  if (code === -1) return 'blocked'
  if (code >= 400) return 'denied'
  return 'error'
}

export function statusFromErrorCode(code: string | undefined): CensorcheckStatus {
  if (code === 'blocked_by_ip') return 'blocked'
  return 'error'
}

export type NormalizedServiceResult = {
  serviceKey: string
  serviceLabel: string
  category: CensorcheckCategory
  status: CensorcheckStatus
  httpStatus: number | null
  detail: string | null
  rawJson: string | null
}

function compactRaw(raw: Record<string, unknown>): string | null {
  try {
    const compact: Record<string, unknown> = {}
    if (raw.service != null) compact.service = raw.service
    if (raw.error != null) compact.error = raw.error
    if (raw.error_code != null) compact.error_code = raw.error_code
    if (raw.http != null) compact.http = raw.http
    if (raw.https != null) compact.https = raw.https
    return JSON.stringify(compact)
  } catch {
    return null
  }
}

export function normalizeIngestResult(item: CensorcheckIngestResult): NormalizedServiceResult {
  const serviceKey = item.service.trim().toLowerCase()
  const raw = item.raw ?? {}
  const errorCode = typeof raw.error_code === 'string' ? raw.error_code : undefined
  const errorText = typeof raw.error === 'string' ? raw.error : undefined
  const primary = pickPrimaryProtocol(raw)

  let status: CensorcheckStatus
  let httpStatus = primary.httpStatus
  let detail: string | null = primary.redirectUrl ?? errorText ?? null

  if (errorCode || (raw.http == null && raw.https == null && errorText)) {
    status = statusFromErrorCode(errorCode)
    if (!detail) detail = errorCode ?? errorText ?? null
  } else {
    status = statusFromHttpCode(httpStatus)
  }

  return {
    serviceKey,
    serviceLabel: item.service.trim(),
    category: item.category ?? inferCensorcheckCategory(serviceKey),
    status,
    httpStatus,
    detail,
    rawJson: compactRaw(raw),
  }
}

export function summarizeResults(results: { status: CensorcheckStatus }[]): {
  summary: CensorcheckSummary
  runStatus: CensorcheckRunStatus
} {
  const summary = emptyCensorcheckSummary()
  summary.total = results.length
  for (const row of results) {
    summary[row.status] += 1
  }
  const runStatus: CensorcheckRunStatus =
    summary.timeout > 0 || summary.error > 0 ? 'partial' : 'complete'
  return { summary, runStatus }
}
