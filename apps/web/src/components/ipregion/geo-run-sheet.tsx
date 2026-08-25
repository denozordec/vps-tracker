import { Link } from '@tanstack/react-router'
import { Building2Icon, GlobeIcon, MapPinIcon, ServerIcon, ShieldAlertIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@cfdm/ui/components/sheet'
import { DetailPanel } from '@/components/reui-kit/detail-panel'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/reui/badge'
import { ipregionRunQueryOptions } from '@/queries/ipregion'
import { countryName } from './geo-filters'
import {
  IPREGION_STATUS_LABELS,
  formatCheckedAt,
  formatVpsResources,
  runHosterLabel,
  type IpregionRunDto,
} from './types'

interface GeoRunSheetProps {
  run: IpregionRunDto | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GeoRunSheet({ run, open, onOpenChange }: GeoRunSheetProps) {
  const needFetch = Boolean(run && !run.results)
  const { data: fetched } = useQuery({
    ...ipregionRunQueryOptions(needFetch ? run?.id ?? null : null),
  })
  const detail = run?.results ? run : fetched ?? run
  const title = detail?.vps?.dns || detail?.probePublicIp || 'Проверка'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {detail ? formatCheckedAt(detail.createdAt) : 'Загрузка…'}
          </SheetDescription>
        </SheetHeader>
        {detail ? (
          <DetailPanel>
            <DetailPanel.Metrics
              cards={[
                {
                  id: 'ip',
                  icon: <GlobeIcon />,
                  label: 'IP',
                  description: detail.probePublicIp,
                },
                {
                  id: 'vps',
                  icon: <ServerIcon />,
                  label: 'VPS',
                  description: detail.matchedVpsId ? detail.vps?.dns || detail.matchedVpsId : 'Unknown VPS',
                  footer: detail.matchedVpsId ? (
                    <Link
                      to="/vps/$vpsId"
                      params={{ vpsId: detail.matchedVpsId }}
                      className="text-primary text-xs"
                    >
                      Открыть карточку
                    </Link>
                  ) : undefined,
                },
                {
                  id: 'hoster',
                  icon: <Building2Icon />,
                  label: 'Хостер',
                  description: runHosterLabel(detail) || '—',
                },
                {
                  id: 'geo',
                  icon: <MapPinIcon />,
                  label: 'Локация',
                  description: detail.vps?.country || '—',
                },
              ]}
            />
            <DetailPanel.Section title="Сводка">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={detail.status}
                  label={IPREGION_STATUS_LABELS[detail.status] ?? detail.status}
                />
                {detail.vps ? (
                  <span className="text-muted-foreground text-sm">
                    {formatVpsResources(detail.vps.vcpu, detail.vps.ramGb, detail.vps.diskGb)}
                  </span>
                ) : null}
              </div>
            </DetailPanel.Section>
            <DetailPanel.Section title="Сервисы">
              <div className="flex flex-col gap-2">
                {(detail.results ?? []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{item.serviceLabel}</span>
                      <span className="text-muted-foreground text-xs">{item.group}</span>
                    </div>
                    {item.status === 'ok' && item.countryIpv4 ? (
                      <Badge size="sm" variant="success-light" radius="full">
                        {item.countryIpv4}
                        {countryName(item.countryIpv4) ? ` · ${countryName(item.countryIpv4)}` : ''}
                      </Badge>
                    ) : (
                      <StatusBadge
                        status={item.status}
                        label={IPREGION_STATUS_LABELS[item.status] ?? item.status}
                      />
                    )}
                  </div>
                ))}
              </div>
            </DetailPanel.Section>
          </DetailPanel>
        ) : (
          <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
            <ShieldAlertIcon className="size-4" />
            Нет данных прогона
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
