import { useMemo } from 'react'
import { SlidersHorizontalIcon, PlusIcon } from 'lucide-react'

import { Button } from '@cfdm/ui/components/button'
import { Checkbox } from '@cfdm/ui/components/checkbox'
import { Label } from '@cfdm/ui/components/label'
import { Separator } from '@cfdm/ui/components/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cfdm/ui/components/popover'

import {
  ListFiltersBar,
  FilterToggleChip,
  type FilterChip,
} from '@/components/list-filters-bar'
import type { DataGridColumnVisibilityOption } from '@/lib/data-grid-column-visibility'
import type { VisibilityState } from '@tanstack/react-table'

import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/reui/number-field'
import {
  Filters,
  createFilter,
  type Filter,
  type FilterFieldConfig,
  type FilterI18nConfig,
  type FilterOption,
  type CustomRendererProps,
} from '@/components/reui/filters'
import {
  type TariffFiltersState,
  buildDefaultTariffFilters,
  hasActiveTariffFilters,
} from '@/components/tariff-filters'
import { CountryFlag } from '@/components/country-flag'
import type { ActiveTariff, Provider, ProviderAccount } from '@/types/entities'

interface TariffsFiltersToolbarProps {
  filters: TariffFiltersState
  onChange: (next: TariffFiltersState) => void
  providers: Provider[]
  providerAccounts: ProviderAccount[]
  tariffs: ActiveTariff[]
  countryOptions: { value: string; label: string; code?: string }[]
  locationOptions: { value: string; label: string }[]
  diskTypeOptions: string[]
  currencyOptions: string[]
  shownCount: number
  totalCount: number
  columnVisibilityOptions?: DataGridColumnVisibilityOption[]
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void
}

function renderMinNumberField(
  min: number,
  max: number,
  values: number[],
  onChange: (v: number[]) => void,
) {
  return (
    <div className="px-2 py-1">
      <NumberField
        value={values[0] ?? null}
        onValueChange={(v) => onChange([v ?? 0])}
        min={min}
        max={max}
        size="sm"
      >
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
    </div>
  )
}

const RU_I18N: FilterI18nConfig = {
  addFilter: 'Фильтр',
  searchFields: 'Поиск поля…',
  noFieldsFound: 'Поля не найдены.',
  noResultsFound: 'Нет вариантов',
  select: 'Выбрать…',
  true: 'Да',
  false: 'Нет',
  min: 'Мин',
  max: 'Макс',
  to: 'до',
  typeAndPressEnter: 'Введите и нажмите Enter',
  selected: 'выбрано',
  selectedCount: 'выбрано',
  percent: '%',
  defaultCurrency: '₽',
  defaultColor: '#000000',
  addFilterTitle: 'Добавить фильтр',
  operators: {
    is: '=',
    isNot: '≠',
    isAnyOf: 'любое из',
    isNotAnyOf: 'не любое из',
    includesAll: 'включает все',
    excludesAll: 'исключает все',
    before: 'до',
    after: 'после',
    between: 'между',
    notBetween: 'не между',
    contains: 'содержит',
    notContains: 'не содержит',
    startsWith: 'начинается с',
    endsWith: 'заканчивается на',
    isExactly: 'точно',
    equals: '=',
    notEquals: '≠',
    greaterThan: '>',
    lessThan: '<',
    overlaps: 'пересекается',
    includes: 'включает',
    excludes: 'исключает',
    includesAllOf: 'включает все из',
    includesAnyOf: 'включает любое из',
    empty: 'пусто',
    notEmpty: 'не пусто',
  },
  placeholders: {
    enterField: (t) => `Введите ${t}…`,
    selectField: 'Выбрать…',
    searchField: (n) => `Поиск: ${n.toLowerCase()}…`,
    enterKey: 'Введите ключ…',
    enterValue: 'Введите значение…',
  },
  helpers: {
    formatOperator: (op) => op.replace(/_/g, ' '),
  },
  validation: {
    invalidEmail: 'Некорректный email',
    invalidUrl: 'Некорректный URL',
    invalidTel: 'Некорректный телефон',
    invalid: 'Некорректный формат',
  },
}

function getTariffProviderId(
  tariff: ActiveTariff,
  providerAccounts: ProviderAccount[],
): string | undefined {
  if (tariff.providerId) return tariff.providerId
  return providerAccounts.find((a) => a.id === tariff.providerAccountId)?.providerId
}

