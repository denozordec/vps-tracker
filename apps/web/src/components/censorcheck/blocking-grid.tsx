import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { GlobeIcon, MapPinIcon, ServerIcon, ShieldAlertIcon } from 'lucide-react'

import type { DataGridColumn } from '@/components/data-grid-types'
import { dataGridCellStack, dataGridCellWithFlag } from '@/components/data-grid-cells'
import { CountryFlag } from '@/components/country-flag'
import { StatusBadge } from '@/components/status-badge'
import { columnDefFromDataGrid, ExpandableResourceGrid } from '@/components/reui-kit'
import { Badge } from '@/components/reui/badge'
import {
  CENSORCHECK_STATUS_LABELS,
  formatCheckedAt,
  formatVpsResources,
  type CensorcheckRunDto,
} from './types'
import type { BlockingServiceRow } from './blocking-filters'

function SummaryBadges({ run }: { run: CensorcheckRunDto }) {
  const { summary } = run
  return (
    <div className="flex flex-wrap items-center gap-1">
      {summary.available > 0 ? (
        <Badge variant="success" size="sm">{summary.available} ок</Badge>
      ) : null}
      {summary.blocked > 0 ? (
        <Badge variant="destructive" size="sm">{summary.blocked} блок</Badge>
      ) : null}
      {summary.denied > 0 ? (
        <Badge variant="destructive" size="sm">{summary.denied} отказ</Badge>
      ) : null}
      {summary.timeout > 0 ? (
        <Badge variant="warning" size="sm">{summary.timeout} timeout</Badge>
      ) : null}
      {summary.error > 0 ? (
        <Badge variant="outline" size="sm">{summary.error} err</Badge>
      ) : null}
    </div>
  )
}

function NestedList({
  rows,
}: {
  rows: Array<{ key: string; primary: string; secondary?: string; status: string }>
}) {
  return (
    <div className="bg-muted/30 flex flex-col gap-1 px-4 py-3">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-3 text-sm">
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{row.primary}</span>
            {row.secondary ? (
              <span className="text-muted-foreground truncate text-xs">{row.secondary}</span>
            ) : null}
          </div>
          <StatusBadge
            status={row.status}
            label={CENSORCHECK_STATUS_LABELS[row.status] ?? row.status}
          />
        </div>
      ))}
    </div>
  )
}

const vpsColumns: DataGridColumn<CensorcheckRunDto>[] = [
  {
    key: 'vps',
    header: 'VPS / IP',
    icon: ServerIcon,
    sortValue: (row) => row.vps?.dns || row.probePublicIp,
    cell: (row) => {
      const title = row.vps?.dns || row.probePublicIp
      const ip = row.probePublicIp
      const link = row.matchedVpsId ? (
        <Link
          to="/vps/$vpsId"
          params={{ vpsId: row.matchedVpsId }}
          className="hover:text-primary font-medium"
          onClick={(event) => event.stopPropagation()}
        >
          {title}
        </Link>
      ) : (
        <span className="font-medium">Unknown VPS</span>
      )
      return dataGridCellStack(link, ip)
    },
  },
  {
    key: 'dns',
    header: 'DNS',
    icon: GlobeIcon,
    sortValue: (row) => row.vps?.dns ?? '',
    cell: (row) => row.vps?.dns || '—',
  },
  {
    key: 'hoster',
    header: 'Хостер',
    sortValue: (row) => row.vps?.providerName ?? '',
    cell: (row) => row.vps?.providerName || '—',
  },
  {
    key: 'country',
    header: 'Страна',
    icon: MapPinIcon,
    sortValue: (row) => row.vps?.country ?? '',
    cell: (row) =>
      row.vps?.country
        ? dataGridCellWithFlag(<CountryFlag country={row.vps.country} />, row.vps.country)
        : '—',
  },
  {
    key: 'resources',
    header: 'Ресурсы',
    sortValue: (row) => row.vps?.vcpu ?? 0,
    cell: (row) =>
      row.vps
        ? formatVpsResources(row.vps.vcpu, row.vps.ramGb, row.vps.diskGb)
        : '—',
  },
  {
    key: 'summary',
    header: 'Сводка',
    cell: (row) => <SummaryBadges run={row} />,
  },
  {
    key: 'checked',
    header: 'Проверено',
    sortValue: (row) => row.createdAt,
    cell: (row) => formatCheckedAt(row.createdAt),
  },
]

const serviceColumns: DataGridColumn<BlockingServiceRow>[] = [
  {
    key: 'service',
    header: 'Сервис',
    icon: ShieldAlertIcon,
    sortValue: (row) => row.serviceKey,
    cell: (row) => dataGridCellStack(row.serviceLabel, row.category),
  },
  {
    key: 'probes',
    header: 'Пробы',
    sortValue: (row) => row.probes.length,
    sortingFn: 'basic',
    cell: (row) => row.probes.length,
  },
]

export function BlockingVpsGrid({
  runs,
  onRowClick,
  emptyAction,
}: {
  runs: CensorcheckRunDto[]
  onRowClick: (run: CensorcheckRunDto) => void
  emptyAction?: ReactNode
}) {
  return (
    <ExpandableResourceGrid
      columns={columnDefFromDataGrid(vpsColumns)}
      data={runs}
      rowId={(row) => row.id}
      dense
      pagination={runs.length > 10}
      emptyTitle="Нет проверок"
      emptyDescription="Запустите launcher на VPS, чтобы увидеть статусы блокировок."
      emptyAction={emptyAction}
      onRowClick={onRowClick}
      getRowCanExpand={(row) => (row.results?.length ?? 0) > 0}
      expandedContent={(row) => (
        <NestedList
          rows={(row.results ?? []).map((item) => ({
            key: item.id,
            primary: item.serviceLabel,
            secondary: item.category,
            status: item.status,
          }))}
        />
      )}
    />
  )
}

export function BlockingServiceGrid({
  groups,
  emptyAction,
}: {
  groups: BlockingServiceRow[]
  emptyAction?: ReactNode
}) {
  return (
    <ExpandableResourceGrid
      columns={columnDefFromDataGrid(serviceColumns)}
      data={groups}
      rowId={(row) => row.id}
      dense
      pagination={groups.length > 10}
      emptyTitle="Нет сервисов"
      emptyAction={emptyAction}
      getRowCanExpand={(row) => row.probes.length > 0}
      expandedContent={(row) => (
        <NestedList
          rows={row.probes.map((probe) => ({
            key: `${probe.runId}-${probe.probePublicIp}`,
            primary: probe.dns || probe.probePublicIp,
            secondary: `${probe.probePublicIp} · ${formatCheckedAt(probe.createdAt)}`,
            status: probe.status,
          }))}
        />
      )}
    />
  )
}
