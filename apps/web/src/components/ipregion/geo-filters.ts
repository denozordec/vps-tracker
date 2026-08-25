import { COUNTRY_BY_CODE, COUNTRY_BY_NAME_RU } from '@cfdm/shared/geo'
import {
  IPREGION_CDN_SERVICES,
  IPREGION_CUSTOM_SERVICES,
  IPREGION_PRIMARY_SERVICES,
} from '@cfdm/shared/contracts/ipregion'
import { getActiveFilters } from '@/components/reui-kit'
import type { Filter } from '@/components/reui/filters'
import {
  runSearchText,
  type IpregionResultDto,
  type IpregionRunDto,
} from './types'

const GROUP_RANK: Record<string, number> = { primary: 0, custom: 1, cdn: 2 }

export function inventoryCountryCode(run: IpregionRunDto): string | null {
  const raw = run.vps?.country?.trim() ?? ''
  if (!raw) return null
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase()
  return COUNTRY_BY_NAME_RU[raw.toLowerCase()]?.code ?? COUNTRY_BY_CODE[raw.toUpperCase()]?.code ?? null
}

export function countryName(code: string | null | undefined): string {
  if (!code) return ''
  return COUNTRY_BY_CODE[code.toUpperCase()]?.name ?? code
}

export function majorityCountry(run: IpregionRunDto): string | null {
  const counts = new Map<string, number>()
  for (const row of run.results ?? []) {
    const code = row.countryIpv4 || row.countryIpv6
    if (row.status !== 'ok' || !code) continue
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code
      bestCount = count
    }
  }
  return best
}

export function isGeoMismatch(run: IpregionRunDto): boolean {
  const inventory = inventoryCountryCode(run)
  const geo = majorityCountry(run)
  if (!inventory || !geo) return false
  return inventory !== geo
}

export function uniqueCountries(runs: IpregionRunDto[]): string[] {
  const set = new Set<string>()
  for (const run of runs) {
    for (const row of run.results ?? []) {
      if (row.status === 'ok' && row.countryIpv4) set.add(row.countryIpv4)
      if (row.status === 'ok' && row.countryIpv6) set.add(row.countryIpv6)
    }
  }
  return [...set].sort()
}

export function filterIpregionRuns(runs: IpregionRunDto[], filters: Filter[]): IpregionRunDto[] {
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
        const hit = values.some(
          (value) =>
            hay.includes(value.toLowerCase()) ||
            (run.results ?? []).some((row) => row.serviceKey === value.toLowerCase()),
        )
        if (!hit) return false
        continue
      }
      if (filter.field === 'hoster') {
        const name = `${run.vps?.providerName ?? ''} ${run.detectedHoster ?? ''}`.toLowerCase()
        const hit = values.some((value) => name.includes(value.toLowerCase()) || name === value.toLowerCase())
        if (!hit) return false
        continue
      }
      if (filter.field === 'country') {
        const codes = [
          inventoryCountryCode(run) ?? '',
          majorityCountry(run) ?? '',
          ...(run.results ?? []).flatMap((row) => [row.countryIpv4 ?? '', row.countryIpv6 ?? '']),
        ]
          .join(' ')
          .toLowerCase()
        const names = countryName(majorityCountry(run)).toLowerCase()
        const hay = `${codes} ${names} ${(run.vps?.country ?? '').toLowerCase()}`
        const hit = values.some((value) => hay.includes(value.toLowerCase()))
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

export type GeoServiceRow = {
  id: string
  serviceKey: string
  serviceLabel: string
  group: string
  probes: Array<{
    runId: string
    probePublicIp: string
    matchedVpsId: string | null
    dns: string
    country: string | null
    status: string
    countryIpv4: string | null
    countryIpv6: string | null
    createdAt: string
    vpsId: string | null
  }>
}

export function groupRunsByService(runs: IpregionRunDto[]): GeoServiceRow[] {
  const map = new Map<string, GeoServiceRow>()
  for (const run of runs) {
    for (const result of run.results ?? []) {
      const existing = map.get(result.serviceKey)
      const probe = {
        runId: run.id,
        probePublicIp: run.probePublicIp,
        matchedVpsId: run.matchedVpsId,
        dns: run.vps?.dns ?? '',
        country: result.countryIpv4,
        status: result.status,
        countryIpv4: result.countryIpv4,
        countryIpv6: result.countryIpv6,
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
          group: result.group,
          probes: [probe],
        })
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    const rank = (GROUP_RANK[a.group] ?? 9) - (GROUP_RANK[b.group] ?? 9)
    if (rank !== 0) return rank
    return a.serviceKey.localeCompare(b.serviceKey)
  })
}

