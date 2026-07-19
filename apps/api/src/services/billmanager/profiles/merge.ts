import type { BillmanagerProfile, BillmanagerProfileOverrides } from './types.js'

/**
 * Merge DEFAULT profile with hoster overrides.
 * Nested funcs/extract/map are shallow-merged; requestParams replaced per-key.
 */
export function mergeProfile(
  defaults: BillmanagerProfile,
  overrides: BillmanagerProfileOverrides,
): BillmanagerProfile {
  return {
    id: overrides.id,
    match: {
      ...defaults.match,
      ...overrides.match,
    },
    funcs: {
      ...defaults.funcs,
      ...overrides.funcs,
    },
    extract: {
      ...defaults.extract,
      ...overrides.extract,
    },
    map: {
      ...defaults.map,
      ...overrides.map,
    },
    requestParams: {
      ...defaults.requestParams,
      ...overrides.requestParams,
      listVds: {
        ...defaults.requestParams?.listVds,
        ...overrides.requestParams?.listVds,
      },
      payments: {
        ...defaults.requestParams?.payments,
        ...overrides.requestParams?.payments,
      },
      dashboard: {
        ...defaults.requestParams?.dashboard,
        ...overrides.requestParams?.dashboard,
      },
      orderPricelist: {
        ...defaults.requestParams?.orderPricelist,
        ...overrides.requestParams?.orderPricelist,
      },
    },
  }
}
