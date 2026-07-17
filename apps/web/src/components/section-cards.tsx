import type { ReactElement, ReactNode } from 'react'
import { KpiStatGrid, type KpiStatCard, type KpiStatVariant } from '@/components/reui-kit/kpi-stat-grid'
import { Badge } from '@/components/reui/badge'

export interface SectionCardItem {
  label: ReactNode
  value: string | number | ReactElement
  hint?: ReactNode
  icon?: ReactNode
  iconClassName?: string
  badge?: ReactNode
  variant?: KpiStatVariant
  active?: boolean
  onClick?: () => void
}

const VARIANT_ICON_CLASS: Record<KpiStatVariant, string> = {
  default: 'text-muted-foreground',
  warning: 'text-warning',
  destructive: 'text-destructive',
}

/**
 * @deprecated Prefer `KpiStatGrid` directly.
 * Thin adapter → hybrid stats-12 Frame KPI. Preview: https://reui.io/preview/base/stats-12
 */
export function SectionCards({ items, className }: { items: SectionCardItem[]; className?: string }) {
  const cards: KpiStatCard[] = items.map((item, idx) => {
    const label = typeof item.label === 'string' ? item.label : `kpi-${idx}`
    const variant = item.variant ?? 'default'

    let footer: ReactNode = item.badge
    if (!footer && typeof item.hint === 'string') {
      footer = (
        <Badge variant="outline" size="sm">
          {item.hint}
        </Badge>
      )
    } else if (!footer && item.hint) {
      footer = item.hint
    } else if (!footer && variant !== 'default') {
      footer = (
        <Badge
          variant={variant === 'warning' ? 'warning-light' : 'destructive-light'}
          size="sm"
        >
          {variant === 'warning' ? 'Внимание' : 'Критично'}
        </Badge>
      )
    }

    return {
      id: label,
      label,
      value: item.value as string | number,
      icon: item.icon,
      iconClassName: item.iconClassName ?? VARIANT_ICON_CLASS[variant],
      variant,
      selected: item.active,
      onSelect: item.onClick,
      footer,
    }
  })

  return <KpiStatGrid cards={cards} className={className} />
}
