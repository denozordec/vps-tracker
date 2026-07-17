import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Frame, FramePanel } from '@/components/reui/frame'
import { Badge } from '@/components/reui/badge'
import { Item, ItemMedia } from '@cfdm/ui/components/item'
import { cn } from '@cfdm/ui/lib/utils'
import { Skeleton } from '@cfdm/ui/components/skeleton'

export type KpiStatVariant = 'default' | 'warning' | 'destructive'

export interface KpiStatCard {
  id: string
  label: string
  value: string | number
  hint?: string
  to?: string
  search?: Record<string, unknown>
  onSelect?: () => void
  selected?: boolean
  icon?: ReactNode
  iconClassName?: string
  /** Semantic color for the primary value */
  variant?: KpiStatVariant
  footer?: ReactNode
}

/** @deprecated Use KpiStatCard */
export type OpsKpiCard = KpiStatCard

interface KpiStatGridProps {
  cards: KpiStatCard[]
  isLoading?: boolean
  emptyMessage?: ReactNode
  emptyIcon?: ReactNode
  className?: string
  skeletonCount?: number
}

const DEFAULT_ICON_CLASS = 'text-muted-foreground [&_svg]:text-current'

const VALUE_VARIANT_CLASS: Record<KpiStatVariant, string> = {
  default: 'text-foreground',
  warning: 'text-warning',
  destructive: 'text-destructive',
}

function kpiCols(count: number): string {
  if (count <= 1) return 'grid-cols-1'
  if (count === 2) return 'grid-cols-1 @xl:grid-cols-2'
  if (count === 3) return 'grid-cols-1 @3xl:grid-cols-3'
  if (count === 4) return 'grid-cols-1 @3xl:grid-cols-2 @6xl:grid-cols-4'
  if (count === 5) return 'grid-cols-2 @3xl:grid-cols-3 xl:grid-cols-5'
  if (count === 6) return 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6'
  return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
}

function resolveFooter(card: KpiStatCard): ReactNode {
  if (card.footer) return card.footer
  if (card.hint) {
    return (
      <Badge variant="outline" size="sm">
        {card.hint}
      </Badge>
    )
  }
  return null
}

function KpiStatCardBody({ card }: { card: KpiStatCard }) {
  const footer = resolveFooter(card)
  const valueVariant = card.variant ?? 'default'

  return (
    <div className="relative z-10 flex h-full flex-col items-start gap-3">
      {card.icon ? (
        <Item
          className={cn(
            'border-background bg-muted flex size-10.5 items-center justify-center border-2 p-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.14)] dark:border [&_svg]:size-4',
            card.iconClassName ?? DEFAULT_ICON_CLASS,
          )}
        >
          <ItemMedia variant="icon" className="size-auto">
            {card.icon}
          </ItemMedia>
        </Item>
      ) : null}

      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            'text-2xl leading-none font-bold tabular-nums',
            VALUE_VARIANT_CLASS[valueVariant],
          )}
        >
          {card.value}
        </span>
        <span className="text-muted-foreground text-sm font-medium">{card.label}</span>
      </div>

      {footer ? <div className="mt-auto w-full">{footer}</div> : null}
    </div>
  )
}

function KpiStatCardItem({ card }: { card: KpiStatCard }) {
  const interactive = Boolean(card.to || card.onSelect)
  const panelClass = cn(
    'relative isolate flex h-full flex-col',
    card.selected && 'ring-primary/30 bg-muted/30 ring-1',
    interactive &&
      'hover:bg-muted/40 focus-within:ring-ring cursor-pointer transition-colors focus-within:ring-2',
  )

  if (card.to) {
    return (
      <FramePanel className={panelClass}>
        <Link to={card.to} search={card.search} className="focus-visible:outline-none">
          <KpiStatCardBody card={card} />
        </Link>
      </FramePanel>
    )
  }

  if (card.onSelect) {
    return (
      <FramePanel className={panelClass}>
        <button
          type="button"
          onClick={card.onSelect}
          className="w-full text-start focus-visible:outline-none"
        >
          <KpiStatCardBody card={card} />
        </button>
      </FramePanel>
    )
  }

  return (
    <FramePanel className={panelClass}>
      <KpiStatCardBody card={card} />
    </FramePanel>
  )
}

function KpiStatGridSkeleton({ count }: { count: number }) {
  return (
    <Frame className="@container w-full">
      <div className={cn('grid gap-2', kpiCols(count))}>
        {Array.from({ length: count }).map((_, index) => (
          <FramePanel key={index} className="flex flex-col gap-3">
            <Skeleton className="size-10.5 rounded-lg" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-auto h-4.5 w-16 rounded-full" />
          </FramePanel>
        ))}
      </div>
    </Frame>
  )
}

/**
 * Hybrid KPI grid — compact stats-12 Frame strip.
 * Preview: https://reui.io/preview/base/stats-12
 */
export function KpiStatGrid({
  cards,
  isLoading = false,
  emptyMessage,
  emptyIcon,
  className,
  skeletonCount = 4,
}: KpiStatGridProps) {
  if (isLoading) {
    return <KpiStatGridSkeleton count={skeletonCount} />
  }

  if (cards.length === 0) {
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

  return (
    <Frame className={cn('@container w-full', className)}>
      <div className={cn('grid gap-2', kpiCols(cards.length))}>
        {cards.map((card) => (
          <KpiStatCardItem key={card.id} card={card} />
        ))}
      </div>
    </Frame>
  )
}