function stateToFilters(state: TariffFiltersState): (Filter<string> | Filter<number>)[] {
  const out: (Filter<string> | Filter<number>)[] = []
  if (state.providerId.length) out.push(createFilter<string>('providerId', 'is_any_of', state.providerId))
  if (state.providerAccountId.length) out.push(createFilter<string>('providerAccountId', 'is_any_of', state.providerAccountId))
  if (state.country.length) out.push(createFilter<string>('country', 'is_any_of', state.country))
  if (state.location.length) out.push(createFilter<string>('location', 'is_any_of', state.location))
  if (state.datacenter) out.push(createFilter<string>('datacenter', 'contains', [state.datacenter]))
  if (state.diskType.length) out.push(createFilter<string>('diskType', 'is_any_of', state.diskType))
  if (state.currency.length) out.push(createFilter<string>('currency', 'is_any_of', state.currency))
  if (state.minVcpu != null) out.push(createFilter<number>('minVcpu', 'is', [state.minVcpu]))
  if (state.minRamGb != null) out.push(createFilter<number>('minRamGb', 'is', [state.minRamGb]))
  if (state.minDiskGb != null) out.push(createFilter<number>('minDiskGb', 'is', [state.minDiskGb]))
  if (state.minPrice != null) out.push(createFilter<number>('minPrice', 'is', [state.minPrice]))
  if (state.maxPrice != null) out.push(createFilter<number>('maxPrice', 'is', [state.maxPrice]))
  return out
}

function filtersToState(filters: Filter[], base: TariffFiltersState): TariffFiltersState {
  const next = buildDefaultTariffFilters()
  next.search = base.search
  next.hideZeroPrice = base.hideZeroPrice
  next.tableCompact = base.tableCompact
  for (const f of filters) {
    switch (f.field) {
      case 'providerId': next.providerId = f.values as string[]; break
      case 'providerAccountId': next.providerAccountId = f.values as string[]; break
      case 'country': next.country = f.values as string[]; break
      case 'location': next.location = f.values as string[]; break
      case 'datacenter': next.datacenter = (f.values[0] as string) ?? ''; break
      case 'diskType': next.diskType = f.values as string[]; break
      case 'currency': next.currency = f.values as string[]; break
      case 'minVcpu': next.minVcpu = (f.values[0] as number) ?? null; break
      case 'minRamGb': next.minRamGb = (f.values[0] as number) ?? null; break
      case 'minDiskGb': next.minDiskGb = (f.values[0] as number) ?? null; break
      case 'minPrice': next.minPrice = (f.values[0] as number) ?? null; break
      case 'maxPrice': next.maxPrice = (f.values[0] as number) ?? null; break
    }
  }
  return next
}

