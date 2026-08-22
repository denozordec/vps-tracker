import { getActiveFilters } from '@/components/reui-kit'
import type { Filter } from '@/components/reui/filters'
import { runSearchText, type CensorcheckRunDto } from './types'

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
