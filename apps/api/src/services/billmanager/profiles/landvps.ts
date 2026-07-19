import { parseDatacenterName } from '../parsers.js'
import type { MappedVps } from '../mappers.js'
import type {
  BillmanagerMapOverrides,
  BillmanagerProfileOverrides,
} from './types.js'

/**
 * Geo + IPv6 from LandVPS list row.
 * - `datacentername`: `ДЦ Москва` → Россия / Москва
 * - `ipv6_subnet`
 *
 * Hardware: `pricelist` like `MSK-0` has no CPU/RAM —
 * filled via vds.order + vds.edit (fetchVdsEditForSpecs).
 */
export function enrichLandvpsVds(
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

const landvpsMap: BillmanagerMapOverrides = {
  enrichVds: enrichLandvpsVds,
}

/**
 * LandVPS — standard func=vds; geo from datacentername;
 * specs via vds.order + vds.edit.
 */
export const landvpsOverrides: BillmanagerProfileOverrides = {
  id: 'landvps',
  match: {
    hostnames: ['landvps.online', 'landvps.ru', 'landvps.com'],
    keywords: ['landvps'],
  },
  map: landvpsMap,
  options: {
    fetchVdsEditForSpecs: true,
  },
}
