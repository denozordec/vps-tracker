import * as React from 'react'
import { CheckIcon, SearchIcon } from 'lucide-react'

import { Input } from '@cfdm/ui/components/input'
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
  /** Показывать ли выбранный leading в самом Input (например флаг). */
  showLeadingInInput?: boolean
}

export function AutoCompleteInput({
  id,
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = 'Поиск…',
  emptyText = 'Ничего не найдено',
  className,
  showLeadingInInput = true,
}: AutoCompleteInputProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
  }, [options, query])

  const selected = options.find((o) => o.value.toLowerCase() === value.trim().toLowerCase())
  const leading = selected?.leading

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <div className="relative">
            {showLeadingInInput && leading ? (
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-base leading-none">
                {leading}
              </span>
            ) : null}
            <Input
              id={id}
              role="combobox"
              aria-expanded={open}
              placeholder={placeholder}
              value={value}
              onChange={(e) => {
                onChange(e.target.value)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                // задержка чтобы клик по item успел сработать
                setTimeout(() => setOpen(false), 150)
              }}
              className={cn(
                showLeadingInInput && leading ? 'pl-8' : '',
                className,
              )}
            />
          </div>
        }
      />
      <PopoverContent align="start" className="w-[--anchor-width] p-0">
        <Command shouldFilter={false} loop>
          <div className="flex items-center gap-2 border-b px-3">
            <SearchIcon className="size-4 text-muted-foreground" />
            <CommandInput
              placeholder={searchPlaceholder}
              value={query}
              onValueChange={setQuery}
              className="h-9"
            />
          </div>
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filtered.map((opt) => {
                const isSelected = opt.value.toLowerCase() === value.trim().toLowerCase()
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.value}
                    onSelect={() => {
                      onChange(opt.value)
                      setQuery('')
                      setOpen(false)
                    }}
                    className="gap-2"
                  >
                    {opt.leading ? <span className="text-base leading-none">{opt.leading}</span> : null}
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
