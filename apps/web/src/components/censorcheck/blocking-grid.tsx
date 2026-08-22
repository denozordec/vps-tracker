import { useMemo, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ServerIcon, ShieldAlertIcon } from 'lucide-react'

import type { DataGridColumn } from '@/components/data-grid-types'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { columnDefFromDataGrid, FrameDataGrid } from '@/components/reui-kit'
import {
  collectProbeColumns,
  collectServiceColumns,
  resultByService,
  type BlockingServiceRow,
} from './blocking-filters'
import { StatusMatrixCell } from './status-matrix-cell'
import type { CensorcheckRunDto } from './types'

const MATRIX_CELL = 'w-16 min-w-16 px-1 text-center'

function vpsIdentityColumn(): DataGridColumn<CensorcheckRunDto> {
  return {
    key: 'vps',
    header: 'VPS / IP',
    headerTitle: 'VPS / IP',
    icon: ServerIcon,
    enableHiding: false,
    enablePinning: true,
    size: 220,
    minSize: 180,
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
  }
}

export function BlockingVpsGrid({
  runs,
  onRowClick,
  emptyAction,
}: {
  runs: CensorcheckRunDto[]
  onRowClick: (run: CensorcheckRunDto) => void
  emptyAction?: ReactNode
}) {
  const serviceCols = useMemo(() => collectServiceColumns(runs), [runs])
  const columns = useMemo((): DataGridColumn<CensorcheckRunDto>[] => {
    return [
      vpsIdentityColumn(),
      ...serviceCols.map(
        (svc): DataGridColumn<CensorcheckRunDto> => ({
          key: `svc:${svc.key}`,
          header: (
            <span className="block max-w-16 truncate" title={svc.title}>
              {svc.label}
            </span>
          ),
          headerTitle: svc.title,
          className: MATRIX_CELL,
          headerClassName: MATRIX_CELL,
          size: 72,
          minSize: 64,
          sortable: true,
          sortValue: (row) => resultByService(row, svc.key)?.status ?? '',
          cell: (row) => {
            const item = resultByService(row, svc.key)
            return (
              <StatusMatrixCell
                status={item?.status}
                serviceLabel={svc.title}
                vpsLabel={row.vps?.dns || row.probePublicIp}
                httpStatus={item?.httpStatus}
                checkedAt={row.createdAt}
              />
            )
          },
        }),
      ),
    ]
  }, [serviceCols])

  return (
    <FrameDataGrid
      columns={columnDefFromDataGrid(columns)}
      data={runs}
      rowId={(row) => row.id}
      dense
      pagination={runs.length > 10}
      pinLeftColumnIds={['vps']}
      horizontalScroll
      emptyTitle="Нет проверок"
      emptyDescription="Запустите launcher на VPS, чтобы увидеть статусы блокировок."
      emptyAction={emptyAction}
      onRowClick={onRowClick}
    />
  )
}

export function BlockingServiceGrid({
  groups,
  runs,
  onProbeClick,
  emptyAction,
}: {
  groups: BlockingServiceRow[]
  runs: CensorcheckRunDto[]
  onProbeClick: (run: CensorcheckRunDto) => void
  emptyAction?: ReactNode
}) {
  const probeCols = useMemo(() => collectProbeColumns(runs), [runs])
  const runById = useMemo(() => new Map(runs.map((row) => [row.id, row])), [runs])

  const columns = useMemo((): DataGridColumn<BlockingServiceRow>[] => {
    return [
      {
        key: 'service',
        header: 'Сервис',
        headerTitle: 'Сервис',
        icon: ShieldAlertIcon,
        enableHiding: false,
        enablePinning: true,
        size: 180,
        minSize: 140,
        sortValue: (row) => row.serviceKey,
        cell: (row) => dataGridCellStack(row.serviceLabel, row.category),
      },
      ...probeCols.map(
        (probe): DataGridColumn<BlockingServiceRow> => ({
          key: `probe:${probe.key}`,
          header: (
            <span className="block max-w-16 truncate" title={probe.title}>
              {probe.label}
            </span>
          ),
          headerTitle: probe.title,
          className: MATRIX_CELL,
          headerClassName: MATRIX_CELL,
          size: 72,
          minSize: 64,
          sortable: true,
          sortValue: (row) =>
            row.probes.find((item) => item.runId === probe.key)?.status ?? '',
          cell: (row) => {
            const item = row.probes.find((probeRow) => probeRow.runId === probe.key)
            const run = runById.get(probe.key)
            return (
              <StatusMatrixCell
                status={item?.status}
                serviceLabel={row.serviceKey}
                vpsLabel={probe.title}
                httpStatus={item?.httpStatus}
                checkedAt={item?.createdAt}
                onSelect={run ? () => onProbeClick(run) : undefined}
              />
            )
          },
        }),
      ),
    ]
  }, [onProbeClick, probeCols, runById])

  return (
    <FrameDataGrid
      columns={columnDefFromDataGrid(columns)}
      data={groups}
      rowId={(row) => row.id}
      dense
      pagination={groups.length > 10}
      pinLeftColumnIds={['service']}
      horizontalScroll
      emptyTitle="Нет сервисов"
      emptyAction={emptyAction}
    />
  )
}
