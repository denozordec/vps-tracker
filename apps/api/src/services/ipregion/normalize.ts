import {
  canonicalizeCountryValue,
  emptyIpregionSummary,
  inferIpregionGroup,
  type IpregionGroup,
  type IpregionIngestResult,
  type IpregionRunStatus,
  type IpregionStatus,
  type IpregionSummary,
} from '@cfdm/shared/contracts/ipregion'

export type NormalizedIpregionResult = {
  serviceKey: string
  serviceLabel: string
  group: IpregionGroup
  countryIpv4: string | null
  countryIpv6: string | null
  status: IpregionStatus
}

export function normalizeIngestResult(item: IpregionIngestResult): NormalizedIpregionResult {
  const serviceLabel = item.service.trim()
  const serviceKey = serviceLabel.toLowerCase()
  const ipv4 = canonicalizeCountryValue(item.ipv4)
  const ipv6 = canonicalizeCountryValue(item.ipv6)
  const status = ipv4.status !== 'na' ? ipv4.status : ipv6.status

  return {
    serviceKey,
    serviceLabel,
    group: item.group ?? inferIpregionGroup(serviceKey),
    countryIpv4: ipv4.country,
    countryIpv6: ipv6.country,
    status,
  }
}

export function summarizeResults(results: { status: IpregionStatus }[]): {
  summary: IpregionSummary
  runStatus: IpregionRunStatus
} {
  const summary = emptyIpregionSummary()
  summary.total = results.length
  for (const row of results) {
    summary[row.status] += 1
  }
  const runStatus: IpregionRunStatus =
    summary.denied > 0 || summary.rate_limit > 0 || summary.server_error > 0
      ? 'partial'
      : 'complete'
  return { summary, runStatus }
}
