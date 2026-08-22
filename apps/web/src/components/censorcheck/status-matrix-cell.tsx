import { Badge } from '@/components/reui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@cfdm/ui/components/tooltip'
import { StatusBadge } from '@/components/status-badge'
import { CENSORCHECK_STATUS_LABELS, formatCheckedAt } from './types'

/** Compact timesheet-style cell — preview: https://reui.io/preview/base/data-grid-base-4 */
const MATRIX_SHORT: Record<string, string> = {
  available: 'ОК',
  blocked: 'Блок',
  denied: 'Отказ',
  timeout: 'TO',
  redirected: '3xx',
  error: 'Err',
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
  const short = status ? (MATRIX_SHORT[status] ?? status) : '—'
  const full = status ? (CENSORCHECK_STATUS_LABELS[status] ?? status) : 'Нет результата'
  const tip = [
    serviceLabel,
    vpsLabel,
    full,
    httpStatus != null ? `HTTP ${httpStatus}` : null,
    checkedAt ? formatCheckedAt(checkedAt) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const badge = status ? (
    <StatusBadge status={status} label={short} size="sm" />
  ) : (
    <Badge variant="outline" size="sm" className="text-muted-foreground">
      —
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
