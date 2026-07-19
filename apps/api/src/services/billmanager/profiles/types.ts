/**
 * Unified BILLmanager hoster profile contract.
 * DEFAULT fills all hooks; hoster files declare only overrides.
 */

import type { MappedPayment, MappedVps } from '../mappers.js'

export type BillmanagerMatch = {
  /** Hostname substring match (e.g. waicore.com) */
  hostnames?: string[]
  /** Full URL lowercase substring (e.g. waicore) */
  keywords?: string[]
}

export type BillmanagerFuncs = {
  listVds: string
  payments: string
  dashboard: string
  orderPricelist: string
}

export type BillmanagerExtract = {
  listVdsKey: string
  paymentsKey: string
}

export type BillmanagerMap = {
  vds: (
    item: Record<string, string>,
    providerId: string,
    accountId: string,
  ) => MappedVps
  payment: (
    item: Record<string, string>,
    accountId: string,
  ) => MappedPayment | null
  /** Optional post-process after map.vds (specs / geo / etc.) */
  enrichVds?: (
    item: Record<string, string>,
    mapped: MappedVps,
  ) => MappedVps
}

export type BillmanagerRequestParams = {
  listVds?: Record<string, string | number>
  payments?: Record<string, string | number>
  dashboard?: Record<string, string | number>
  orderPricelist?: Record<string, string | number>
}

export type BillmanagerProfileOptions = {
  /**
   * When list `func=vds` has no CPU/RAM/disk — after tariff match,
   * call `func=vds.edit&elid=` per VPS (FirstByte and similar).
   */
  fetchVdsEditForSpecs?: boolean
}

export type BillmanagerProfile = {
  id: string
  match: BillmanagerMatch
  funcs: BillmanagerFuncs
  extract: BillmanagerExtract
  map: BillmanagerMap
  requestParams?: BillmanagerRequestParams
  options?: BillmanagerProfileOptions
}

/** Deep-partial for hoster override files (only divergences). */
export type BillmanagerProfileOverrides = {
  id: string
  match?: BillmanagerMatch
  funcs?: Partial<BillmanagerFuncs>
  extract?: Partial<BillmanagerExtract>
  map?: Partial<BillmanagerMap>
  requestParams?: BillmanagerRequestParams
  options?: BillmanagerProfileOptions
}
