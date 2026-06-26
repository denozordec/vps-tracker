import * as React from 'react'
import { CheckIcon, ChevronsUpDownIcon, SearchIcon } from 'lucide-react'

import { Button } from '@cfdm/ui/components/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@cfdm/ui/components/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cfdm/ui/components/popover'
import { cn } from '@cfdm/ui/lib/utils'

export interface AutoCompleteOption {
  value: string
  label: string
  /** Левый префикс (например эмодзи-флаг). */
  leading?: React.ReactNode
}

interface AutoCompleteInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  options: AutoCompleteOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  /** Показывать ли выбранный leading в триггере (например флаг). */
  showLeadingInInput?: boolean
  /** Разрешать ли произвольный ввод (не только из списка). По умолчанию true. */
  allowFreeText?: boolean
}

export function AutoCompleteInput({
  id,
  value,
  onChange,
  options,
  placeholder = 'Выбрать…',
  searchPlaceholder = 'Поиск…',
  emptyText = 'Ничего не найдено',
  className,
  showLeadingInInput = true,
  allowFreeText = true,
}: AutoCompleteInputProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    )
  }, [options, query])

  const selected = options.find(
    (o) => o.value.toLowerCase() === value.trim().toLowerCase(),
  )
  const displayLabel = selected?.label ?? value
  const leading = showLeadingInInput ? selected?.leading : undefined

  const handleSelect = (next: string) => {
    onChange(next)
    setQuery('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o)
      if (!o) setQuery('')
    }}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between font-normal', className)}
          >
            <span className="flex min-w-0 items-center gap-2">
              {leading ? <span className="size-4 shrink-0 leading-none">{leading}</span> : null}
              <span className={cn('truncate', !value && 'text-muted-foreground')}>
                {value ? displayLabel : placeholder}
              </span>
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-[--anchor-width] min-w-[220px] p-0">
        <Command shouldFilter={false} loop>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <CommandList className="py-1">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {allowFreeText && query.trim() && !filtered.some(
                (o) => o.label.toLowerCase() === query.trim().toLowerCase(),
              ) ? (
                <CommandItem
                  value={`__free__:${query.trim()}`}
                  onSelect={() => handleSelect(query.trim())}
                  className="gap-2.5"
                >
                  <SearchIcon className="size-4 opacity-50" />
                  <span className="flex-1 truncate">
                    Использовать: <b>{query.trim()}</b>
                  </span>
                </CommandItem>
              ) : null}
              {filtered.map((opt) => {
                const isSelected = opt.value.toLowerCase() === value.trim().toLowerCase()
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => handleSelect(opt.value)}
                    className="gap-2.5"
                  >
                    {opt.leading ? (
                      <span className="size-4 shrink-0 leading-none">{opt.leading}</span>
                    ) : null}
                    <span className="flex-1">{opt.label}</span>
                    {isSelected ? <CheckIcon className="size-4 opacity-60" /> : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
