import { InboxIcon, type LucideIcon } from 'lucide-react'
import { IconStack } from '@/components/reui/icon-stack'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@cfdm/ui/components/empty'
import { cn } from '@cfdm/ui/lib/utils'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** Lucide icon component or pre-rendered node (legacy). */
  icon?: LucideIcon | ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
  /** Use IconStack media (empty-state-12). Default true. */
  stackedIcon?: boolean
}

function isLucideIcon(icon: LucideIcon | ReactNode): icon is LucideIcon {
  if (typeof icon === 'function') return true
  // lucide-react icons are forwardRef objects ({ $$typeof, render, displayName })
  if (icon != null && typeof icon === 'object' && '$$typeof' in icon) {
    // React elements have `props` — those are pre-rendered nodes, not components
    if ('props' in icon) return false
    return true
  }
  return false
}

/** Empty state — ReUI empty-state-12. Preview: https://reui.io/preview/base/empty-state-12 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  stackedIcon = true,
}: EmptyStateProps) {
  const Icon = isLucideIcon(icon) ? icon : InboxIcon
  const customIcon = icon && !isLucideIcon(icon) ? icon : null

  return (
    <Empty className={cn('max-w-md flex-none border-0 bg-transparent p-0', className)}>
      <EmptyHeader className="gap-5 text-center">
        <EmptyMedia className="mb-0">
          {customIcon ? (
            <div className="text-muted-foreground">{customIcon}</div>
          ) : stackedIcon ? (
            <IconStack aria-hidden="true" className="h-14 w-12">
              <Icon strokeWidth={1.9} aria-hidden="true" className="size-5" />
            </IconStack>
          ) : (
            <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg [&_svg]:size-5">
              <Icon aria-hidden="true" />
            </span>
          )}
        </EmptyMedia>
        <div className="flex flex-col items-center gap-2">
          <EmptyTitle className="text-base font-semibold tracking-tight">
            {title}
          </EmptyTitle>
          {description ? (
            <EmptyDescription className="max-w-sm text-sm/relaxed">
              {description}
            </EmptyDescription>
          ) : null}
        </div>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
