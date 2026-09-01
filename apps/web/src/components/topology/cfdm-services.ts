import type { TopologyLbMode } from '@cfdm/shared/contracts/integration-cfdm'
import type { VpsDomain } from '@/types/entities'
import { isTopologyLbMode } from './types'

export type CfdmTopologyService = {
  serviceId: number
  name: string
  slug: string
  lbMode?: TopologyLbMode
  fqdns: string[]
  matchedVpsIds: string[]
  unmatchedIps: string[]
}

function parseTargetIps(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** Группирует vps_domains по сервису CFDM для пикера на схеме. */
export function aggregateCfdmServices(domains: VpsDomain[]): CfdmTopologyService[] {
  const byService = new Map<
    number,
    {
      name: string
      slug: string
      lbMode?: TopologyLbMode
      fqdns: Set<string>
      matchedVpsIds: Set<string>
      unmatchedIps: Set<string>
    }
  >()

  for (const row of domains) {
    if (row.source && row.source !== 'cfdm') continue
    let bucket = byService.get(row.cfdmServiceId)
    if (!bucket) {
      bucket = {
        name: row.serviceName,
        slug: row.serviceSlug,
        fqdns: new Set(),
        matchedVpsIds: new Set(),
        unmatchedIps: new Set(),
      }
      byService.set(row.cfdmServiceId, bucket)
    }
    if (row.fqdn) bucket.fqdns.add(row.fqdn)
    if (isTopologyLbMode(row.lbMode)) bucket.lbMode = row.lbMode
    if (row.vpsId && row.matchStatus === 'matched') {
      bucket.matchedVpsIds.add(row.vpsId)
    } else {
      for (const ip of parseTargetIps(row.targetIps)) bucket.unmatchedIps.add(ip)
    }
  }

  return [...byService.entries()]
    .map(([serviceId, b]) => ({
      serviceId,
      name: b.name,
      slug: b.slug,
      lbMode: b.lbMode,
      fqdns: [...b.fqdns].sort(),
      matchedVpsIds: [...b.matchedVpsIds],
      unmatchedIps: [...b.unmatchedIps],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}