export type MatrixColumn = {
  key: string
  label: string
  title: string
  group: string
}

export function shortServiceLabel(value: string): string {
  const host = value.trim()
  if (host.length <= 14) return host
  return host.replace(/\.(com|org|net|io|co)$/i, '')
}

function canonicalKeys(): Array<{ key: string; group: string; label: string }> {
  return [
    ...IPREGION_PRIMARY_SERVICES.map((key) => ({ key, group: 'primary', label: key })),
    ...IPREGION_CUSTOM_SERVICES.map((key) => ({ key, group: 'custom', label: key })),
    ...IPREGION_CDN_SERVICES.map((key) => ({ key, group: 'cdn', label: key })),
  ]
}

export function collectServiceColumns(runs: IpregionRunDto[]): MatrixColumn[] {
  const canonical = canonicalKeys()
  const canonicalSet = new Set(canonical.map((item) => item.key))
  const extras: MatrixColumn[] = []
  for (const run of runs) {
    for (const result of run.results ?? []) {
      if (canonicalSet.has(result.serviceKey)) continue
      if (extras.some((col) => col.key === result.serviceKey)) continue
      extras.push({
        key: result.serviceKey,
        label: shortServiceLabel(result.serviceLabel),
        title: result.serviceLabel,
        group: result.group,
      })
    }
  }
  extras.sort((a, b) => {
    const rank = (GROUP_RANK[a.group] ?? 9) - (GROUP_RANK[b.group] ?? 9)
    if (rank !== 0) return rank
    return a.key.localeCompare(b.key)
  })
  const extrasByGroup = {
    primary: extras.filter((col) => col.group === 'primary'),
    custom: extras.filter((col) => col.group === 'custom'),
    cdn: extras.filter((col) => col.group === 'cdn'),
  }
  const fromCanonical = (group: string, keys: readonly string[]) =>
    keys.map((key) => ({
      key,
      label: shortServiceLabel(key),
      title: key,
      group,
    }))
  return [
    ...fromCanonical('primary', IPREGION_PRIMARY_SERVICES),
    ...extrasByGroup.primary,
    ...fromCanonical('custom', IPREGION_CUSTOM_SERVICES),
    ...extrasByGroup.custom,
    ...fromCanonical('cdn', IPREGION_CDN_SERVICES),
    ...extrasByGroup.cdn,
  ]
}

export function collectProbeColumns(runs: IpregionRunDto[]): MatrixColumn[] {
  return runs.map((run) => {
    const title = run.vps?.dns || run.probePublicIp
    return {
      key: run.id,
      label: shortServiceLabel(title),
      title,
      group: 'probe',
    }
  })
}

export function resultByService(
  run: IpregionRunDto,
  serviceKey: string,
): IpregionResultDto | undefined {
  return (run.results ?? []).find((row) => row.serviceKey === serviceKey)
}

export function serviceMatrixRows(runs: IpregionRunDto[]): GeoServiceRow[] {
  const grouped = new Map(groupRunsByService(runs).map((row) => [row.serviceKey, row]))
  return collectServiceColumns(runs).map((col) => {
    const existing = grouped.get(col.key)
    if (existing) return existing
    return {
      id: col.key,
      serviceKey: col.key,
      serviceLabel: col.title,
      group: col.group,
      probes: [],
    }
  })
}