export function TariffsFiltersToolbar({
  filters,
  onChange,
  providers,
  providerAccounts,
  tariffs,
  countryOptions,
  locationOptions,
  diskTypeOptions,
  currencyOptions,
  shownCount,
  totalCount,
  columnVisibilityOptions,
  columnVisibility,
  onColumnVisibilityChange,
}: TariffsFiltersToolbarProps) {
  const reuiFilters = useMemo<(Filter<string> | Filter<number>)[]>(() => stateToFilters(filters), [filters])

  const fields = useMemo<(FilterFieldConfig<string> | FilterFieldConfig<number>)[]>(() => {
    const count = (pred: (t: ActiveTariff) => boolean) => tariffs.filter(pred).length

    const providerOpts: FilterOption<string>[] = providers.map((p) => ({
      value: p.id,
      label: p.name,
      metadata: { count: count((t) => getTariffProviderId(t, providerAccounts) === p.id) },
    }))

    const accountOpts: FilterOption<string>[] = providerAccounts.map((a) => ({
      value: a.id,
      label: a.name,
      metadata: { count: count((t) => t.providerAccountId === a.id) },
    }))

    const countryOpts: FilterOption<string>[] = countryOptions.map((c) => ({
      value: c.value,
      label: c.label,
      icon: c.code ? <CountryFlag code={c.code} /> : <CountryFlag country={c.value} />,
      metadata: { count: count((t) => (t.country ?? '').trim() === c.value) },
    }))

    const locationOpts: FilterOption<string>[] = locationOptions.map((l) => ({
      value: l.value,
      label: l.label,
      metadata: { count: count((t) => (t.location ?? '').trim() === l.value) },
    }))

    const diskTypeOpts: FilterOption<string>[] = diskTypeOptions.map((d) => ({
      value: d,
      label: d,
      metadata: { count: count((t) => (t.diskType ?? '').trim() === d) },
    }))

    const currencyOpts: FilterOption<string>[] = currencyOptions.map((c) => ({
      value: c,
      label: c,
      metadata: { count: count((t) => (t.currency ?? '').trim() === c) },
    }))

    return [
      { key: 'providerId', label: 'Хостер', type: 'multiselect' as const, options: providerOpts, searchable: true, defaultOperator: 'is_any_of' },
      { key: 'providerAccountId', label: 'Аккаунт', type: 'multiselect' as const, options: accountOpts, searchable: true, defaultOperator: 'is_any_of' },
      { key: 'country', label: 'Страна', type: 'multiselect' as const, options: countryOpts, searchable: true, defaultOperator: 'is_any_of' },
      { key: 'location', label: 'Локация', type: 'multiselect' as const, options: locationOpts, searchable: true, defaultOperator: 'is_any_of' },
      { key: 'datacenter', label: 'Дата-центр', type: 'text' as const, placeholder: 'Напр. Frankfurt', defaultOperator: 'contains' },
      { key: 'diskType', label: 'Тип диска', type: 'multiselect' as const, options: diskTypeOpts, searchable: true, defaultOperator: 'is_any_of' },
      { key: 'currency', label: 'Валюта', type: 'multiselect' as const, options: currencyOpts, defaultOperator: 'is_any_of' },
      {
        key: 'minVcpu',
        label: 'vCPU ≥',
        type: 'custom' as const,
        defaultOperator: 'is',
        operators: [{ value: 'is', label: '≥' }],
        customRenderer: ({ values, onChange: onCh }: CustomRendererProps<number>) =>
          renderMinNumberField(0, 32, values, onCh),
      },
      {
        key: 'minRamGb',
        label: 'RAM ≥',
        type: 'custom' as const,
        defaultOperator: 'is',
        operators: [{ value: 'is', label: '≥' }],
        customRenderer: ({ values, onChange: onCh }: CustomRendererProps<number>) =>
          renderMinNumberField(0, 256, values, onCh),
      },
      {
        key: 'minDiskGb',
        label: 'Disk ≥',
        type: 'custom' as const,
        defaultOperator: 'is',
        operators: [{ value: 'is', label: '≥' }],
        customRenderer: ({ values, onChange: onCh }: CustomRendererProps<number>) =>
          renderMinNumberField(0, 2000, values, onCh),
      },
      {
        key: 'minPrice',
        label: 'Цена ≥',
        type: 'custom' as const,
        defaultOperator: 'is',
        operators: [{ value: 'is', label: '≥' }],
        customRenderer: ({ values, onChange: onCh }: CustomRendererProps<number>) =>
          renderMinNumberField(0, 100_000, values, onCh),
      },
      {
        key: 'maxPrice',
        label: 'Цена ≤',
        type: 'custom' as const,
        defaultOperator: 'is',
        operators: [{ value: 'is', label: '≤' }],
        customRenderer: ({ values, onChange: onCh }: CustomRendererProps<number>) =>
          renderMinNumberField(0, 100_000, values, onCh),
      },
    ]
  }, [providers, providerAccounts, tariffs, countryOptions, locationOptions, diskTypeOptions, currencyOptions])

  const handleFiltersChange = (next: Filter[]) => {
    onChange(filtersToState(next, filters))
  }

  const chips = useMemo((): FilterChip[] => {
    const out: FilterChip[] = []
    const providerById = new Map(providers.map((p) => [p.id, p.name]))
    const accountById = new Map(providerAccounts.map((a) => [a.id, a.name]))

    if (filters.search) {
      out.push({
        id: 'search',
        label: `Поиск: ${filters.search}`,
        onRemove: () => onChange({ ...filters, search: '' }),
      })
    }
    if (filters.providerId.length) {
      const names = filters.providerId.map((id) => providerById.get(id) ?? id).join(', ')
      out.push({
        id: 'providerId',
        label: `Хостер: ${names}`,
        onRemove: () => onChange({ ...filters, providerId: [] }),
      })
    }
    if (filters.providerAccountId.length) {
      const names = filters.providerAccountId.map((id) => accountById.get(id) ?? id).join(', ')
      out.push({
        id: 'providerAccountId',
        label: `Аккаунт: ${names}`,
        onRemove: () => onChange({ ...filters, providerAccountId: [] }),
      })
    }
    if (filters.country.length) {
      out.push({
        id: 'country',
        label: `Страна: ${filters.country.join(', ')}`,
        onRemove: () => onChange({ ...filters, country: [] }),
      })
    }
    if (filters.location.length) {
      out.push({
        id: 'location',
        label: `Локация: ${filters.location.join(', ')}`,
        onRemove: () => onChange({ ...filters, location: [] }),
      })
    }
    if (filters.datacenter) {
      out.push({
        id: 'datacenter',
        label: `ДЦ: ${filters.datacenter}`,
        onRemove: () => onChange({ ...filters, datacenter: '' }),
      })
    }
    if (filters.diskType.length) {
      out.push({
        id: 'diskType',
        label: `Диск: ${filters.diskType.join(', ')}`,
        onRemove: () => onChange({ ...filters, diskType: [] }),
      })
    }
    if (filters.currency.length) {
      out.push({
        id: 'currency',
        label: `Валюта: ${filters.currency.join(', ')}`,
        onRemove: () => onChange({ ...filters, currency: [] }),
      })
    }
    if (filters.minVcpu != null) {
      out.push({
        id: 'minVcpu',
        label: `vCPU ≥ ${filters.minVcpu}`,
        onRemove: () => onChange({ ...filters, minVcpu: null }),
      })
    }
    if (filters.minRamGb != null) {
      out.push({
        id: 'minRamGb',
        label: `RAM ≥ ${filters.minRamGb} GB`,
        onRemove: () => onChange({ ...filters, minRamGb: null }),
      })
    }
    if (filters.minDiskGb != null) {
      out.push({
        id: 'minDiskGb',
        label: `Disk ≥ ${filters.minDiskGb} GB`,
        onRemove: () => onChange({ ...filters, minDiskGb: null }),
      })
    }
    if (filters.minPrice != null) {
      out.push({
        id: 'minPrice',
        label: `Цена ≥ ${filters.minPrice}`,
        onRemove: () => onChange({ ...filters, minPrice: null }),
      })
    }
    if (filters.maxPrice != null) {
      out.push({
        id: 'maxPrice',
        label: `Цена ≤ ${filters.maxPrice}`,
        onRemove: () => onChange({ ...filters, maxPrice: null }),
      })
    }
    if (filters.hideZeroPrice) {
      out.push({
        id: 'hideZeroPrice',
        label: 'Скрыть нулевые цены',
        onRemove: () => onChange({ ...filters, hideZeroPrice: false }),
      })
    }
    if (filters.tableCompact) {
      out.push({
        id: 'tableCompact',
        label: 'Компактная таблица',
        onRemove: () => onChange({ ...filters, tableCompact: false }),
      })
    }
    return out
  }, [filters, onChange, providers, providerAccounts])

  const hasActive = hasActiveTariffFilters(filters)

  return (
    <ListFiltersBar
      search={{
        value: filters.search,
        onChange: (search) => onChange({ ...filters, search }),
        placeholder: 'Поиск: название, ID, дата-центр, локация',
        name: 'tariffs-search',
      }}
      controls={
        <>
          <Filters
            filters={reuiFilters as unknown as Filter[]}
            fields={fields as unknown as FilterFieldConfig[]}
            onChange={handleFiltersChange}
            i18n={RU_I18N}
            size="sm"
            allowMultiple={false}
            trigger={
              <Button variant="outline" size="sm">
                <PlusIcon data-icon="inline-start" />
                Фильтр
              </Button>
            }
          />

          <Popover>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="sm">
                  <SlidersHorizontalIcon data-icon="inline-start" />
                  Вид
                </Button>
              }
            />
            <PopoverContent align="end" className="w-64 p-3">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">Отображение</Label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={filters.tableCompact}
                      onCheckedChange={(v) => onChange({ ...filters, tableCompact: Boolean(v) })}
                    />
                    <span className="text-sm">Компактная таблица</span>
                  </label>
                </div>

                {columnVisibilityOptions && columnVisibilityOptions.length > 0 && onColumnVisibilityChange ? (
                  <>
                    <Separator />
                    <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                      <Label className="text-xs text-muted-foreground">Колонки</Label>
                      {columnVisibilityOptions.map((col) => (
                        <label key={col.id} className="flex items-center gap-2">
                          <Checkbox
                            checked={columnVisibility?.[col.id] !== false}
                            onCheckedChange={(v) => onColumnVisibilityChange(col.id, Boolean(v))}
                          />
                          <span className="text-sm">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
        </>
      }
      toggles={
        <FilterToggleChip
          label="Скрыть нулевые цены"
          active={filters.hideZeroPrice}
          onClick={() => onChange({ ...filters, hideZeroPrice: !filters.hideZeroPrice })}
        />
      }
      chips={chips}
      shown={shownCount}
      total={totalCount}
      showReset={hasActive}
      onReset={() => onChange(buildDefaultTariffFilters())}
    />
  )
}
