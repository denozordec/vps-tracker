import { Badge } from '@/components/reui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@cfdm/ui/components/tooltip'
import { COUNTRY_BY_CODE } from '@cfdm/shared/geo'
import { IPREGION_STATUS_LABELS, formatCheckedAt } from './types'

const STATUS_VARIANT: Record<
  string,
  'success-light' | 'outline' | 'destructive-outline' | 'warning-light' | 'warning-outline'
> = {
  ok: 'success-light',
  na: 'outline',
  denied: 'destructive-outline',
  rate_limit: 'warning-light',
  server_error: 'warning-outline',
}

function countryLabel(code: string | null | undefined): string {
  if (!code) return ''
  return COUNTRY_BY_CODE[code.toUpperCase()]?.name ?? code
}

/** Compact ISO cell — preview: https://reui.io/docs/components/base/badge · data-grid-base-4 */
export function CountryMatrixCell({
  status,
  countryIpv4,
  countryIpv6,
  serviceLabel,
  vpsLabel,
  checkedAt,
  onSelect,
}: {
  status?: string | null
  countryIpv4?: string | null
  countryIpv6?: string | null
  serviceLabel: string
  vpsLabel: string
  checkedAt?: string
  onSelect?: () => void
}) {
  const iso = countryIpv4 || countryIpv6 || null
  const statusLabel = status ? (IPREGION_STATUS_LABELS[status] ?? status) : 'Нет результата'
  const display = status === 'ok' && iso ? iso : status ? (IPREGION_STATUS_LABELS[status] ?? status) : '—'
  const variant = status ? (STATUS_VARIANT[status] ?? 'outline') : 'outline'
  const tip = [
    serviceLabel,
    vpsLabel,
    iso ? `${iso}${countryLabel(iso) ? ` · ${countryLabel(iso)}` : ''}` : statusLabel,
    countryIpv4 ? `IPv4 ${countryIpv4}` : null,
    countryIpv6 ? `IPv6 ${countryIpv6}` : null,
    checkedAt ? formatCheckedAt(checkedAt) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const badge = (
    <Badge variant={variant} size="sm" radius="full" aria-label={tip}>
      {display}
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
