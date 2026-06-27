import type { Vps } from '@/types/entities'

/**
 * Состояние фильтров VPS.
 * Multiselect-поля (status, environment, tariffType, monitoring, backup,
 * providerId, providerAccountId, project, country, city) — массивы строк.
 * Пустой массив = «все».
 */
export interface VpsFiltersState {
  search: string
  providerId: string[]
  providerAccountId: string[]
  country: string[]
  city: string[]
  datacenter: string
  status: string[]
  environment: string[]
  tariffType: string[]
  monitoring: string[]
  backup: string[]
  minVcpu: number | null
  minRamGb: number | null
  minDiskGb: number | null
  project: string[]
  groupByProject: boolean
  tableCompact: boolean
}

export function buildDefaultVpsFilters(): VpsFiltersState {
  return {
    search: '',
    providerId: [],
    providerAccountId: [],
    country: [],
    city: [],
    datacenter: '',
    status: [],
    environment: [],
    tariffType: [],
    monitoring: [],
    backup: [],
    minVcpu: null,
    minRamGb: null,
    minDiskGb: null,
    project: [],
    groupByProject: false,
    tableCompact: false,
  }
}

const arrOr = <T,>(v: T[] | T | undefined | null): T[] =>
  Array.isArray(v) ? v : v == null || v === '' ? [] : [v]

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
  // Для text-фильтра values — массив из одного элемента
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

interface ActiveFilter {
  field: string
  operator: string
  values: unknown[]
}

/**
 * Применяет фильтры к списку VPS.
 * Принимает активные фильтры в формате ReUI Filters (Filter[]) —
 * массив объектов { field, operator, values }.
 */
export function applyVpsFilters(
  items: Vps[],
  filters: VpsFiltersState | ActiveFilter[],
): Vps[] {
  // Если передан state — конвертируем в active filters
  const activeFilters: ActiveFilter[] = Array.isArray(filters)
    ? filters
    : stateToActiveFilters(filters)

  const search = activeFilters.find((f) => f.field === 'search')?.values?.[0] as string ?? ''
  const searchLower = search.toLowerCase()

  return items.filter((item) => {
    if (searchLower) {
      const extraIps = Array.isArray(item.additionalIps) ? item.additionalIps.join(' ') : ''
      const haystack = [
        item.ip, item.dns, item.ipv6, extraIps, item.project, item.purpose, item.os,
      ].map((s) => (s ?? '').toLowerCase()).join(' ')
      if (!haystack.includes(searchLower)) return false
    }

    for (const f of activeFilters) {
      if (f.field === 'search') continue
      switch (f.field) {
        case 'providerId':
          if (!matchesAny(item.providerId, f.values as string[])) return false
          break
        case 'providerAccountId':
          if (!matchesAny(item.providerAccountId, f.values as string[])) return false
          break
        case 'country':
          if (!matchesAny((item.country ?? '').trim() || undefined, f.values as string[])) return false
          break
        case 'city':
          if (!matchesAny((item.city ?? '').trim() || undefined, f.values as string[])) return false
          break
        case 'datacenter':
          if (!matchesText(item.datacenter, f.values as string[], f.operator)) return false
          break
        case 'status':
          if (!matchesAny(item.status, f.values as string[])) return false
          break
        case 'environment':
          if (!matchesAny(item.environment, f.values as string[])) return false
          break
        case 'tariffType':
          if (!matchesAny(item.tariffType, f.values as string[])) return false
          break
        case 'monitoring': {
          if (f.values.length === 0) break
          const on = (f.values as string[]).includes('on')
          const off = (f.values as string[]).includes('off')
          const itemOn = Boolean(item.monitoringEnabled)
          if (on && itemOn) break
          if (off && !itemOn) break
          return false
        }
        case 'backup': {
          if (f.values.length === 0) break
          const on = (f.values as string[]).includes('on')
          const off = (f.values as string[]).includes('off')
          const itemOn = Boolean(item.backupEnabled)
          if (on && itemOn) break
          if (off && !itemOn) break
          return false
        }
        case 'project': {
          if (f.values.length === 0) break
          const proj = (item.project ?? '').trim()
          const wants = f.values as string[]
          const wantsNone = wants.includes('__none__')
          const wantsNamed = wants.filter((v) => v !== '__none__')
          let ok = false
          if (wantsNone && !proj) ok = true
          if (wantsNamed.length && wantsNamed.includes(proj)) ok = true
          if (!ok) return false
          break
        }
        case 'minVcpu':
          if (!matchesNumberGte(item.vcpu, f.values as number[])) return false
          break
        case 'minRamGb':
          if (!matchesNumberGte(item.ramGb, f.values as number[])) return false
          break
        case 'minDiskGb':
          if (!matchesNumberGte(item.diskGb, f.values as number[])) return false
          break
      }
    }
    return true
  })
}

