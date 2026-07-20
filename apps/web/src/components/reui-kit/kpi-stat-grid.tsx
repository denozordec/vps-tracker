import type { KeyboardEvent, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import { Frame, FramePanel } from '@/components/reui/frame'
import { Badge } from '@/components/reui/badge'
import { cn } from '@cfdm/ui/lib/utils'
import { kpiCols } from './kpi-cols'
import { Item, ItemMedia } from '@cfdm/ui/components/item'
import { Skeleton } from '@cfdm/ui/components/skeleton'

export type KpiStatVariant = 'default' | 'warning' | 'destructive'

/**
 * KPI tile data — horizontal compact hybrid (icon left + label/Badge + value).
 * @see https://reui.io/preview/base/stats-12
 */
export type KpiStatItem = {
  id?: string
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  to?: string
  search?: Record<string, unknown>
  onSelect?: () => void
  onClick?: () => void
  selected?: boolean
  active?: boolean
  icon?: ReactNode
  iconClassName?: string
  variant?: KpiStatVariant
  footer?: ReactNode
}

/** CFDM-compatible card shape (id required). */
export type KpiStatCardData = KpiStatItem & { id: string }

/** @deprecated Use KpiStatCardData */
export type OpsKpiCard = KpiStatCardData

/** @deprecated Use KpiStatCardData — type alias for CFDM kit parity */
export type KpiStatCard = KpiStatCardData

const DEFAULT_ICON_CLASS = 'text-muted-foreground [&_svg]:text-current'

const VALUE_VARIANT_CLASS: Record<KpiStatVariant, string> = {
  default: 'text-foreground',
  warning: 'text-warning',
  destructive: 'text-destructive',
}

function handleCardKeyDown(onActivate: () => void, event: KeyboardEvent<HTMLDivElement>) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onActivate()
  }
}

function resolveActivate(item: KpiStatItem): (() => void) | undefined {
  return item.onClick ?? item.onSelect
}

function isSelected(item: KpiStatItem): boolean {
  return Boolean(item.selected ?? item.active)
}

function resolveFooter(item: KpiStatItem): ReactNode {
  if (item.footer) return item.footer
  if (typeof item.hint === 'string') {
    return (
      <Badge variant="outline" size="sm">
        {item.hint}
      </Badge>
    )
  }
  if (item.hint) return item.hint
  return null
}

