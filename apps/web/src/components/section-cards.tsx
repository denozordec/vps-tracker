import type { ReactElement, ReactNode } from 'react'
import { Card, CardContent } from '@cfdm/ui/components/card'
import { cn } from '@cfdm/ui/lib/utils'
import { TruncatedText } from '@/components/truncated-text'

export interface SectionCardItem {
  label: ReactNode
  value: string | number | ReactElement
  hint?: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  variant?: 'default' | 'warning' | 'destructive'
  active?: boolean
  onClick?: () => void
}

const VARIANT_CLASS: Record<NonNullable<SectionCardItem['variant']>, string> = {
  default: '',
  warning: 'border-warning/50',
  destructive: 'border-destructive/50',
}

function sectionGridClass(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'sm:grid-cols-2'
  if (count === 3) return 'sm:grid-cols-2 lg:grid-cols-3'
  if (count === 4) return 'sm:grid-cols-2 lg:grid-cols-4'
  if (count === 5) return 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
  return 'sm:grid-cols-2 lg:grid-cols-3'
}

export function SectionCards({ items, className }: { items: SectionCardItem[]; className?: string }) {
  return (
    <div className={cn('grid gap-3', sectionGridClass(items.length), className)}>
      {items.map((item, idx) => {
        const clickable = Boolean(item.onClick)
        const content = (
          <CardContent className="flex items-start gap-2.5 px-3 py-2.5">
            {item.icon ? (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                {item.icon}
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                {typeof item.label === 'string' ? (
                  <TruncatedText className="text-xs text-muted-foreground">{item.label}</TruncatedText>
                ) : (
                  <span className="truncate text-xs text-muted-foreground">{item.label}</span>
                )}
                {item.badge ? <span className="shrink-0">{item.badge}</span> : null}
              </div>
              <div className="flex min-w-0 items-baseline gap-1.5">
                <span className="text-lg font-semibold tabular-nums">{item.value}</span>
                {item.hint ? (
                  typeof item.hint === 'string' ? (
                    <TruncatedText className="text-xs text-muted-foreground">· {item.hint}</TruncatedText>
                  ) : (
                    <span className="truncate text-xs text-muted-foreground">· {item.hint}</span>
                  )
                ) : null}
              </div>
            </div>
          </CardContent>
        )
        return (
          <Card
            key={typeof item.label === 'string' ? item.label : idx}
            className={cn(
              'gap-0',
              VARIANT_CLASS[item.variant ?? 'default'],
              item.active && 'border-primary ring-1 ring-primary/30',
              clickable && 'cursor-pointer transition-colors hover:bg-muted/40',
            )}
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
