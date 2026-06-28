import type { ActiveTariff, ProviderAccount } from '@/types/entities'

export interface TariffFiltersState {
  search: string
  providerId: string[]
  providerAccountId: string[]
  country: string[]
  location: string[]
  datacenter: string
  diskType: string[]
  currency: string[]
  minVcpu: number | null
  minRamGb: number | null
  minDiskGb: number | null
  minPrice: number | null
  maxPrice: number | null
  hideZeroPrice: boolean
  tableCompact: boolean
}

export interface TariffFilterContext {
  providerAccounts: ProviderAccount[]
}

export function buildDefaultTariffFilters(): TariffFiltersState {
  return {
    search: '',
    providerId: [],
    providerAccountId: [],
    country: [],
    location: [],
    datacenter: '',
    diskType: [],
    currency: [],
    minVcpu: null,
    minRamGb: null,
    minDiskGb: null,
    minPrice: null,
    maxPrice: null,
    hideZeroPrice: true,
    tableCompact: false,
  }
}

const matchesAny = <T,>(item: T | undefined, values: T[]): boolean => {
  if (values.length === 0) return true
  if (item == null) return false
  return values.includes(item)
}

const matchesText = (
  item: string | undefined | null,
  values: string[],
  operator: string,
): boolean => {
  if (values.length === 0) return true
  const v = (item ?? '').toLowerCase()
  const q = (values[0] ?? '').toLowerCase()
  if (!q) return true
  switch (operator) {
    case 'not_contains':
      return !v.includes(q)
    case 'starts_with':
      return v.startsWith(q)
    case 'ends_with':
      return v.endsWith(q)
    case 'is':
      return v === q
    default:
      return v.includes(q)
  }
}

const matchesNumberGte = (
  item: number | undefined | null,
  values: number[],
): boolean => {
  if (values.length === 0) return true
  const threshold = values[0]
  if (threshold == null) return true
  return Number(item ?? 0) >= threshold
}

const matchesNumberLte = (
  item: number | undefined | null,
  values: number[],
): boolean => {
  if (values.length === 0) return true
  const threshold = values[0]
  if (threshold == null) return true
  return Number(item ?? 0) <= threshold
}

function getTariffProviderId(tariff: ActiveTariff, ctx: TariffFilterContext): string | undefined {
  if (tariff.providerId) return tariff.providerId
  return ctx.providerAccounts.find((a) => a.id === tariff.providerAccountId)?.providerId
}

function tariffExternalId(tariff: ActiveTariff): string {
  return tariff.externalId ?? tariff.pricelistId ?? ''
}

function isZeroPrice(monthlyRate: number | null | undefined): boolean {
  return monthlyRate == null || monthlyRate <= 0
}

interface ActiveFilter {
  field: string
  operator: string
  values: unknown[]
}

