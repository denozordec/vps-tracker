import type { ReactNode } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'

import { Input } from '@cfdm/ui/components/input'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { cn } from '@cfdm/ui/lib/utils'

export interface FilterChip {
  id: string
  label: string
  onRemove: () => void
}

interface ListFiltersSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
  name?: string
  autoComplete?: string
  spellCheck?: boolean
}

export function ListFiltersSearch({
  value,
  onChange,
  placeholder,
  className,
  name,
  autoComplete = 'off',
  spellCheck = false,
}: ListFiltersSearchProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-8"
        autoComplete={autoComplete}
        name={name}
        spellCheck={spellCheck}
      />
    </div>
  )
}

export function FilterActiveChips({ chips }: { chips: FilterChip[] }) {
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Badge key={chip.id} variant="secondary" className="gap-1 pr-1 font-normal">
          <span className="max-w-[12rem] truncate">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="rounded-sm p-0.5 hover:bg-muted"
            aria-label={`Убрать фильтр: ${chip.label}`}
          >
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}

export function FilterResultsCount({
  shown,
  total,
  suffix,
}: {
  shown: number
  total: number
  suffix?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>
        Показано {shown} из {total}
      </span>
      {suffix ? <span className="text-muted-foreground/80">{suffix}</span> : null}
    </div>
  )
}

export function FilterResetButton({ onClick, visible }: { onClick: () => void; visible: boolean }) {
  if (!visible) return null
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      <XIcon data-icon="inline-start" />
      Сбросить
    </Button>
  )
}

interface FilterToggleChipProps {
  label: string
  active: boolean
  onClick: () => void
}

export function FilterToggleChip({ label, active, onClick }: FilterToggleChipProps) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'outline'}
      size="sm"
      onClick={onClick}
      className={cn(active && 'border-primary/40')}
    >
      {label}
    </Button>
  )
}

interface ListFiltersBarProps {
  search?: ListFiltersSearchProps
  controls?: ReactNode
  chips?: FilterChip[]
  shown?: number
  total?: number
  resultsSuffix?: ReactNode
  onReset?: () => void
  showReset?: boolean
  toggles?: ReactNode
}

export function ListFiltersBar({
  search,
  controls,
  chips,
  shown,
  total,
  resultsSuffix,
  onReset,
  showReset,
  toggles,
}: ListFiltersBarProps) {
  const hasMeta =
    chips?.length ||
    (shown != null && total != null) ||
    resultsSuffix ||
    (showReset && onReset)

  return (
    <div className="flex flex-col gap-2">
      {search ? <ListFiltersSearch {...search} /> : null}
      {controls || toggles ? (
        <div className="flex flex-wrap items-center gap-2">
          {controls}
          {toggles}
          {onReset ? <FilterResetButton onClick={onReset} visible={Boolean(showReset)} /> : null}
        </div>
      ) : null}
      {hasMeta ? (
        <div className="flex flex-col gap-1.5">
          {chips?.length ? <FilterActiveChips chips={chips} /> : null}
          {shown != null && total != null ? (
            <FilterResultsCount shown={shown} total={total} suffix={resultsSuffix} />
          ) : resultsSuffix ? (
            <div className="text-xs text-muted-foreground">{resultsSuffix}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
