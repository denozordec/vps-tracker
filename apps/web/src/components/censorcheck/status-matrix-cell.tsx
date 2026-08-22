import type { LucideIcon } from 'lucide-react'
import {
  BanIcon,
  CheckIcon,
  CircleAlertIcon,
  ClockIcon,
  CornerUpRightIcon,
  MinusIcon,
  XIcon,
} from 'lucide-react'

import { Badge } from '@/components/reui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@cfdm/ui/components/tooltip'
import { CENSORCHECK_STATUS_LABELS, formatCheckedAt } from './types'

/** Compact timesheet-style cell — preview: https://reui.io/preview/base/data-grid-base-4 */
export const MATRIX_STATUS: Record<
  string,
  { icon: LucideIcon; variant: 'success-light' | 'destructive-light' | 'destructive-outline' | 'warning-light' | 'info-light' | 'warning-outline' }
> = {
  available: { icon: CheckIcon, variant: 'success-light' },
  blocked: { icon: XIcon, variant: 'destructive-light' },
  denied: { icon: BanIcon, variant: 'destructive-outline' },
  timeout: { icon: ClockIcon, variant: 'warning-light' },
  redirected: { icon: CornerUpRightIcon, variant: 'info-light' },
  error: { icon: CircleAlertIcon, variant: 'warning-outline' },
}

export function StatusMatrixCell({
  status,
  serviceLabel,
  vpsLabel,
  httpStatus,
  checkedAt,
  onSelect,
}: {
  status?: string | null
  serviceLabel: string
  vpsLabel: string
  httpStatus?: number | null
  checkedAt?: string
  onSelect?: () => void
}) {
  const full = status ? (CENSORCHECK_STATUS_LABELS[status] ?? status) : 'Нет результата'
  const mapped = status ? MATRIX_STATUS[status] : undefined
  const Icon = mapped?.icon ?? MinusIcon
  const variant = mapped?.variant ?? 'outline'
  const tip = [
    serviceLabel,
    vpsLabel,
    full,
    httpStatus != null ? `HTTP ${httpStatus}` : null,
    checkedAt ? formatCheckedAt(checkedAt) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const badge = (
    <Badge variant={variant} size="sm" radius="full" aria-label={full}>
      <Icon className="size-3" />
    </Badge>
  )

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            className="inline-flex"
            onClick={(event) => {
              if (!onSelect) return
              event.stopPropagation()
              onSelect()
            }}
          />
        }
      >
        {badge}
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}
