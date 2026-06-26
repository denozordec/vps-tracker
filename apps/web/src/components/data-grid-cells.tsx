import type { ReactNode } from 'react'

import { cn } from '@cfdm/ui/lib/utils'

export function dataGridCellStack(
  primary: ReactNode,
  secondary?: ReactNode,
  className?: string,
) {
  return (
    <div className={cn('flex flex-col', className)}>
      <span className="font-medium">{primary}</span>
      {secondary ? <span className="text-xs text-muted-foreground">{secondary}</span> : null}
    </div>
  )
}

export function dataGridCellWithIcon(
  icon: ReactNode,
  children: ReactNode,
  className?: string,
) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="shrink-0 text-muted-foreground">{icon}</span>
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
    <div className="flex items-center gap-2">
      <span className="size-4 shrink-0 leading-none">{flag}</span>
      {secondary ? dataGridCellStack(primary, secondary) : <span className="font-medium">{primary}</span>}
    </div>
  )
}
