import { parseDatacenterName } from '../parsers.js'
import type { MappedVps } from '../mappers.js'
import type {
  BillmanagerMapOverrides,
  BillmanagerProfileOverrides,
} from './types.js'

/**
 * Geo + IPv6 from Cloudrix list row.
 * - `datacentername`: `Россия, Москва` → Россия / Москва
 * - `ipv6_subnet`: `2a12:…::/64`
 *
 * Hardware (vcpu/ram/disk): list has only `pricelist` like SPROMO-1 —
 * filled in sync via vds.order match and `vds.edit` (fetchVdsEditForSpecs).
 */
export function enrichCloudrixVds(
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
    // Promo / named plans rarely encode disk type — prefer NVMe when unknown
    diskType: mapped.diskGb ? mapped.diskType : mapped.diskType || 'NVMe',
    virtualization: mapped.virtualization || 'KVM',
  }
}

const cloudrixMap: BillmanagerMapOverrides = {
  enrichVds: enrichCloudrixVds,
}

/**
 * Cloudrix — standard func=vds; geo from datacentername;
 * specs via vds.order + vds.edit (no CPU/RAM in list pricelist name).
 */
export const cloudrixOverrides: BillmanagerProfileOverrides = {
  id: 'cloudrix',
  match: {
    hostnames: ['cloudrix.ru', 'cloudrix.space'],
    keywords: ['cloudrix'],
  },
  map: cloudrixMap,
  options: {
    fetchVdsEditForSpecs: true,
  },
}
