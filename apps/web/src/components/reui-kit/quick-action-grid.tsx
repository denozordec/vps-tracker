import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'
import { Badge } from '@/components/reui/badge'
import { Item, ItemMedia } from '@cfdm/ui/components/item'
import { cn } from '@cfdm/ui/lib/utils'
import { kpiCols } from './kpi-cols'

export interface QuickActionItem {
  id: string
  title: string
  description: string
  to: string
  search?: Record<string, unknown>
  icon?: ReactNode
  iconClassName?: string
}

interface QuickActionGridProps {
  actions: QuickActionItem[]
  title?: string
  description?: string
  className?: string
}

const DEFAULT_ICON_CLASS = 'text-muted-foreground [&_svg]:text-current'

function QuickActionBody({ action }: { action: QuickActionItem }) {
  return (
    <div className="relative z-10 flex h-full items-start gap-3">
      {action.icon ? (
        <Item
          className={cn(
            'border-background bg-muted flex size-10.5 shrink-0 items-center justify-center border-2 p-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.14)] dark:border [&_svg]:size-4',
            action.iconClassName ?? DEFAULT_ICON_CLASS,
          )}
        >
          <ItemMedia variant="icon" className="size-auto">
            {action.icon}
          </ItemMedia>
        </Item>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-foreground text-sm font-medium">{action.title}</span>
          <Badge variant="outline" size="sm" className="shrink-0">
            Перейти
          </Badge>
        </div>
        <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
          {action.description}
        </p>
      </div>
    </div>
  )
}

/**
 * KPI-like quick actions strip (horizontal Frame tiles).
 * Preview: https://reui.io/preview/base/stats-12
 */
export function QuickActionGrid({
  actions,
  title = 'Быстрые действия',
  description,
  className,
}: QuickActionGridProps) {
  if (actions.length === 0) return null

  return (
    <Frame dense spacing="sm" className={cn('@container w-full', className)}>
      {(title || description) && (
        <FrameHeader>
          {title ? <FrameTitle>{title}</FrameTitle> : null}
          {description ? <FrameDescription>{description}</FrameDescription> : null}
        </FrameHeader>
      )}
      <div className={cn('grid gap-2', kpiCols(actions.length))}>
        {actions.map((action) => (
          <FramePanel
            key={action.id}
            className="relative isolate flex h-full flex-col hover:bg-muted/40 focus-within:ring-ring cursor-pointer transition-colors focus-within:ring-2"
          >
            <Link
              to={action.to}
              search={action.search}
              className="focus-visible:outline-none"
              aria-label={`${action.title}: ${action.description}`}
            >
              <QuickActionBody action={action} />
            </Link>
          </FramePanel>
        ))}
      </div>
    </Frame>
  )
}
