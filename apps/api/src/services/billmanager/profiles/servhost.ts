import { parseDatacenterName } from '../parsers.js'
import type { MappedVps } from '../mappers.js'
import type {
  BillmanagerMapOverrides,
  BillmanagerProfileOverrides,
} from './types.js'

/**
 * Geo from serv.host `datacentername`, e.g. `Новосибирск Xeon` → Россия / Новосибирск.
 *
 * Hardware: list `pricelist` like `Тариф «Xeon 2667V2-1»` has no CPU/RAM/disk —
 * filled via vds.order + vds.edit (fetchVdsEditForSpecs).
 */
export function enrichServhostVds(
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

const servhostMap: BillmanagerMapOverrides = {
  enrichVds: enrichServhostVds,
}

/**
 * serv.host — standard func=vds; geo from datacentername;
 * specs via vds.order + vds.edit.
 */
export const servhostOverrides: BillmanagerProfileOverrides = {
  id: 'servhost',
  match: {
    hostnames: ['serv.host'],
    keywords: ['serv.host'],
  },
  map: servhostMap,
  options: {
    fetchVdsEditForSpecs: true,
  },
}
