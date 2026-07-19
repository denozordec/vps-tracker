import { parseDatacenterName } from '../parsers.js'
import type { MappedVps } from '../mappers.js'
import type {
  BillmanagerMapOverrides,
  BillmanagerProfileOverrides,
} from './types.js'

/**
 * Geo from ihor `datacentername`, e.g. `Москва DC3` → Россия / Москва.
 */
export function enrichIhorVds(
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

const ihorMap: BillmanagerMapOverrides = {
  enrichVds: enrichIhorVds,
}

/**
 * ihor (my-ihor.ru) — standard func=vds.
 * Geo from datacentername via enrichVds.
 */
export const ihorOverrides: BillmanagerProfileOverrides = {
  id: 'ihor',
  match: {
    hostnames: ['my-ihor.ru', 'ihor.ru'],
    keywords: ['ihor'],
  },
  map: ihorMap,
}
