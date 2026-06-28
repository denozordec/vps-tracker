import { useMemo } from 'react'

import { SelectField } from '@/components/select-field'
import {
  ListFiltersBar,
  FilterToggleChip,
  type FilterChip,
} from '@/components/list-filters-bar'
import {
  type AccountFiltersState,
  buildDefaultAccountFilters,
  hasActiveAccountFilters,
} from '@/components/account-filters'
import { billingModeLabel } from '@/lib/format'
import type { Provider } from '@/types/entities'

interface AccountFiltersToolbarProps {
  filters: AccountFiltersState
  onChange: (next: AccountFiltersState) => void
  providers: Provider[]
  shownCount: number
  totalCount: number
}

export function AccountFiltersToolbar({
  filters,
  onChange,
  providers,
  shownCount,
  totalCount,
}: AccountFiltersToolbarProps) {
  const chips = useMemo((): FilterChip[] => {
    const out: FilterChip[] = []
    if (filters.search.trim()) {
      out.push({
        id: 'search',
        label: `Поиск: ${filters.search.trim()}`,
        onRemove: () => onChange({ ...filters, search: '' }),
      })
    }
    if (filters.providerIds[0]) {
      const provider = providers.find((p) => p.id === filters.providerIds[0])
      out.push({
        id: 'provider',
        label: `Хостер: ${provider?.name ?? filters.providerIds[0]}`,
        onRemove: () => onChange({ ...filters, providerIds: [] }),
      })
    }
    if (filters.billingMode) {
      out.push({
        id: 'billing',
        label: `Биллинг: ${billingModeLabel(filters.billingMode)}`,
        onRemove: () => onChange({ ...filters, billingMode: '' }),
      })
    }
    return out
  }, [filters, onChange, providers])

  const toggle = (key: 'syncableOnly' | 'issuesOnly' | 'lowBalanceOnly') => {
    onChange({ ...filters, [key]: !filters[key] })
  }

  return (
    <ListFiltersBar
      search={{
        value: filters.search,
        onChange: (search) => onChange({ ...filters, search }),
        placeholder: 'Поиск по названию или логину',
      }}
      controls={
        <>
          <SelectField
            triggerClassName="w-full sm:w-48"
            placeholder="Все хостеры"
            value={filters.providerIds[0] ?? null}
            onValueChange={(v) => onChange({ ...filters, providerIds: v ? [v] : [] })}
            options={providers.map((p) => ({ value: p.id, label: p.name }))}
          />
          <SelectField
            triggerClassName="w-full sm:w-40"
            placeholder="Любой биллинг"
            value={filters.billingMode || null}
            onValueChange={(v) =>
              onChange({
                ...filters,
                billingMode: (v === 'daily' || v === 'monthly' ? v : '') as AccountFiltersState['billingMode'],
              })
            }
            options={[
              { value: 'monthly', label: billingModeLabel('monthly') },
              { value: 'daily', label: billingModeLabel('daily') },
            ]}
          />
        </>
      }
      toggles={
        <>
          <FilterToggleChip
            label="Готовы к синку"
            active={filters.syncableOnly}
            onClick={() => toggle('syncableOnly')}
          />
          <FilterToggleChip
            label="С проблемами"
            active={filters.issuesOnly}
            onClick={() => toggle('issuesOnly')}
          />
          <FilterToggleChip
            label="Низкий баланс"
            active={filters.lowBalanceOnly}
            onClick={() => toggle('lowBalanceOnly')}
          />
        </>
      }
      chips={chips}
      shown={shownCount}
      total={totalCount}
      showReset={hasActiveAccountFilters(filters)}
      onReset={() => onChange(buildDefaultAccountFilters())}
    />
  )
}
