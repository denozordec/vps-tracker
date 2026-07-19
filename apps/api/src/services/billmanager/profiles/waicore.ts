import { parseDatacenterName } from '../parsers.js'
import type { MappedVps } from '../mappers.js'
import type {
  BillmanagerMapOverrides,
  BillmanagerProfileOverrides,
} from './types.js'

/**
 * Geo from Waicore `datacentername`, e.g.:
 * - `[DE] Франкфурт | Промо` → Германия / Франкфурт
 * - `Германия, Франкфурт-на-Майне` → Германия / Франкфурт-на-Майне
 */
export function enrichWaicoreVds(
  item: Record<string, string>,
  mapped: MappedVps,
): MappedVps {
  const dcRaw = (item.datacentername || item.datacenter || mapped.datacenter || '').trim()
  if (!dcRaw) return mapped

  const { country, location } = parseDatacenterName(dcRaw)
  return {
    ...mapped,
    country: country || mapped.country,
    city: location || mapped.city,
    datacenter: dcRaw || mapped.datacenter,
  }
}

const waicoreMap: BillmanagerMapOverrides = {
  enrichVds: enrichWaicoreVds,
}

/**
 * Waicore (my.waicore.com) — list VPS via func=vds.vps instead of vds.
 * Response uses top-level elem[] (bjson; covered by extractList).
 * Geo from datacentername via enrichVds.
 */
export const waicoreOverrides: BillmanagerProfileOverrides = {
  id: 'waicore',
  match: {
    hostnames: ['waicore.com', 'waicore.network'],
    keywords: ['waicore'],
  },
  funcs: {
    listVds: 'vds.vps',
  },
  map: waicoreMap,
}
