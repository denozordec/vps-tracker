import type { ComponentProps } from 'react'

import { Badge } from '@/components/reui/badge'

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: 'success',
  ok: 'success',
  paid: 'success',
  available: 'success',
  complete: 'success',
  paused: 'secondary',
  archived: 'outline',
  error: 'destructive',
  denied: 'destructive',
  blocked: 'destructive',
  running: 'info',
  overdue: 'warning',
  stale: 'warning',
  timeout: 'warning',
  redirected: 'warning',
  partial: 'warning',
}

export function StatusBadge({
  status,
  label,
  size = 'default',
}: {
  status: string
  label?: string
  size?: NonNullable<ComponentProps<typeof Badge>['size']>
}) {
  const variant = STATUS_VARIANT[status] ?? 'outline'
  return (
    <Badge variant={variant} size={size}>
      {label ?? status}
    </Badge>
  )
}
