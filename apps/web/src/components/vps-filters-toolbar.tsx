import { useMemo, useState } from 'react'
import { SlidersHorizontalIcon, SaveIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@cfdm/ui/components/button'
import { Checkbox } from '@cfdm/ui/components/checkbox'
import { Label } from '@cfdm/ui/components/label'
import { Separator } from '@cfdm/ui/components/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cfdm/ui/components/popover'
import { PlusIcon } from 'lucide-react'

import { ListFiltersBar, type FilterChip } from '@/components/list-filters-bar'
import type { DataGridColumnVisibilityOption } from '@/components/data-grid-card'
import type { VisibilityState } from '@tanstack/react-table'

import {
  DateSelector,
  type DateSelectorFilterType,
  type DateSelectorValue,
} from '@/components/reui/date-selector'
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
  type VpsFiltersState,
  buildDefaultVpsFilters,
  hasActiveVpsFilters,
  stateToActiveFilters,
  loadFilterPresets,
  saveFilterPresets,
  type VpsFilterPreset,
} from '@/components/vps-filters'
import { RU_DATE_SELECTOR_I18N } from '@/lib/date-selector-i18n'
import { vpsStatusLabel, tariffTypeLabel, environmentLabel } from '@/lib/format'
import { CountryFlag } from '@/components/country-flag'
import type { Provider, ProviderAccount, Vps } from '@/types/entities'

interface VpsFiltersToolbarProps {
  filters: VpsFiltersState
  onChange: (next: VpsFiltersState) => void
  providers: Provider[]
  providerAccounts: ProviderAccount[]
  vps: Vps[]
  countryOptions: { value: string; label: string; code?: string }[]
  cityOptions: { value: string; label: string }[]
  projectNameOptions: string[]
  shownCount: number
  totalCount: number
  columnVisibilityOptions?: DataGridColumnVisibilityOption[]
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: (columnId: string, visible: boolean) => void
}

function toDateSelectorValue(values: string[], operator: string): DateSelectorValue {
  return {
    period: 'day',
    operator: (operator as DateSelectorFilterType) || 'before',
    startDate: values[0] ? new Date(values[0]) : undefined,
    endDate: values[1] ? new Date(values[1]) : undefined,
  }
}

