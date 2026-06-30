'use client'

import * as React from 'react'
import { CheckIcon } from 'lucide-react'

import { cn } from '@cfdm/ui/lib/utils'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from '@/components/reui/autocomplete'
import { TruncatedText } from '@/components/truncated-text'

export interface AutoCompleteOption {
  value: string
  label: string
  /** Левый префикс (например флаг страны). */
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
  /** Показывать ли выбранный leading в поле (например флаг). */
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
  searchPlaceholder,
  emptyText = 'Ничего не найдено',
  className,
  showLeadingInInput = true,
  allowFreeText = true,
}: AutoCompleteInputProps) {
  const trimmedValue = value.trim()

  const selected = React.useMemo(
    () => options.find((o) => o.value.toLowerCase() === trimmedValue.toLowerCase()),
    [options, trimmedValue],
  )
  const leading = showLeadingInInput ? selected?.leading : undefined

  const inputPlaceholder = searchPlaceholder ?? placeholder

  const handleValueChange = React.useCallback(
    (inputVal: string) => {
      const q = inputVal.trim()
      const match = options.find(
        (o) =>
          o.label.toLowerCase() === q.toLowerCase() ||
          o.value.toLowerCase() === q.toLowerCase(),
      )
      if (match) {
        onChange(match.value)
        return
      }
      if (allowFreeText) {
        onChange(inputVal)
      }
    },
    [options, onChange, allowFreeText],
  )

  return (
    <Autocomplete
      items={options}
      value={value}
      onValueChange={handleValueChange}
      itemToStringValue={(item) => item.label}
      mode="list"
      autoHighlight
      openOnInputClick
    >
      <div className="relative w-full">
        {leading ? (
          <span className="pointer-events-none absolute start-2.5 top-1/2 z-10 size-4 -translate-y-1/2 [&_svg]:size-full">
            {leading}
          </span>
        ) : null}
        <AutocompleteInput
          id={id}
          placeholder={trimmedValue ? undefined : inputPlaceholder}
          showTrigger
          showClear={Boolean(trimmedValue)}
          className={cn(leading && 'ps-8', className)}
        />
      </div>
      <AutocompleteContent>
        <AutocompleteEmpty>{emptyText}</AutocompleteEmpty>
        <AutocompleteList>
          {(item) => {
            const isSelected = item.value.toLowerCase() === trimmedValue.toLowerCase()
            return (
              <AutocompleteItem
                key={item.value}
                value={item}
                className="gap-2.5 px-2 py-1.5"
              >
                {item.leading ? (
                  <span className="relative z-1 size-4 shrink-0">{item.leading}</span>
                ) : null}
                <span className="relative z-1 min-w-0 flex-1">
                  <TruncatedText>{item.label}</TruncatedText>
                </span>
                {isSelected ? (
                  <CheckIcon className="relative z-1 size-4 shrink-0 opacity-60" />
                ) : null}
              </AutocompleteItem>
            )
          }}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  )
}
