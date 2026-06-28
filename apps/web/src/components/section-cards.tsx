import type { ReactElement, ReactNode } from 'react'
import { Card, CardContent } from '@cfdm/ui/components/card'
import { cn } from '@cfdm/ui/lib/utils'

export interface SectionCardItem {
  label: ReactNode
  value: string | number | ReactElement
  hint?: ReactNode
  icon?: ReactNode
  variant?: 'default' | 'warning' | 'destructive'
  onClick?: () => void
}

const VARIANT_CLASS: Record<NonNullable<SectionCardItem['variant']>, string> = {
  default: '',
  warning: 'border-amber-500/50',
  destructive: 'border-destructive/50',
}

function sectionGridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'sm:grid-cols-2'
  if (count === 3) return 'sm:grid-cols-2 lg:grid-cols-3'
  if (count === 4) return 'sm:grid-cols-2 lg:grid-cols-4'
  if (count === 5) return 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
  return 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'
}

export function SectionCards({ items, className }: { items: SectionCardItem[]; className?: string }) {
  return (
    <div className={cn('grid gap-4', sectionGridClass(items.length), className)}>
      {items.map((item, idx) => {
        const clickable = Boolean(item.onClick)
        const content = (
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              {item.icon ? <span className="text-muted-foreground">{item.icon}</span> : null}
            </div>
            <span className="text-2xl font-semibold tabular-nums">{item.value}</span>
            {item.hint ? <span className="text-xs text-muted-foreground">{item.hint}</span> : null}
          </CardContent>
        )
        return (
          <Card
            key={typeof item.label === 'string' ? item.label : idx}
            className={cn('gap-0', VARIANT_CLASS[item.variant ?? 'default'], clickable && 'cursor-pointer transition-colors hover:bg-muted/40')}
            onClick={item.onClick}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      item.onClick?.()
                    }
                  }
                : undefined
            }
          >
            {content}
          </Card>
        )
      })}
    </div>
  )
}
