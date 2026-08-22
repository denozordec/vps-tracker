import { getActiveFilters } from '@/components/reui-kit'
import type { Filter } from '@/components/reui/filters'
import {
  CENSORCHECK_DPI_HOSTS,
  CENSORCHECK_GEOBLOCK_HOSTS,
  inferCensorcheckCategory,
} from '@cfdm/shared/contracts/censorcheck'
import {
  runSearchText,
  type CensorcheckResultDto,
  type CensorcheckRunDto,
} from './types'

export function filterCensorcheckRuns(
  runs: CensorcheckRunDto[],
  filters: Filter[],
): CensorcheckRunDto[] {
  const active = getActiveFilters(filters)
  if (active.length === 0) return runs

  return runs.filter((run) => {
    for (const filter of active) {
      const values = filter.values.map((value) => String(value))
      if (filter.field === 'status') {
        const statuses = (run.results ?? []).map((row) => row.status)
        const hit = values.some((value) => statuses.includes(value))
        if (filter.operator === 'is_not_any_of' ? hit : !hit) return false
        continue
      }
      if (filter.field === 'service') {
        const hay = (run.results ?? [])
          .map((row) => `${row.serviceKey} ${row.serviceLabel}`)
          .join(' ')
          .toLowerCase()
        const hit = values.some((value) =>
          hay.includes(value.toLowerCase()) || (run.results ?? []).some((row) => row.serviceKey === value),
        )
        if (!hit) return false
        continue
      }
      if (filter.field === 'hoster') {
        const name = (run.vps?.providerName ?? '').toLowerCase()
        const hit = values.some((value) => name.includes(value.toLowerCase()) || name === value.toLowerCase())
        if (!hit) return false
        continue
      }
      if (filter.field === 'country') {
        const country = (run.vps?.country ?? '').toLowerCase()
        const hit = values.some((value) => country.includes(value.toLowerCase()) || country === value.toLowerCase())
        if (!hit) return false
        continue
      }
      if (filter.field === 'matched') {
        const matched = run.matchedVpsId ? 'matched' : 'unmatched'
        if (!values.includes(matched)) return false
        continue
      }
      if (filter.field === 'q') {
        const hay = runSearchText(run)
        const hit = values.some((token) => hay.includes(token.toLowerCase()))
        if (!hit) return false
      }
    }
    return true
  })
}

export type BlockingServiceRow = {
  id: string
  serviceKey: string
  serviceLabel: string
  category: string
  probes: Array<{
    runId: string
    probePublicIp: string
    matchedVpsId: string | null
    dns: string
    country: string
    status: string
    httpStatus: number | null
    createdAt: string
    vpsId: string | null
  }>
}

export function groupRunsByService(runs: CensorcheckRunDto[]): BlockingServiceRow[] {
  const map = new Map<string, BlockingServiceRow>()
  for (const run of runs) {
    for (const result of run.results ?? []) {
      const existing = map.get(result.serviceKey)
      const probe = {
        runId: run.id,
        probePublicIp: run.probePublicIp,
        matchedVpsId: run.matchedVpsId,
        dns: run.vps?.dns ?? '',
        country: run.vps?.country ?? '',
        status: result.status,
        httpStatus: result.httpStatus,
        createdAt: run.createdAt,
        vpsId: run.matchedVpsId,
      }
      if (existing) {
        existing.probes.push(probe)
      } else {
        map.set(result.serviceKey, {
          id: result.serviceKey,
          serviceKey: result.serviceKey,
          serviceLabel: result.serviceLabel,
          category: result.category,
          probes: [probe],
        })
      }
    }
  }
  return [...map.values()].sort((a, b) => a.serviceKey.localeCompare(b.serviceKey))
}

export type MatrixColumn = {
  key: string
  label: string
  title: string
}

export function shortHostLabel(value: string): string {
  const host = value.trim().split('/')[0] ?? value
  return host.replace(/\.(com|org|net|io|ag|is)$/i, '')
}

const CANONICAL_SERVICES = [...CENSORCHECK_DPI_HOSTS, ...CENSORCHECK_GEOBLOCK_HOSTS]

export function collectServiceColumns(runs: CensorcheckRunDto[]): MatrixColumn[] {
  const canonicalSet = new Set<string>(CANONICAL_SERVICES)
  const extras = new Set<string>()
  for (const run of runs) {
    for (const result of run.results ?? []) {
      if (!canonicalSet.has(result.serviceKey)) extras.add(result.serviceKey)
    }
  }
  const keys = [
    ...CANONICAL_SERVICES,
    ...[...extras].sort((a, b) => a.localeCompare(b)),
  ]
  return keys.map((key) => ({
    key,
    label: shortHostLabel(key),
    title: key,
  }))
}

export function collectProbeColumns(runs: CensorcheckRunDto[]): MatrixColumn[] {
  return runs.map((run) => {
    const title = run.vps?.dns || run.probePublicIp
    return {
      key: run.id,
      label: shortHostLabel(title),
      title,
    }
  })
}

export function resultByService(
  run: CensorcheckRunDto,
  serviceKey: string,
): CensorcheckResultDto | undefined {
  return (run.results ?? []).find((row) => row.serviceKey === serviceKey)
}

export function serviceMatrixRows(runs: CensorcheckRunDto[]): BlockingServiceRow[] {
  const grouped = new Map(groupRunsByService(runs).map((row) => [row.serviceKey, row]))
  return collectServiceColumns(runs).map((col) => {
    const existing = grouped.get(col.key)
    if (existing) return existing
    return {
      id: col.key,
      serviceKey: col.key,
      serviceLabel: col.key,
      category: inferCensorcheckCategory(col.key),
      probes: [],
    }
  })
}
