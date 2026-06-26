import { useMemo } from 'react'
import { SearchIcon, FilterIcon, XIcon, SaveIcon, TrashIcon } from 'lucide-react'

import { Input } from '@cfdm/ui/components/input'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { Card, CardContent } from '@cfdm/ui/components/card'
import { Checkbox } from '@cfdm/ui/components/checkbox'
import { Label } from '@cfdm/ui/components/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@cfdm/ui/components/dropdown-menu'

import { SelectField } from '@/components/select-field'
import { vpsStatusLabel, tariffTypeLabel, environmentLabel } from '@/lib/format'
import type { Provider, ProviderAccount, Vps } from '@/types/entities'

export interface VpsFiltersState {
  search: string
  providerId: string
  providerAccountId: string
  country: string
  city: string
  datacenter: string
  status: string // 'all' | VpsStatus
  environment: string // 'all' | env
  tariffType: string // 'all' | TariffType
  monitoring: string // 'all' | 'on' | 'off'
  backup: string // 'all' | 'on' | 'off'
  minVcpu: string
  minRamGb: string
  minDiskGb: string
  project: string // '' | '__none__' | name
  groupByProject: boolean
  tableCompact: boolean
}

export function buildDefaultVpsFilters(): VpsFiltersState {
  return {
    search: '',
    providerId: '',
    providerAccountId: '',
    country: '',
    city: '',
    datacenter: '',
    status: 'all',
    environment: 'all',
    tariffType: 'all',
    monitoring: 'all',
    backup: 'all',
    minVcpu: '',
    minRamGb: '',
    minDiskGb: '',
    project: '',
    groupByProject: false,
    tableCompact: false,
  }
}

const ALL = 'all'

const STATUS_OPTIONS = [
  { value: ALL, label: 'Все статусы' },
  { value: 'active', label: vpsStatusLabel('active') },
  { value: 'paused', label: vpsStatusLabel('paused') },
  { value: 'archived', label: vpsStatusLabel('archived') },
]

const ENV_OPTIONS = [
  { value: ALL, label: 'Все окружения' },
  { value: 'prod', label: environmentLabel('prod') },
  { value: 'dev', label: environmentLabel('dev') },
  { value: 'staging', label: environmentLabel('staging') },
]

const TARIFF_OPTIONS = [
  { value: ALL, label: 'Все тарифы' },
  { value: 'monthly', label: tariffTypeLabel('monthly') },
  { value: 'daily', label: tariffTypeLabel('daily') },
]

const ON_OFF_OPTIONS = [
  { value: ALL, label: 'Любое' },
  { value: 'on', label: 'Включено' },
  { value: 'off', label: 'Выключено' },
]

const PRESETS_KEY = 'vps-tracker:vps-filter-presets'

export interface VpsFilterPreset {
  name: string
  filters: VpsFiltersState
}

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

function saveFilterPresets(presets: VpsFilterPreset[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
  } catch {
    /* ignore */
  }
}

export function applyVpsFilters(items: Vps[], filters: VpsFiltersState): Vps[] {
  const search = filters.search.toLowerCase()
  const minVcpu = Number(filters.minVcpu || 0)
  const minRamGb = Number(filters.minRamGb || 0)
  const minDiskGb = Number(filters.minDiskGb || 0)
  return items.filter((item) => {
    const extraIps = Array.isArray(item.additionalIps) ? item.additionalIps.join(' ') : ''
    if (
      search &&
      !item.ip?.toLowerCase().includes(search) &&
      !item.dns?.toLowerCase().includes(search) &&
      !item.ipv6?.toLowerCase().includes(search) &&
      !extraIps.toLowerCase().includes(search) &&
      !item.project?.toLowerCase().includes(search) &&
      !item.purpose?.toLowerCase().includes(search) &&
      !item.os?.toLowerCase().includes(search)
    )
      return false
    if (filters.providerId && item.providerId !== filters.providerId) return false
    if (filters.providerAccountId && item.providerAccountId !== filters.providerAccountId) return false
    if (filters.country && !item.country?.toLowerCase().includes(filters.country.toLowerCase())) return false
    if (filters.city && !item.city?.toLowerCase().includes(filters.city.toLowerCase())) return false
    if (filters.datacenter && !item.datacenter?.toLowerCase().includes(filters.datacenter.toLowerCase())) return false
    if (filters.status !== ALL && item.status !== filters.status) return false
    if (filters.environment !== ALL && item.environment !== filters.environment) return false
    if (filters.tariffType !== ALL && item.tariffType !== filters.tariffType) return false
    if (filters.monitoring !== ALL) {
      const on = filters.monitoring === 'on'
      if (on !== Boolean(item.monitoringEnabled)) return false
    }
    if (filters.backup !== ALL) {
      const on = filters.backup === 'on'
      if (on !== Boolean(item.backupEnabled)) return false
    }
    if (minVcpu && Number(item.vcpu || 0) < minVcpu) return false
    if (minRamGb && Number(item.ramGb || 0) < minRamGb) return false
    if (minDiskGb && Number(item.diskGb || 0) < minDiskGb) return false
    const proj = (item.project || '').trim()
    if (filters.project) {
      if (filters.project === '__none__' ? proj : proj !== filters.project) return false
    }
    return true
  })
}

