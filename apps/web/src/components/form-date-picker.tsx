import { useState } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CalendarIcon, XIcon } from 'lucide-react'

import { Button } from '@cfdm/ui/components/button'
import { Calendar } from '@cfdm/ui/components/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@cfdm/ui/components/popover'
import { cn } from '@cfdm/ui/lib/utils'

interface FormDatePickerProps {
  id?: string
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function FormDatePicker({
  id,
  value = '',
  onChange,
  placeholder = 'Выберите дату',
  className,
}: FormDatePickerProps) {
  const [open, setOpen] = useState(false)
  const parsed = value ? parseISO(value) : undefined
  const selected = parsed && isValid(parsed) ? parsed : undefined
  const label = selected
    ? format(selected, 'd MMMM yyyy', { locale: ru })
    : placeholder

  return (
    <div className={cn('relative w-full', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn(
                'w-full justify-start pe-9 font-normal',
                !selected && 'text-muted-foreground',
              )}
            >
              <CalendarIcon data-icon="inline-start" />
              {label}
            </Button>
          }
        />
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, 'yyyy-MM-dd'))
                setOpen(false)
              }
            }}
            defaultMonth={selected}
            locale={ru}
            weekStartsOn={1}
          />
        </PopoverContent>
      </Popover>
      {selected ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute end-1 top-1/2 -translate-y-1/2"
          aria-label="Очистить дату"
          onClick={() => onChange('')}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  )
}
