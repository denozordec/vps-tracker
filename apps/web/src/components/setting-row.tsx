import { type ReactNode } from 'react'

import { cn } from '@cfdm/ui/lib/utils'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@cfdm/ui/components/field'

export interface SettingRowProps {
  title: string
  description?: ReactNode
  children: ReactNode
  last?: boolean
  compact?: boolean
  stacked?: boolean
  labelFor?: string
  contentClassName?: string
  className?: string
  titleAddon?: ReactNode
}

/**
 * Compact settings row — preview https://reui.io/preview/base/settings-3 · settings-2
 * Hairline divider via border-b (no FieldSeparator h-5).
 */
export function SettingRow({
  title,
  description,
  children,
  last,
  compact,
  stacked,
  labelFor,
  contentClassName,
  className,
  titleAddon,
}: SettingRowProps) {
  return (
    <Field
      orientation={stacked ? 'vertical' : 'responsive'}
      className={cn(
        'gap-4 px-5 py-3.5',
        !last && 'border-border/40 border-b',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 @md/field-group:max-w-sm">
        <div className="flex flex-wrap items-center gap-2">
          {labelFor ? (
            <FieldLabel htmlFor={labelFor}>{title}</FieldLabel>
          ) : (
            <FieldTitle>{title}</FieldTitle>
          )}
          {titleAddon}
        </div>

        {description ? (
          <FieldDescription className="text-sm">{description}</FieldDescription>
        ) : null}
      </div>

      <FieldContent
        className={cn(
          'w-full min-w-0 @md/field-group:flex-1',
          stacked
            ? 'max-w-none'
            : compact
              ? '@md/field-group:max-w-[17rem] @md/field-group:shrink-0'
              : '@md/field-group:max-w-[34rem]',
          contentClassName,
        )}
      >
        <div
          className={cn(
            'flex w-full justify-start',
            stacked ? 'justify-start' : '@md/field-group:justify-end',
          )}
        >
          {children}
        </div>
      </FieldContent>
    </Field>
  )
}
