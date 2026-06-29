import { useMemo } from 'react'

import {
  ListFiltersBar,
  FilterToggleChip,
  type FilterChip,
} from '@/components/list-filters-bar'
import {
  type ProjectFiltersState,
  buildDefaultProjectFilters,
  hasActiveProjectFilters,
} from '@/components/project-filters'

interface ProjectFiltersToolbarProps {
  filters: ProjectFiltersState
  onChange: (next: ProjectFiltersState) => void
  shownCount: number
  totalCount: number
}

export function ProjectFiltersToolbar({
  filters,
  onChange,
  shownCount,
  totalCount,
}: ProjectFiltersToolbarProps) {
  const chips = useMemo((): FilterChip[] => {
    const out: FilterChip[] = []
    if (filters.search.trim()) {
      out.push({
        id: 'search',
        label: `Поиск: ${filters.search.trim()}`,
        onRemove: () => onChange({ ...filters, search: '' }),
      })
    }
    if (filters.withVpsOnly) {
      out.push({
        id: 'withVps',
        label: 'Только с VPS',
        onRemove: () => onChange({ ...filters, withVpsOnly: false }),
      })
    }
    return out
  }, [filters, onChange])

  return (
    <ListFiltersBar
      search={{
        value: filters.search,
        onChange: (search) => onChange({ ...filters, search }),
        placeholder: 'Поиск по названию или заметкам',
      }}
      controls={
        <FilterToggleChip
          label="С VPS"
          active={filters.withVpsOnly}
          onClick={() => onChange({ ...filters, withVpsOnly: !filters.withVpsOnly })}
        />
      }
      chips={chips}
      shown={shownCount}
      total={totalCount}
      showReset={hasActiveProjectFilters(filters)}
      onReset={() => onChange(buildDefaultProjectFilters())}
    />
  )
}
