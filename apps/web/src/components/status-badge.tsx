import type { ComponentProps } from 'react'

import { Badge } from '@/components/reui/badge'

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: 'success',
  ok: 'success',
  paid: 'success',
  paused: 'secondary',
  archived: 'outline',
  error: 'destructive',
  running: 'info',
  overdue: 'warning',
  stale: 'warning',
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const variant = STATUS_VARIANT[status] ?? 'outline'
  return <Badge variant={variant}>{label ?? status}</Badge>
}
