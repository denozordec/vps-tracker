import { SearchIcon, XIcon } from 'lucide-react'

import { Input } from '@cfdm/ui/components/input'
import { Button } from '@cfdm/ui/components/button'
import { Checkbox } from '@cfdm/ui/components/checkbox'
import { SelectField } from '@/components/select-field'
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
}

export function AccountFiltersToolbar({ filters, onChange, providers }: AccountFiltersToolbarProps) {
  const active = hasActiveAccountFilters(filters)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Поиск по названию или логину"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </div>
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
        {active ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(buildDefaultAccountFilters())}
          >
            <XIcon data-icon="inline-start" />
            Сбросить
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={filters.syncableOnly}
            onCheckedChange={(v) => onChange({ ...filters, syncableOnly: v === true })}
          />
          <span>Готовы к синку</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={filters.issuesOnly}
            onCheckedChange={(v) => onChange({ ...filters, issuesOnly: v === true })}
          />
          <span>С проблемами</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={filters.lowBalanceOnly}
            onCheckedChange={(v) => onChange({ ...filters, lowBalanceOnly: v === true })}
          />
          <span>Низкий баланс</span>
        </label>
      </div>
    </div>
  )
}
