import { useMemo, useState } from 'react'
import { SearchIcon, SlidersHorizontalIcon, SaveIcon, Trash2Icon, XIcon } from 'lucide-react'

import { Input } from '@cfdm/ui/components/input'
import { Button } from '@cfdm/ui/components/button'
import { Checkbox } from '@cfdm/ui/components/checkbox'
import { Label } from '@cfdm/ui/components/label'
import { Separator } from '@cfdm/ui/components/separator'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cfdm/ui/components/popover'
import { Slider } from '@cfdm/ui/components/slider'
import { PlusIcon } from 'lucide-react'

import {
  Filters,
  createFilter,
  type Filter,
  type FilterFieldConfig,
  type FilterI18nConfig,
  type FilterOption,
} from '@/components/reui/filters'
import {
  type VpsFiltersState,
  buildDefaultVpsFilters,
  stateToActiveFilters,
  loadFilterPresets,
  saveFilterPresets,
  type VpsFilterPreset,
} from '@/components/vps-filters'
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
        key: 'minVcpu',
        label: 'vCPU ≥',
        type: 'custom' as const,
        defaultOperator: 'is',
        operators: [{ value: 'is', label: '≥' }],
        customRenderer: ({ values, onChange: onCh }: { values: number[]; onChange: (v: number[]) => void; operator: string }) => (
          <div className="flex items-center gap-2 px-2 py-1 w-44">
            <Slider
              min={0}
              max={32}
              step={1}
              value={values[0] ?? 0}
              onValueChange={(v) => onCh([typeof v === 'number' ? v : (v[0] ?? 0)])}
              className="flex-1"
            />
            <span className="w-8 text-sm tabular-nums text-end">{values[0] ?? 0}</span>
          </div>
        ),
      },
      {
        key: 'minRamGb',
        label: 'RAM ≥',
        type: 'custom' as const,
        defaultOperator: 'is',
        operators: [{ value: 'is', label: '≥' }],
        customRenderer: ({ values, onChange: onCh }: { values: number[]; onChange: (v: number[]) => void; operator: string }) => (
          <div className="flex items-center gap-2 px-2 py-1 w-44">
            <Slider
              min={0}
              max={256}
              step={1}
              value={values[0] ?? 0}
              onValueChange={(v) => onCh([typeof v === 'number' ? v : (v[0] ?? 0)])}
              className="flex-1"
            />
            <span className="w-10 text-sm tabular-nums text-end">{values[0] ?? 0} GB</span>
          </div>
        ),
      },
      {
        key: 'minDiskGb',
        label: 'Disk ≥',
        type: 'custom' as const,
        defaultOperator: 'is',
        operators: [{ value: 'is', label: '≥' }],
        customRenderer: ({ values, onChange: onCh }: { values: number[]; onChange: (v: number[]) => void; operator: string }) => (
          <div className="flex items-center gap-2 px-2 py-1 w-44">
            <Slider
              min={0}
              max={2000}
              step={10}
              value={values[0] ?? 0}
              onValueChange={(v) => onCh([typeof v === 'number' ? v : (v[0] ?? 0)])}
              className="flex-1"
            />
            <span className="w-14 text-sm tabular-nums text-end">{values[0] ?? 0} GB</span>
          </div>
        ),
      },
    ]
  }, [providers, providerAccounts, vps, countryOptions, cityOptions, projectNameOptions])

  const handleFiltersChange = (next: Filter[]) => {
    onChange(filtersToState(next, filters))
  }

  const hasActive = reuiFilters.length > 0 || filters.search || filters.groupByProject || filters.tableCompact

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
    <div className="flex flex-col gap-2">
      <div className="relative w-full">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск: IP, DNS, проект, назначение, ОС"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-8"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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
                    <div key={p.name} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-accent">
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

      {hasActive ? (
        <Button variant="ghost" size="sm" onClick={reset}>
          <XIcon data-icon="inline-start" />
          Сбросить
        </Button>
      ) : null}
      </div>
    </div>
  )
}

// Обратная совместимость — не используется напрямую, но экспортируем
export { stateToActiveFilters }
