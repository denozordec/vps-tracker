import { Badge } from '@cfdm/ui/components/badge'
import type { ComponentProps } from 'react'

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  active: 'default',
  ok: 'default',
  paid: 'default',
  paused: 'secondary',
  archived: 'outline',
  error: 'destructive',
  running: 'secondary',
  overdue: 'destructive',
  stale: 'destructive',
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const variant = STATUS_VARIANT[status] ?? 'outline'
  return <Badge variant={variant}>{label ?? status}</Badge>
}
