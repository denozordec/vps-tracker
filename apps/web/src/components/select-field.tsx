import * as React from 'react'
import type { SelectRootProps } from '@base-ui/react/select'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@cfdm/ui/components/select'
import { cn } from '@cfdm/ui/lib/utils'

export interface SelectOption {
  value: string
  label: React.ReactNode
}

interface SelectFieldProps extends Omit<SelectRootProps<string>, 'items' | 'value' | 'onValueChange'> {
  options: SelectOption[]
  placeholder?: string
  triggerClassName?: string
  triggerId?: string
  size?: 'sm' | 'default'
  value?: string | null
  onValueChange?: (value: string | null) => void
  invalid?: boolean
  'aria-label'?: string
}

export function SelectField({
  options,
  placeholder,
  triggerClassName,
  triggerId,
  size = 'default',
  value,
  onValueChange,
  invalid,
  'aria-label': ariaLabel,
  ...props
}: SelectFieldProps) {
  const items = React.useMemo(
    () => options.map((o) => ({ value: o.value, label: o.label })),
    [options],
  )

  return (
    <Select items={items} value={value} onValueChange={onValueChange} {...props}>
      <SelectTrigger
        id={triggerId}
        size={size}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn('w-full', triggerClassName)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
