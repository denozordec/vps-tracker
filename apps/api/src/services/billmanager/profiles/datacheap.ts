import { parseDatacenterName } from '../parsers.js'
import type { MappedVps } from '../mappers.js'
import type {
  BillmanagerMapOverrides,
  BillmanagerProfileOverrides,
} from './types.js'

/**
 * Geo from Datacheap list row.
 * - `datacentername`: `Россия` (country only; city empty)
 * - `ipv6_subnet` when present
 *
 * Hardware: `pricelist` like `VPS Start NVMe unlimited (RU)` has no CPU/RAM —
 * filled via vds.order + vds.edit (fetchVdsEditForSpecs).
 */
export function enrichDatacheapVds(
  item: Record<string, string>,
  mapped: MappedVps,
): MappedVps {
  const dcRaw = (item.datacentername || item.datacenter || mapped.datacenter || '').trim()
  const { country, location } = dcRaw
    ? parseDatacenterName(dcRaw)
    : { country: '', location: '' }

  const ipv6 = (item.ipv6_subnet || item.ipv6 || mapped.ipv6 || '').trim()

  return {
    ...mapped,
    country: country || mapped.country,
    city: location || mapped.city,
    datacenter: dcRaw || mapped.datacenter,
    ipv6: ipv6 || mapped.ipv6,
    diskType: mapped.diskGb ? mapped.diskType : mapped.diskType || 'NVMe',
    virtualization: mapped.virtualization || 'KVM',
  }
}

const datacheapMap: BillmanagerMapOverrides = {
  enrichVds: enrichDatacheapVds,
}

/**
 * Datacheap — standard func=vds; geo from datacentername;
 * specs via vds.order + vds.edit.
 */
export const datacheapOverrides: BillmanagerProfileOverrides = {
  id: 'datacheap',
  match: {
    hostnames: ['datacheap.ru', 'datacheap.com'],
    keywords: ['datacheap'],
  },
  map: datacheapMap,
  options: {
    fetchVdsEditForSpecs: true,
  },
}
