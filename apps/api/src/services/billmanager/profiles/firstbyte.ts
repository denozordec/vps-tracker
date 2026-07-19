import { parseDatacenterName } from '../parsers.js'
import type { MappedVps } from '../mappers.js'
import type { BillmanagerProfileOverrides } from './types.js'

/** YYYY-MM-DD only — skip labels like «Ежедневное списание». */
function pickPaidUntilDate(item: Record<string, string>): string {
  for (const key of ['real_expiredate', 'expiredate'] as const) {
    const raw = String(item[key] ?? '').trim()
    const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]!
  }
  return ''
}

/** Disk / virt hints from FirstByte tariff codes (MSK-KVM-SSD-START, KVM-SAS-1). */
export function inferFirstbyteHardwareHints(item: Record<string, string>): {
  diskType?: string
  virtualization?: string
} {
  const hay = `${item.pricelist || ''} ${item.intname || ''} ${item.name || ''}`
  let diskType: string | undefined
  let virtualization: string | undefined
  if (/\bNVMe\b/i.test(hay)) diskType = 'NVMe'
  else if (/\bSAS\b/i.test(hay)) diskType = 'SAS'
  else if (/\bHDD\b/i.test(hay)) diskType = 'HDD'
  else if (/\bSSD\b/i.test(hay)) diskType = 'SSD'
  if (/\bKVM\b/i.test(hay)) virtualization = 'KVM'
  else if (/\bOpenVZ\b/i.test(hay)) virtualization = 'OpenVZ'
  else if (/\bLXC\b/i.test(hay)) virtualization = 'LXC'
  return { diskType, virtualization }
}

/**
 * FirstByte — standard func=vds, but list has no CPU/RAM/disk numbers.
 *
 * Sync additionally fills specs via:
 * 1) vds.order match by pricelist_id (`enrichMappedVpsFromTariffs`)
 * 2) func=vds.edit&elid= (`options.fetchVdsEditForSpecs`)
 *
 * This enrich: geo, paidUntil, daily billing, diskType/KVM from tariff name.
 */
export function enrichFirstbyteVds(
  item: Record<string, string>,
  mapped: MappedVps,
): MappedVps {
  const dcRaw = (item.datacentername || item.datacenter || mapped.datacenter || '').trim()
  const { country, location } = parseDatacenterName(dcRaw)
  const paidUntil = pickPaidUntilDate(item) || mapped.paidUntil
  const tariffType =
    String(item.billdaily || '').toLowerCase() === 'on' ? 'daily' : mapped.tariffType
  const hints = inferFirstbyteHardwareHints(item)

  return {
    ...mapped,
    country: country || mapped.country,
    city: location || mapped.city,
    datacenter: dcRaw || mapped.datacenter,
    paidUntil,
    tariffType,
    diskType: mapped.diskGb ? mapped.diskType : hints.diskType || mapped.diskType,
    virtualization: hints.virtualization || mapped.virtualization,
  }
}

export const firstbyteOverrides: BillmanagerProfileOverrides = {
  id: 'firstbyte',
  match: {
    hostnames: ['firstbyte.ru', 'firstbyte.club', '1byte.ru'],
    keywords: ['firstbyte'],
  },
  map: {
    enrichVds: enrichFirstbyteVds,
  },
  options: {
    fetchVdsEditForSpecs: true,
  },
}
