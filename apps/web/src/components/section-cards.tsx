import type { ReactElement, ReactNode } from 'react'
import { cn } from '@cfdm/ui/lib/utils'
import { KpiStatGrid, type KpiStatCard } from '@/components/reui-kit/kpi-stat-grid'
import { Badge } from '@cfdm/ui/components/badge'

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

/**
 * @deprecated Prefer `KpiStatGrid` directly.
 * Thin adapter → stats-12 Frame KPI. Preview: https://reui.io/preview/base/stats-12
 */
export function SectionCards({ items, className }: { items: SectionCardItem[]; className?: string }) {
  const cards: KpiStatCard[] = items.map((item, idx) => {
    const label = typeof item.label === 'string' ? item.label : `kpi-${idx}`
    const footer =
      item.badge || item.hint ? (
        <div className="flex flex-wrap items-center gap-2">
          {item.badge}
          {item.hint && !item.badge ? (
            <span className="text-muted-foreground text-xs">{item.hint}</span>
          ) : null}
        </div>
      ) : undefined

    return {
      id: label,
      label,
      value: item.value as string | number,
      hint: typeof item.hint === 'string' ? item.hint : undefined,
      icon: item.icon,
      selected: item.active,
      onSelect: item.onClick,
      footer:
        item.variant && item.variant !== 'default' && !item.badge ? (
          <Badge
            variant="outline"
            className={cn(
              item.variant === 'warning' && 'border-warning/50 text-warning-foreground',
              item.variant === 'destructive' && 'border-destructive/50 text-destructive',
            )}
          >
            {item.variant === 'warning' ? 'Внимание' : 'Критично'}
          </Badge>
        ) : (
          footer
        ),
    }
  })

  return <KpiStatGrid cards={cards} className={className} />
}
