import type { ReactElement, ReactNode } from 'react'
import { Card, CardContent } from '@cfdm/ui/components/card'
import { cn } from '@cfdm/ui/lib/utils'

export interface SectionCardItem {
  label: ReactNode
  value: string | number | ReactElement
  hint?: ReactNode
  icon?: ReactNode
}

export function SectionCards({ items, className }: { items: SectionCardItem[]; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {items.map((item, idx) => (
        <Card key={typeof item.label === 'string' ? item.label : idx} className="gap-0">
          <CardContent className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              {item.icon ? <span className="text-muted-foreground">{item.icon}</span> : null}
            </div>
            <span className="text-2xl font-semibold tabular-nums">{item.value}</span>
            {item.hint ? <span className="text-xs text-muted-foreground">{item.hint}</span> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
