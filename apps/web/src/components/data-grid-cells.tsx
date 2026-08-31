import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { IconTile } from '@/components/reui/icon-tile'
import { TruncatedText } from '@/components/truncated-text'
import { cn } from '@cfdm/ui/lib/utils'

export function dataGridCellStack(
  primary: ReactNode,
  secondary?: ReactNode,
  className?: string,
) {
  return (
    <div className={cn('flex min-w-0 flex-col leading-tight', className)}>
      {typeof primary === 'string' || typeof primary === 'number' ? (
        <TruncatedText className="font-medium">{primary}</TruncatedText>
      ) : (
        <span className="truncate font-medium">{primary}</span>
      )}
      {secondary ? (
        typeof secondary === 'string' || typeof secondary === 'number' ? (
          <TruncatedText className="max-w-[14rem] text-xs text-muted-foreground">{secondary}</TruncatedText>
        ) : (
          <span className="max-w-[14rem] truncate text-xs text-muted-foreground">{secondary}</span>
        )
      ) : null}
    </div>
  )
}

/**
 * Name cell DNA — IconTile elevated size-10.5 + truncate.
 * Preview: https://reui.io/preview/base/stats-12
 * Docs: https://reui.io/docs/components/base/icon-tile
 */
export function DataGridNameCell({
  icon: Icon,
  title,
  subtitle,
  iconClassName = 'text-muted-foreground',
  className,
}: {
  icon: LucideIcon
  title: ReactNode
  subtitle?: ReactNode
  iconClassName?: string
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <IconTile variant="elevated" className="size-10.5" aria-hidden>
        <Icon className={iconClassName} />
      </IconTile>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium">{title}</span>
        {subtitle ? (
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </div>
    </div>
  )
}

export function dataGridCellWithIcon(
  icon: ReactNode,
  children: ReactNode,
  className?: string,
) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <IconTile variant="elevated" className="size-10.5" aria-hidden>
        {icon}
      </IconTile>
      {children}
    </div>
  )
}

export function dataGridCellWithFlag(
  flag: ReactNode,
  primary: ReactNode,
  secondary?: ReactNode,
) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-4 shrink-0 items-center justify-center">{flag}</span>
      {secondary ? dataGridCellStack(primary, secondary) : <span className="font-medium">{primary}</span>}
    </div>
  )
}
