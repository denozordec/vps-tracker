import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@cfdm/ui/components/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@cfdm/ui/components/sheet'
import { DetailPanel } from '@/components/reui-kit/detail-panel'
import { StatusBadge } from '@/components/status-badge'
import { snapshotQueryOptions } from '@/queries/snapshot'
import { vpsStatusLabel, tariffTypeLabel } from '@/lib/format'
import { vpsSpecsLine } from './types'
import type { Vps } from '@/types/entities'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  )
}

interface VpsDetailSheetProps {
  vpsId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VpsDetailSheet({ vpsId, open, onOpenChange }: VpsDetailSheetProps) {
  const { data: snapshot } = useQuery(snapshotQueryOptions())
  const vps = (snapshot?.vps ?? []).find((v) => v.id === vpsId) as Vps | undefined
  const provider = snapshot?.providers?.find((p) => p.id === vps?.providerId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{vps?.dns || vps?.ip || 'VPS'}</SheetTitle>
          <SheetDescription>
            {vps ? vpsSpecsLine(vps) : 'Сервер не найден в каталоге'}
          </SheetDescription>
        </SheetHeader>
        {vps ? (
          <div className="flex flex-col gap-4 overflow-y-auto p-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={vps.status} label={vpsStatusLabel(vps.status)} />
              <span className="text-xs text-muted-foreground">
                {tariffTypeLabel(vps.tariffType)}
              </span>
            </div>
            <DetailPanel>
              <DetailPanel.Section title="Сеть">
                <div className="rounded-lg border border-border px-3">
                  <Row label="IPv4" value={vps.ip || '—'} />
                  <Row label="IPv6" value={vps.ipv6 || '—'} />
                  <Row label="DNS" value={vps.dns || '—'} />
                </div>
              </DetailPanel.Section>
              <DetailPanel.Section title="Конфигурация">
                <div className="rounded-lg border border-border px-3">
                  <Row label="CPU" value={String(vps.vcpu)} />
                  <Row label="RAM" value={`${vps.ramGb} ГБ`} />
                  <Row
                    label="Диск"
                    value={`${vps.diskGb} ГБ${vps.diskType ? ` (${vps.diskType})` : ''}`}
                  />
                  <Row label="ОС" value={vps.os || '—'} />
                </div>
              </DetailPanel.Section>
              <DetailPanel.Section title="Размещение">
                <div className="rounded-lg border border-border px-3">
                  <Row label="Провайдер" value={provider?.name || '—'} />
                  <Row
                    label="Локация"
                    value={
                      [vps.country, vps.city, vps.datacenter].filter(Boolean).join(', ') || '—'
                    }
                  />
                  <Row label="Проект" value={vps.project || '—'} />
                </div>
              </DetailPanel.Section>
            </DetailPanel>
            <Button render={<Link to="/vps/$vpsId" params={{ vpsId: vps.id }} />}>
              Открыть карточку VPS
            </Button>
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            VPS удалён или недоступен в текущем пространстве.
          </p>
        )}
      </SheetContent>
    </Sheet>
  )
}
