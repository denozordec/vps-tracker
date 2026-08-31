import type { ComponentProps } from 'react'

import { cn } from '@cfdm/ui/lib/utils'

import { Badge } from '@/components/reui/badge'

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: 'success-light',
  ok: 'success-light',
  up: 'success-light',
  paid: 'success-light',
  available: 'success-light',
  complete: 'success-light',
  paused: 'invert-light',
  archived: 'outline',
  error: 'destructive-light',
  denied: 'destructive-light',
  blocked: 'destructive-light',
  down: 'destructive-light',
  running: 'info-light',
  overdue: 'warning-light',
  stale: 'warning-light',
  timeout: 'warning-light',
  redirected: 'warning-light',
  partial: 'warning-light',
}

const DOT_COLOR: Record<string, string> = {
  'success-light': 'bg-success',
  success: 'bg-success',
  'info-light': 'bg-info',
  info: 'bg-info',
  'warning-light': 'bg-warning',
  warning: 'bg-warning',
  'destructive-light': 'bg-destructive',
  destructive: 'bg-destructive',
  'invert-light': 'bg-muted-foreground',
  secondary: 'bg-muted-foreground',
  outline: 'bg-muted-foreground',
}

export function StatusBadge({
  status,
  label,
  size = 'sm',
  className,
}: {
  status: string
  label?: string
  size?: NonNullable<ComponentProps<typeof Badge>['size']>
  className?: string
}) {
  const variant = STATUS_VARIANT[status] ?? 'outline'
  const dotColor = DOT_COLOR[variant] ?? 'bg-muted-foreground'
  return (
    <Badge variant={variant} size={size} radius="full" className={cn('gap-1.5', className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', dotColor)} aria-hidden />
      {label ?? status}
    </Badge>
  )
}