export function countActiveFilters(filters: VpsFiltersState): number {
  let n = 0
  if (filters.search) n++
  if (filters.providerId) n++
  if (filters.providerAccountId) n++
  if (filters.country) n++
  if (filters.city) n++
  if (filters.datacenter) n++
  if (filters.status !== ALL) n++
  if (filters.environment !== ALL) n++
  if (filters.tariffType !== ALL) n++
  if (filters.monitoring !== ALL) n++
  if (filters.backup !== ALL) n++
  if (filters.minVcpu) n++
  if (filters.minRamGb) n++
  if (filters.minDiskGb) n++
  if (filters.project) n++
  return n
}

interface VpsFiltersProps {
  filters: VpsFiltersState
  onChange: (next: VpsFiltersState) => void
  providers: Provider[]
  providerAccounts: ProviderAccount[]
  projectNameOptions: string[]
  presets: VpsFilterPreset[]
  onPresetsChange: (presets: VpsFilterPreset[]) => void
}

export function VpsFilters({
  filters,
  onChange,
  providers,
  providerAccounts,
  projectNameOptions,
  presets,
  onPresetsChange,
}: VpsFiltersProps) {
  const update = <K extends keyof VpsFiltersState>(key: K, value: VpsFiltersState[K]) =>
    onChange({ ...filters, [key]: value })

  const accountOptions = useMemo(
    () =>
      providerAccounts.filter(
        (a) => !filters.providerId || a.providerId === filters.providerId,
      ),
    [providerAccounts, filters.providerId],
  )

  const activeCount = countActiveFilters(filters)
  const hasFilters = activeCount > 0 || filters.groupByProject || filters.tableCompact

  const savePreset = () => {
    const name = window.prompt('Имя пресета фильтров', `Пресет ${presets.length + 1}`)
    if (!name) return
    const next = [...presets.filter((p) => p.name !== name), { name, filters }]
    onPresetsChange(next)
    saveFilterPresets(next)
  }

  const applyPreset = (preset: VpsFilterPreset) => {
    onChange({ ...buildDefaultVpsFilters(), ...preset.filters })
  }

  const deletePreset = (name: string) => {
    const next = presets.filter((p) => p.name !== name)
    onPresetsChange(next)
    saveFilterPresets(next)
  }

  const reset = () => onChange(buildDefaultVpsFilters())

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск: IP, DNS, проект, назначение, ОС"
              value={filters.search}
              onChange={(e) => update('search', e.target.value)}
              className="pl-8"
            />
          </div>
          <SelectField
            triggerId="flt-status"
            value={filters.status}
            onValueChange={(v) => update('status', v ?? ALL)}
            options={STATUS_OPTIONS}
            triggerClassName="w-44"
          />
          <SelectField
            triggerId="flt-provider"
            placeholder="Все хостеры"
            value={filters.providerId || null}
            onValueChange={(v) =>
              onChange({ ...filters, providerId: v ?? '', providerAccountId: '' })
            }
            options={providers.map((p) => ({ value: p.id, label: p.name }))}
            triggerClassName="w-44"
          />
          <SelectField
            triggerId="flt-account"
            placeholder="Все аккаунты"
            value={filters.providerAccountId || null}
            onValueChange={(v) => update('providerAccountId', v ?? '')}
            options={accountOptions.map((a) => ({ value: a.id, label: a.name }))}
            triggerClassName="w-44"
          />
          <SelectField
            triggerId="flt-project"
            placeholder="Все проекты"
            value={filters.project || null}
            onValueChange={(v) => update('project', v ?? '')}
            options={[
              { value: '__none__', label: 'Без проекта' },
              ...projectNameOptions.map((p) => ({ value: p, label: p })),
            ]}
            triggerClassName="w-44"
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <FilterIcon data-icon="inline-start" />
                  Доп. фильтры
                  {activeCount > 0 ? <Badge variant="secondary">{activeCount}</Badge> : null}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56" />
          </DropdownMenu>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              <XIcon data-icon="inline-start" />
              Сбросить
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={savePreset}>
            <SaveIcon data-icon="inline-start" />
            Сохранить пресет
          </Button>
          {presets.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="sm">Пресеты ({presets.length})</Button>}
              />
              <DropdownMenuContent align="end" className="w-56">
                {presets.map((p) => (
                  <DropdownMenuItem
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className="justify-between"
                  >
                    <span className="truncate">{p.name}</span>
                    <TrashIcon
                      className="size-4 text-muted-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        deletePreset(p.name)
                      }}
                    />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="flt-country" className="text-xs text-muted-foreground">Страна</Label>
            <Input
              id="flt-country"
              placeholder="Любая"
              value={filters.country}
              onChange={(e) => update('country', e.target.value)}
              className="w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="flt-city" className="text-xs text-muted-foreground">Город</Label>
            <Input
              id="flt-city"
              placeholder="Любой"
              value={filters.city}
              onChange={(e) => update('city', e.target.value)}
              className="w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="flt-dc" className="text-xs text-muted-foreground">Дата-центр</Label>
            <Input
              id="flt-dc"
              placeholder="Любой"
              value={filters.datacenter}
              onChange={(e) => update('datacenter', e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Окружение</Label>
            <SelectField
              triggerId="flt-env"
              value={filters.environment}
              onValueChange={(v) => update('environment', v ?? ALL)}
              options={ENV_OPTIONS}
              triggerClassName="w-44"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Тариф</Label>
            <SelectField
              triggerId="flt-tariff"
              value={filters.tariffType}
              onValueChange={(v) => update('tariffType', v ?? ALL)}
              options={TARIFF_OPTIONS}
              triggerClassName="w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Мониторинг</Label>
            <SelectField
              triggerId="flt-mon"
              value={filters.monitoring}
              onValueChange={(v) => update('monitoring', v ?? ALL)}
              options={ON_OFF_OPTIONS}
              triggerClassName="w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Бэкап</Label>
            <SelectField
              triggerId="flt-bkp"
              value={filters.backup}
              onValueChange={(v) => update('backup', v ?? ALL)}
              options={ON_OFF_OPTIONS}
              triggerClassName="w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="flt-vcpu" className="text-xs text-muted-foreground">vCPU ≥</Label>
            <Input
              id="flt-vcpu"
              type="number"
              min={0}
              placeholder="0"
              value={filters.minVcpu}
              onChange={(e) => update('minVcpu', e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="flt-ram" className="text-xs text-muted-foreground">RAM ≥</Label>
            <Input
              id="flt-ram"
              type="number"
              min={0}
              placeholder="0"
              value={filters.minRamGb}
              onChange={(e) => update('minRamGb', e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="flt-disk" className="text-xs text-muted-foreground">Disk ≥</Label>
            <Input
              id="flt-disk"
              type="number"
              min={0}
              placeholder="0"
              value={filters.minDiskGb}
              onChange={(e) => update('minDiskGb', e.target.value)}
              className="w-20"
            />
          </div>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={filters.groupByProject}
              onCheckedChange={(v) => update('groupByProject', Boolean(v))}
            />
            <span className="text-sm">Группировать по проекту</span>
          </label>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={filters.tableCompact}
              onCheckedChange={(v) => update('tableCompact', Boolean(v))}
            />
            <span className="text-sm">Компактная таблица</span>
          </label>
        </div>
      </CardContent>
    </Card>
  )
}
