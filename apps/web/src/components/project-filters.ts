import type { ProjectRow } from '@/lib/project-analytics'

export interface ProjectFiltersState {
  search: string
  withVpsOnly: boolean
}

export function buildDefaultProjectFilters(): ProjectFiltersState {
  return {
    search: '',
    withVpsOnly: false,
  }
}

export function hasActiveProjectFilters(filters: ProjectFiltersState): boolean {
  return Boolean(filters.search.trim() || filters.withVpsOnly)
}

export function applyProjectFilters(rows: ProjectRow[], filters: ProjectFiltersState): ProjectRow[] {
  const q = filters.search.trim().toLowerCase()
  return rows.filter((row) => {
    if (filters.withVpsOnly && row.vpsTotal === 0) return false
    if (!q) return true
    return (
      row.name.toLowerCase().includes(q) ||
      (row.notes ?? '').toLowerCase().includes(q)
    )
  })
}
