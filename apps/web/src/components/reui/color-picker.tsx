import { useId, useMemo, useState } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@cfdm/ui/lib/utils'
import { Input } from '@cfdm/ui/components/input'
import { Popover, PopoverContent, PopoverTrigger } from '@cfdm/ui/components/popover'

const PROJECT_COLOR_PRESETS = [
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#64748b',
  '#18181b',
] as const

const colorPickerGroupVariants = cva(
  'relative flex w-full items-stretch overflow-hidden rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
  {
    variants: {
      size: {
        sm: 'h-7 text-sm',
        default: 'h-8 text-sm',
        lg: 'h-9 text-sm',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

const colorPickerSwatchVariants = cva(
  'flex shrink-0 cursor-pointer items-center justify-center border-e border-input transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'w-9',
        default: 'w-10',
        lg: 'w-11',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

const colorPickerInputVariants = cva(
  'min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent',
  {
    variants: {
      size: {
        sm: 'h-7 rounded-e-lg px-2',
        default: 'h-8 rounded-e-lg px-2.5',
        lg: 'h-9 rounded-e-lg px-2.5',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

function isValidHex(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value.trim())
}

function normalizeHex(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (/^#[0-9A-Fa-f]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
    return withHash.toLowerCase()
  }
  return withHash
}

function toPickerValue(value: string): string {
  const normalized = normalizeHex(value)
  return isValidHex(normalized) ? normalized : '#3b82f6'
}

interface ColorPickerProps extends VariantProps<typeof colorPickerGroupVariants> {
  id?: string
  value?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  placeholder?: string
  'aria-invalid'?: boolean
  className?: string
}

function ColorPicker({
  id,
  value = '',
  onChange,
  onBlur,
  disabled,
  placeholder = '#3b82f6',
  size = 'default',
  className,
  'aria-invalid': ariaInvalid,
}: ColorPickerProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [open, setOpen] = useState(false)
  const sizeValue = size ?? 'default'

  const displayValue = value ?? ''
  const swatchColor = useMemo(() => {
    const normalized = normalizeHex(displayValue)
    return isValidHex(normalized) ? normalized : undefined
  }, [displayValue])

  const handleHexChange = (next: string) => {
    onChange?.(next)
  }

  const handleHexBlur = () => {
    const normalized = normalizeHex(displayValue)
    if (normalized !== displayValue) {
      onChange?.(normalized)
    }
    onBlur?.()
  }

  const applyColor = (next: string) => {
    onChange?.(normalizeHex(next))
  }

  return (
    <div
      className={cn(colorPickerGroupVariants({ size: sizeValue }), className)}
      data-slot="color-picker"
      data-size={sizeValue}
      aria-invalid={ariaInvalid}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          render={
            <button
              type="button"
              className={cn(colorPickerSwatchVariants({ size: sizeValue }))}
              aria-label="Выбрать цвет"
              disabled={disabled}
            >
              <span
                className={cn(
                  'size-4 rounded-sm ring-1 ring-foreground/10',
                  !swatchColor && 'bg-muted',
                )}
                style={swatchColor ? { backgroundColor: swatchColor } : undefined}
              />
            </button>
          }
        />
        <PopoverContent align="start" className="w-64 gap-3 p-3">
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            Палитра
            <input
              type="color"
              value={toPickerValue(displayValue)}
              disabled={disabled}
              className="h-28 w-full cursor-pointer rounded-md border border-input bg-transparent p-1"
              onChange={(e) => applyColor(e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">Быстрый выбор</span>
            <div className="grid grid-cols-6 gap-1.5">
              {PROJECT_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={preset}
                  disabled={disabled}
                  className={cn(
                    'aspect-square rounded-md ring-1 ring-foreground/10 transition-transform hover:scale-105',
                    swatchColor === preset && 'ring-2 ring-ring',
                  )}
                  style={{ backgroundColor: preset }}
                  onClick={() => {
                    applyColor(preset)
                    setOpen(false)
                  }}
                />
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <Input
        id={inputId}
        value={displayValue}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        className={colorPickerInputVariants({ size: sizeValue })}
        style={swatchColor ? { color: swatchColor } : undefined}
        onChange={(e) => handleHexChange(e.target.value)}
        onBlur={handleHexBlur}
      />
    </div>
  )
}

export { ColorPicker, normalizeHex, isValidHex, PROJECT_COLOR_PRESETS }