function fromDateSelectorValue(value: DateSelectorValue): string[] {
  const out: string[] = []
  if (value.startDate) out.push(value.startDate.toISOString().slice(0, 10))
  if (value.endDate) out.push(value.endDate.toISOString().slice(0, 10))
  return out
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

/** Конвертация VpsFiltersState → Filter[] для ReUI Filters. */
function stateToFilters(state: VpsFiltersState): (Filter<string> | Filter<number>)[] {
  const out: (Filter<string> | Filter<number>)[] = []
  if (state.providerId.length) out.push(createFilter<string>('providerId', 'is_any_of', state.providerId))
  if (state.providerAccountId.length) out.push(createFilter<string>('providerAccountId', 'is_any_of', state.providerAccountId))
  if (state.country.length) out.push(createFilter<string>('country', 'is_any_of', state.country))
  if (state.city.length) out.push(createFilter<string>('city', 'is_any_of', state.city))
  if (state.datacenter) out.push(createFilter<string>('datacenter', 'contains', [state.datacenter]))
  if (state.status.length) out.push(createFilter<string>('status', 'is_any_of', state.status))
  if (state.environment.length) out.push(createFilter<string>('environment', 'is_any_of', state.environment))
  if (state.tariffType.length) out.push(createFilter<string>('tariffType', 'is_any_of', state.tariffType))
  if (state.monitoring.length) out.push(createFilter<string>('monitoring', 'is_any_of', state.monitoring))
  if (state.backup.length) out.push(createFilter<string>('backup', 'is_any_of', state.backup))
  if (state.project.length) out.push(createFilter<string>('project', 'is_any_of', state.project))
  if (state.minVcpu != null) out.push(createFilter<number>('minVcpu', 'is', [state.minVcpu]))
  if (state.minRamGb != null) out.push(createFilter<number>('minRamGb', 'is', [state.minRamGb]))
  if (state.minDiskGb != null) out.push(createFilter<number>('minDiskGb', 'is', [state.minDiskGb]))
  if (state.paidUntilStart) {
    const values =
      state.paidUntilEnd && state.paidUntilOperator === 'between'
        ? [state.paidUntilStart, state.paidUntilEnd]
        : [state.paidUntilStart]
    out.push(createFilter<string>('paidUntil', state.paidUntilOperator ?? 'before', values))
  }
  return out
}

/** Конвертация Filter[] → VpsFiltersState (merge с default). */
function filtersToState(filters: Filter[], base: VpsFiltersState): VpsFiltersState {
  const next = buildDefaultVpsFilters()
  next.search = base.search
  next.groupByProject = base.groupByProject
  next.tableCompact = base.tableCompact
  for (const f of filters) {
    switch (f.field) {
      case 'providerId': next.providerId = f.values as string[]; break
      case 'providerAccountId': next.providerAccountId = f.values as string[]; break
      case 'country': next.country = f.values as string[]; break
      case 'city': next.city = f.values as string[]; break
      case 'datacenter': next.datacenter = (f.values[0] as string) ?? ''; break
      case 'status': next.status = f.values as string[]; break
      case 'environment': next.environment = f.values as string[]; break
      case 'tariffType': next.tariffType = f.values as string[]; break
      case 'monitoring': next.monitoring = f.values as string[]; break
      case 'backup': next.backup = f.values as string[]; break
      case 'project': next.project = f.values as string[]; break
      case 'minVcpu': next.minVcpu = (f.values[0] as number) ?? null; break
      case 'minRamGb': next.minRamGb = (f.values[0] as number) ?? null; break
      case 'minDiskGb': next.minDiskGb = (f.values[0] as number) ?? null; break
      case 'paidUntil': {
        next.paidUntilOperator = (f.operator as typeof next.paidUntilOperator) ?? 'before'
        next.paidUntilStart = (f.values[0] as string) ?? null
        next.paidUntilEnd = (f.values[1] as string) ?? null
        break
      }
    }
  }
  return next
}

export function VpsFiltersToolbar({
  filters,
  onChange,
  providers,
  providerAccounts,
  vps,
  countryOptions,
  cityOptions,
  projectNameOptions,
  shownCount,
  totalCount,
  columnVisibilityOptions,
  columnVisibility,
  onColumnVisibilityChange,
}: VpsFiltersToolbarProps) {
  const [presets, setPresets] = useState<VpsFilterPreset[]>(() => loadFilterPresets())

  const reuiFilters = useMemo<(Filter<string> | Filter<number>)[]>(() => stateToFilters(filters), [filters])

  const fields = useMemo<(FilterFieldConfig<string> | FilterFieldConfig<number>)[]>(() => {
    const count = (pred: (v: Vps) => boolean) => vps.filter(pred).length

    const providerOpts: FilterOption<string>[] = providers.map((p) => ({
      value: p.id,
      label: p.name,
      metadata: { count: count((v) => v.providerId === p.id) },
    }))

    const accountOpts: FilterOption<string>[] = providerAccounts.map((a) => ({
      value: a.id,
      label: a.name,
      metadata: { count: count((v) => v.providerAccountId === a.id) },
    }))

    const countryOpts: FilterOption<string>[] = countryOptions.map((c) => ({
      value: c.value,
      label: c.label,
      icon: c.code ? <CountryFlag code={c.code} /> : <CountryFlag country={c.value} />,
      metadata: { count: count((v) => (v.country ?? '').trim() === c.value) },
    }))

    const cityOpts: FilterOption<string>[] = cityOptions.map((c) => ({
      value: c.value,
      label: c.label,
      metadata: { count: count((v) => (v.city ?? '').trim() === c.value) },
    }))

    const projectOpts: FilterOption<string>[] = [
      { value: '__none__', label: 'Без проекта', metadata: { count: count((v) => !(v.project ?? '').trim()) } },
      ...projectNameOptions.map((p) => ({
        value: p,
        label: p,
        metadata: { count: count((v) => (v.project ?? '').trim() === p) },
      })),
    ]

    const statusOpts: FilterOption<string>[] = [
      { value: 'active', label: vpsStatusLabel('active') },
      { value: 'paused', label: vpsStatusLabel('paused') },
      { value: 'archived', label: vpsStatusLabel('archived') },
    ]

    const envOpts: FilterOption<string>[] = [
      { value: 'prod', label: environmentLabel('prod') },
      { value: 'dev', label: environmentLabel('dev') },
      { value: 'staging', label: environmentLabel('staging') },
    ]

    const tariffOpts: FilterOption<string>[] = [
      { value: 'monthly', label: tariffTypeLabel('monthly') },
      { value: 'daily', label: tariffTypeLabel('daily') },
    ]

    const onOffOpts: FilterOption<string>[] = [
      { value: 'on', label: 'Включено' },
      { value: 'off', label: 'Выключено' },
    ]

    return [
      { key: 'providerId', label: 'Хостер', type: 'multiselect' as const, options: providerOpts, searchable: true, defaultOperator: 'is_any_of' },
      { key: 'providerAccountId', label: 'Аккаунт', type: 'multiselect' as const, options: accountOpts, searchable: true, defaultOperator: 'is_any_of' },
      { key: 'country', label: 'Страна', type: 'multiselect' as const, options: countryOpts, searchable: true, defaultOperator: 'is_any_of' },
      { key: 'city', label: 'Город', type: 'multiselect' as const, options: cityOpts, searchable: true, defaultOperator: 'is_any_of' },
      { key: 'datacenter', label: 'Дата-центр', type: 'text' as const, placeholder: 'Напр. Frankfurt', defaultOperator: 'contains' },
      { key: 'status', label: 'Статус', type: 'multiselect' as const, options: statusOpts, defaultOperator: 'is_any_of' },
      { key: 'environment', label: 'Окружение', type: 'multiselect' as const, options: envOpts, defaultOperator: 'is_any_of' },
      { key: 'tariffType', label: 'Тариф', type: 'multiselect' as const, options: tariffOpts, defaultOperator: 'is_any_of' },
      { key: 'monitoring', label: 'Мониторинг', type: 'multiselect' as const, options: onOffOpts, defaultOperator: 'is_any_of' },
      { key: 'backup', label: 'Бэкап', type: 'multiselect' as const, options: onOffOpts, defaultOperator: 'is_any_of' },
      { key: 'project', label: 'Проект', type: 'multiselect' as const, options: projectOpts, searchable: true, defaultOperator: 'is_any_of' },
      {
        key: 'paidUntil',
        label: 'Оплачено до',
        type: 'custom' as const,
        defaultOperator: 'before',
        operators: [
          { value: 'before', label: 'до' },
          { value: 'after', label: 'после' },
          { value: 'between', label: 'между' },
          { value: 'is', label: '=' },
        ],
        customRenderer: ({ values, onChange: onCh, operator }: CustomRendererProps<string>) => (
          <div className="p-2">
            <DateSelector
              value={toDateSelectorValue(values, operator)}
              onChange={(v) => onCh(fromDateSelectorValue(v))}
              allowRange={operator === 'between'}
              presetMode={operator as DateSelectorFilterType}
              i18n={RU_DATE_SELECTOR_I18N}
              showTwoMonths={operator === 'between'}
              dayDateFormat="dd.MM.yyyy"
            />
          </div>
        ),
      },
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
    ]
  }, [providers, providerAccounts, vps, countryOptions, cityOptions, projectNameOptions])

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
    if (filters.city.length) {
      out.push({
        id: 'city',
        label: `Город: ${filters.city.join(', ')}`,
        onRemove: () => onChange({ ...filters, city: [] }),
      })
    }
    if (filters.datacenter) {
      out.push({
        id: 'datacenter',
        label: `ДЦ: ${filters.datacenter}`,
        onRemove: () => onChange({ ...filters, datacenter: '' }),
      })
    }
    if (filters.status.length) {
      out.push({
        id: 'status',
        label: `Статус: ${filters.status.map(vpsStatusLabel).join(', ')}`,
        onRemove: () => onChange({ ...filters, status: [] }),
      })
    }
    if (filters.environment.length) {
      out.push({
        id: 'environment',
        label: `Окружение: ${filters.environment.map(environmentLabel).join(', ')}`,
        onRemove: () => onChange({ ...filters, environment: [] }),
      })
    }
    if (filters.tariffType.length) {
      out.push({
        id: 'tariffType',
        label: `Тариф: ${filters.tariffType.map(tariffTypeLabel).join(', ')}`,
        onRemove: () => onChange({ ...filters, tariffType: [] }),
      })
    }
    if (filters.monitoring.length) {
      out.push({
        id: 'monitoring',
        label: `Мониторинг: ${filters.monitoring.join(', ')}`,
        onRemove: () => onChange({ ...filters, monitoring: [] }),
      })
    }
    if (filters.backup.length) {
      out.push({
        id: 'backup',
        label: `Бэкап: ${filters.backup.join(', ')}`,
        onRemove: () => onChange({ ...filters, backup: [] }),
      })
    }
    if (filters.project.length) {
      out.push({
        id: 'project',
        label: `Проект: ${filters.project.map((p) => (p === '__none__' ? 'Без проекта' : p)).join(', ')}`,
        onRemove: () => onChange({ ...filters, project: [] }),
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
    if (filters.paidUntilStart) {
      const op = filters.paidUntilOperator ?? 'before'
      const start = new Date(filters.paidUntilStart).toLocaleDateString('ru-RU')
      const end = filters.paidUntilEnd
        ? new Date(filters.paidUntilEnd).toLocaleDateString('ru-RU')
        : null
      const label =
        op === 'between' && end
          ? `Оплачено до: ${start} — ${end}`
          : `Оплачено до ${op === 'after' ? 'после' : op === 'is' ? '' : ''} ${start}`
      out.push({
        id: 'paidUntil',
        label: label.trim(),
        onRemove: () =>
          onChange({
            ...filters,
            paidUntilOperator: null,
            paidUntilStart: null,
            paidUntilEnd: null,
          }),
      })
    }
    if (filters.groupByProject) {
      out.push({
        id: 'groupByProject',
        label: 'Группировка по проекту',
        onRemove: () => onChange({ ...filters, groupByProject: false }),
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

  const hasActive = hasActiveVpsFilters(filters)

  const savePreset = () => {
    const name = window.prompt('Имя пресета фильтров', `Пресет ${presets.length + 1}`)
    if (!name) return
    const next = [...presets.filter((p) => p.name !== name), { name, filters }]
    setPresets(next)
    saveFilterPresets(next)
  }

  const applyPreset = (preset: VpsFilterPreset) => {
    onChange({ ...buildDefaultVpsFilters(), ...preset.filters })
  }

  const deletePreset = (name: string) => {
    const next = presets.filter((p) => p.name !== name)
    setPresets(next)
    saveFilterPresets(next)
  }

  const reset = () => onChange(buildDefaultVpsFilters())

  return (
    <ListFiltersBar
      search={{
        value: filters.search,
        onChange: (search) => onChange({ ...filters, search }),
        placeholder: 'Поиск: IP, DNS, проект, назначение, ОС',
        name: 'vps-inventory-search',
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
                      checked={filters.groupByProject}
                      onCheckedChange={(v) => onChange({ ...filters, groupByProject: Boolean(v) })}
                    />
                    <span className="text-sm">Группировать по проекту</span>
                  </label>
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

                <Separator />

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Пресеты</Label>
                    <Button variant="ghost" size="sm" onClick={savePreset} className="h-7 px-2">
                      <SaveIcon className="size-3.5" />
                      Сохранить
                    </Button>
                  </div>
                  {presets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Нет сохранённых пресетов</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {presets.map((p) => (
                        <div
                          key={p.name}
                          className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-accent"
                        >
                          <button
                            type="button"
                            onClick={() => applyPreset(p)}
                            className="flex-1 truncate text-start text-sm"
                          >
                            {p.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePreset(p.name)}
                            aria-label="Удалить пресет"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Trash2Icon className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </>
      }
      chips={chips}
      shown={shownCount}
      total={totalCount}
      showReset={hasActive}
      onReset={reset}
    />
  )
}

// Обратная совместимость — не используется напрямую, но экспортируем
export { stateToActiveFilters }