function KpiStatCardBody({ item }: { item: KpiStatItem }) {
  const footer = resolveFooter(item)
  const valueVariant = item.variant ?? 'default'

  return (
    <div className="relative z-10 flex h-full items-start gap-3">
      {item.icon ? (
        <Item
          className={cn(
            'border-background bg-muted flex size-10.5 shrink-0 items-center justify-center border-2 p-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.14)] dark:border [&_svg]:size-4',
            item.iconClassName ?? DEFAULT_ICON_CLASS,
          )}
        >
          <ItemMedia variant="icon" className="size-auto">
            {item.icon}
          </ItemMedia>
        </Item>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="text-muted-foreground text-sm font-medium">{item.label}</div>
          {footer ? <div className="shrink-0">{footer}</div> : null}
        </div>
        <div
          className={cn(
            'text-2xl leading-none font-bold tabular-nums',
            VALUE_VARIANT_CLASS[valueVariant],
          )}
        >
          {item.value}
        </div>
      </div>
    </div>
  )
}

function panelClassName(item: KpiStatItem, className?: string) {
  const onActivate = resolveActivate(item)
  const clickable = Boolean(item.to || onActivate)
  const selected = isSelected(item)

  return cn(
    'relative isolate flex h-full flex-col',
    clickable &&
      'hover:bg-muted/40 focus-within:ring-ring cursor-pointer transition-colors focus-within:ring-2',
    selected && 'ring-primary/30 bg-muted/30 ring-1',
    className,
  )
}

/** Single KPI tile — used for embedded / standalone contexts. */
export function KpiStatCardTile({
  item,
  embedded = false,
  className,
}: {
  item: KpiStatItem
  embedded?: boolean
  className?: string
}) {
  const onActivate = resolveActivate(item)
  const panelClass = panelClassName(item, className)

  let panel: ReactNode

  if (item.to) {
    panel = (
      <FramePanel className={panelClass}>
        <Link to={item.to} search={item.search} className="focus-visible:outline-none">
          <KpiStatCardBody item={item} />
        </Link>
      </FramePanel>
    )
  } else if (onActivate) {
    panel = (
      <FramePanel
        className={panelClass}
        onClick={onActivate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => handleCardKeyDown(onActivate, e)}
      >
        <KpiStatCardBody item={item} />
      </FramePanel>
    )
  } else {
    panel = (
      <FramePanel className={panelClass}>
        <KpiStatCardBody item={item} />
      </FramePanel>
    )
  }

  if (embedded) {
    return <Frame className="h-full ring-1 ring-foreground/10">{panel}</Frame>
  }

  return <Frame className="h-full">{panel}</Frame>
}

/** @deprecated Prefer KpiStatCardTile — kept for existing imports */
export function KpiStatCard({
  item,
  embedded = false,
  className,
}: {
  item: KpiStatItem
  embedded?: boolean
  className?: string
}) {
  return <KpiStatCardTile item={item} embedded={embedded} className={className} />
}

function KpiStatGridSkeleton({ count }: { count: number }) {
  return (
    <Frame className="@container w-full">
      <div className={cn('grid gap-2', kpiCols(count))}>
        {Array.from({ length: count }).map((_, index) => (
          <FramePanel key={index} className="flex items-start gap-3">
            <Skeleton className="size-10.5 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4.5 w-14 rounded-full" />
              </div>
              <Skeleton className="h-7 w-16" />
            </div>
          </FramePanel>
        ))}
      </div>
    </Frame>
  )
}

interface KpiStatGridProps {
  /** EvoBGP primary API */
  items?: KpiStatItem[]
  /** CFDM-compatible API */
  cards?: KpiStatCardData[]
  isLoading?: boolean
  emptyMessage?: ReactNode
  emptyIcon?: ReactNode
  className?: string
  skeletonCount?: number
  /** Wrap each tile in its own Frame (analytics panels). */
  embedded?: boolean
  'aria-label'?: string
}

function KpiStatCardItem({ item }: { item: KpiStatItem }) {
  const onActivate = resolveActivate(item)
  const panelClass = panelClassName(item)

  if (item.to) {
    return (
      <FramePanel className={panelClass}>
        <Link to={item.to} search={item.search} className="focus-visible:outline-none">
          <KpiStatCardBody item={item} />
        </Link>
      </FramePanel>
    )
  }

  if (onActivate) {
    return (
      <FramePanel
        className={panelClass}
        onClick={onActivate}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => handleCardKeyDown(onActivate, e)}
      >
        <KpiStatCardBody item={item} />
      </FramePanel>
    )
  }

  return (
    <FramePanel className={panelClass}>
      <KpiStatCardBody item={item} />
    </FramePanel>
  )
}

/**
 * Hybrid KPI — EvoBGP visual + horizontal compact layout (icon left).
 * Preview: https://reui.io/preview/base/stats-12
 */
export function KpiStatGrid({
  items,
  cards,
  isLoading = false,
  emptyMessage,
  emptyIcon,
  className,
  skeletonCount = 4,
  embedded = false,
  'aria-label': ariaLabel,
}: KpiStatGridProps) {
  if (isLoading) {
    return <KpiStatGridSkeleton count={skeletonCount} />
  }

  const list = items ?? cards ?? []

  if (list.length === 0 && (emptyMessage || emptyIcon)) {
    return (
      <Frame dense spacing="sm" className={cn('w-full', className)}>
        <FramePanel className="flex items-center gap-3 p-4">
          {emptyIcon}
          {emptyMessage ? (
            <p className="text-muted-foreground text-sm">{emptyMessage}</p>
          ) : null}
        </FramePanel>
      </Frame>
    )
  }

  if (embedded) {
    return (
      <section aria-label={ariaLabel} className={cn('@container w-full', className)}>
        <div className={cn('grid gap-2', kpiCols(list.length || 1))}>
          {list.map((item, index) => (
            <KpiStatCardTile key={kpiStatItemKey(item, index)} item={item} embedded />
          ))}
        </div>
      </section>
    )
  }

  return (
    <Frame className={cn('@container w-full', className)} aria-label={ariaLabel}>
      <div className={cn('grid gap-2', kpiCols(list.length || 1))}>
        {list.map((item, index) => (
          <KpiStatCardItem key={kpiStatItemKey(item, index)} item={item} />
        ))}
      </div>
    </Frame>
  )
}

export function kpiStatItemKey(item: KpiStatItem, index: number): string {
  if (item.id) return item.id
  if (typeof item.label === 'string') return item.label
  return `kpi-${index}`
}
