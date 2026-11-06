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

import { IconTile } from '@/components/reui/icon-tile'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@cfdm/ui/components/tooltip'
import { CENSORCHECK_STATUS_LABELS, formatCheckedAt } from './types'

/**
 * Статус-тайл ячейки матрицы: ReUI IconTile `soft` перекрашивается одним text-* классом
 * (так велит API IconTile — без ad-hoc bg). Preview: https://reui.io/docs/components/base/icon-tile
 */
export const MATRIX_STATUS: Record<string, { icon: LucideIcon; tone: string }> = {
  available: { icon: CheckIcon, tone: 'text-success' },
  blocked: { icon: XIcon, tone: 'text-destructive' },
  denied: { icon: BanIcon, tone: 'text-destructive' },
  timeout: { icon: ClockIcon, tone: 'text-warning' },
  redirected: { icon: CornerUpRightIcon, tone: 'text-info' },
  error: { icon: CircleAlertIcon, tone: 'text-warning' },
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
  const tone = mapped?.tone ?? 'text-muted-foreground'
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
    <IconTile variant={mapped ? 'soft' : 'outline'} size="xs" radius="full" className={tone} aria-label={full}>
      <Icon />
    </IconTile>
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
