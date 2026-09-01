import { memo, useMemo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { ServerIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@cfdm/ui/lib/utils'
import { Badge } from '@/components/reui/badge'
import { CountryFlag } from '@/components/country-flag'
import { StatusBadge } from '@/components/status-badge'
import { snapshotQueryOptions } from '@/queries/snapshot'
import { resolveCountryCode, vpsStatusLabel } from '@/lib/format'
import type { Vps } from '@/types/entities'
import { aggregateCfdmServices, servicesForVps } from '../cfdm-services'
import { type VpsNodeData, vpsSpecsLine } from '../types'
import { NodeSideHandles } from './node-side-handles'

function formatRate(vps: Vps): string | null {
  if (vps.tariffType === 'monthly' && vps.monthlyRate != null) {
    return `${vps.monthlyRate} ${vps.currency}/мес`
  }
  if (vps.dailyRate != null) {
    return `${vps.dailyRate} ${vps.currency}/сут`
  }
  if (vps.monthlyRate != null) {
    return `${vps.monthlyRate} ${vps.currency}/мес`
  }
  return null
}

function VpsNodeComponent({ data, selected }: NodeProps & { data: VpsNodeData }) {
  const { data: snapshot } = useQuery(snapshotQueryOptions())
  const vps = snapshot?.vps?.find((v) => v.id === data.vpsId) as Vps | undefined
  const orphan = !vps
  const name = vps?.dns || vps?.ip || data.label || 'VPS'
  const rate = vps ? formatRate(vps) : null
  const countryCode = resolveCountryCode(vps?.country)
  const hasFlag = Boolean(countryCode)
  const serviceChips = useMemo(
    () => servicesForVps(aggregateCfdmServices(snapshot?.vpsDomains ?? []), data.vpsId),
    [snapshot?.vpsDomains, data.vpsId],
  )

  return (
    <div
      className={cn(
        'relative min-w-[220px] rounded-lg border bg-background px-3 py-2 shadow-sm',
        hasFlag && 'pt-3',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
        orphan && 'border-warning/60',
      )}
    >
      {hasFlag ? (
        <div className="absolute -top-1.5 left-2 z-10" title={vps?.country || undefined}>
          <CountryFlag
            code={countryCode}
            country={vps?.country}
            className="size-5 rounded-[3px] shadow-sm ring-1 ring-border"
          />
        </div>
      ) : null}
      <NodeSideHandles />
      {vps?.ip ? (
        <div className="mb-1 font-mono text-[10px] text-muted-foreground">{vps.ip}</div>
      ) : null}
      <div className="flex items-start gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <ServerIcon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{name}</span>
            {vps ? (
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  vps.status === 'active' ? 'bg-success' : 'bg-muted-foreground',
                )}
                title={vpsStatusLabel(vps.status)}
              />
            ) : (
              <StatusBadge status="stale" label="Удалён" />
            )}
          </div>
          {vps ? (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {vpsSpecsLine(vps)}
            </div>
          ) : (
            <div className="mt-0.5 text-[11px] text-warning">VPS не найден в каталоге</div>
          )}
          {rate ? (
            <div className="mt-0.5 text-[11px] text-muted-foreground">{rate}</div>
          ) : null}
          {vps?.country || vps?.datacenter ? (
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {[vps.country, vps.city, vps.datacenter].filter(Boolean).join(' · ')}
            </div>
          ) : null}
          {serviceChips.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {serviceChips.map((s) => (
                <Badge key={s.serviceId} variant="secondary" size="xs">
                  {s.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export const VpsNode = memo(VpsNodeComponent)