export function applyTariffFilters(
  items: ActiveTariff[],
  filters: TariffFiltersState | ActiveFilter[],
  ctx: TariffFilterContext,
): ActiveTariff[] {
  const state = Array.isArray(filters) ? null : filters
  const activeFilters: ActiveFilter[] = Array.isArray(filters)
    ? filters
    : stateToActiveFilters(filters)

  const search = activeFilters.find((f) => f.field === 'search')?.values?.[0] as string ?? ''
  const searchLower = search.toLowerCase()
  const hideZeroPrice = state?.hideZeroPrice ?? true

  return items.filter((item) => {
    if (hideZeroPrice && isZeroPrice(item.monthlyRate)) return false

    if (searchLower) {
      const haystack = [
        item.name,
        tariffExternalId(item),
        item.datacenterName,
        item.location,
      ]
        .map((s) => (s ?? '').toLowerCase())
        .join(' ')
      if (!haystack.includes(searchLower)) return false
    }

    for (const f of activeFilters) {
      if (f.field === 'search') continue
      switch (f.field) {
        case 'providerId':
          if (!matchesAny(getTariffProviderId(item, ctx), f.values as string[])) return false
          break
        case 'providerAccountId':
          if (!matchesAny(item.providerAccountId, f.values as string[])) return false
          break
        case 'country':
          if (!matchesAny((item.country ?? '').trim() || undefined, f.values as string[])) return false
          break
        case 'location':
          if (!matchesAny((item.location ?? '').trim() || undefined, f.values as string[])) return false
          break
        case 'datacenter':
          if (!matchesText(item.datacenterName, f.values as string[], f.operator)) return false
          break
        case 'diskType':
          if (!matchesAny((item.diskType ?? '').trim() || undefined, f.values as string[])) return false
          break
        case 'currency':
          if (!matchesAny((item.currency ?? '').trim() || undefined, f.values as string[])) return false
          break
        case 'minVcpu':
          if (!matchesNumberGte(item.vcpu, f.values as number[])) return false
          break
        case 'minRamGb':
          if (!matchesNumberGte(item.ramGb, f.values as number[])) return false
          break
        case 'minDiskGb':
          if (!matchesNumberGte(item.diskGb, f.values as number[])) return false
          break
        case 'minPrice':
          if (!matchesNumberGte(item.monthlyRate, f.values as number[])) return false
          break
        case 'maxPrice':
          if (!matchesNumberLte(item.monthlyRate, f.values as number[])) return false
          break
      }
    }
    return true
  })
}

export function stateToActiveFilters(state: TariffFiltersState): ActiveFilter[] {
  const out: ActiveFilter[] = []
  if (state.search) out.push({ field: 'search', operator: 'contains', values: [state.search] })
  if (state.providerId.length) out.push({ field: 'providerId', operator: 'is_any_of', values: state.providerId })
  if (state.providerAccountId.length) out.push({ field: 'providerAccountId', operator: 'is_any_of', values: state.providerAccountId })
  if (state.country.length) out.push({ field: 'country', operator: 'is_any_of', values: state.country })
  if (state.location.length) out.push({ field: 'location', operator: 'is_any_of', values: state.location })
  if (state.datacenter) out.push({ field: 'datacenter', operator: 'contains', values: [state.datacenter] })
  if (state.diskType.length) out.push({ field: 'diskType', operator: 'is_any_of', values: state.diskType })
  if (state.currency.length) out.push({ field: 'currency', operator: 'is_any_of', values: state.currency })
  if (state.minVcpu != null) out.push({ field: 'minVcpu', operator: 'gte', values: [state.minVcpu] })
  if (state.minRamGb != null) out.push({ field: 'minRamGb', operator: 'gte', values: [state.minRamGb] })
  if (state.minDiskGb != null) out.push({ field: 'minDiskGb', operator: 'gte', values: [state.minDiskGb] })
  if (state.minPrice != null) out.push({ field: 'minPrice', operator: 'gte', values: [state.minPrice] })
  if (state.maxPrice != null) out.push({ field: 'maxPrice', operator: 'lte', values: [state.maxPrice] })
  return out
}

export function countActiveTariffFilters(filters: TariffFiltersState): number {
  let n = 0
  if (filters.search) n++
  if (filters.providerId.length) n++
  if (filters.providerAccountId.length) n++
  if (filters.country.length) n++
  if (filters.location.length) n++
  if (filters.datacenter) n++
  if (filters.diskType.length) n++
  if (filters.currency.length) n++
  if (filters.minVcpu != null) n++
  if (filters.minRamGb != null) n++
  if (filters.minDiskGb != null) n++
  if (filters.minPrice != null) n++
  if (filters.maxPrice != null) n++
  return n
}

export function hasActiveTariffFilters(filters: TariffFiltersState): boolean {
  const defaults = buildDefaultTariffFilters()
  return (
    countActiveTariffFilters(filters) > 0 ||
    filters.tableCompact !== defaults.tableCompact ||
    filters.hideZeroPrice !== defaults.hideZeroPrice
  )
}

export function hasTariffZeroResults(filters: TariffFiltersState, total: number, shown: number): boolean {
  return total > 0 && shown === 0 && (hasActiveTariffFilters(filters) || filters.hideZeroPrice)
}