/** Конвертация VpsFiltersState → ActiveFilter[] для applyVpsFilters. */
export function stateToActiveFilters(state: VpsFiltersState): ActiveFilter[] {
  const out: ActiveFilter[] = []
  if (state.search) out.push({ field: 'search', operator: 'contains', values: [state.search] })
  if (state.providerId.length) out.push({ field: 'providerId', operator: 'is_any_of', values: state.providerId })
  if (state.providerAccountId.length) out.push({ field: 'providerAccountId', operator: 'is_any_of', values: state.providerAccountId })
  if (state.country.length) out.push({ field: 'country', operator: 'is_any_of', values: state.country })
  if (state.city.length) out.push({ field: 'city', operator: 'is_any_of', values: state.city })
  if (state.datacenter) out.push({ field: 'datacenter', operator: 'contains', values: [state.datacenter] })
  if (state.status.length) out.push({ field: 'status', operator: 'is_any_of', values: state.status })
  if (state.environment.length) out.push({ field: 'environment', operator: 'is_any_of', values: state.environment })
  if (state.tariffType.length) out.push({ field: 'tariffType', operator: 'is_any_of', values: state.tariffType })
  if (state.monitoring.length) out.push({ field: 'monitoring', operator: 'is_any_of', values: state.monitoring })
  if (state.backup.length) out.push({ field: 'backup', operator: 'is_any_of', values: state.backup })
  if (state.project.length) out.push({ field: 'project', operator: 'is_any_of', values: state.project })
  if (state.minVcpu != null) out.push({ field: 'minVcpu', operator: 'gte', values: [state.minVcpu] })
  if (state.minRamGb != null) out.push({ field: 'minRamGb', operator: 'gte', values: [state.minRamGb] })
  if (state.minDiskGb != null) out.push({ field: 'minDiskGb', operator: 'gte', values: [state.minDiskGb] })
  return out
}

export function countActiveFilters(filters: VpsFiltersState): number {
  let n = 0
  if (filters.search) n++
  n += filters.providerId.length
  n += filters.providerAccountId.length
  n += filters.country.length
  n += filters.city.length
  if (filters.datacenter) n++
  n += filters.status.length
  n += filters.environment.length
  n += filters.tariffType.length
  n += filters.monitoring.length
  n += filters.backup.length
  n += filters.project.length
  if (filters.minVcpu != null) n++
  if (filters.minRamGb != null) n++
  if (filters.minDiskGb != null) n++
  return n
}

export function hasActiveVpsFilters(filters: VpsFiltersState): boolean {
  return countActiveFilters(filters) > 0 || filters.groupByProject || filters.tableCompact
}

export interface VpsFilterPreset {
  name: string
  filters: VpsFiltersState
}

const PRESETS_KEY = 'vps-tracker:vps-filter-presets'

export function loadFilterPresets(): VpsFilterPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveFilterPresets(presets: VpsFilterPreset[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
  } catch {
    /* ignore */
  }
}

// Обратная совместимость — для старого кода, который мог импортировать arrOr
export { arrOr }
