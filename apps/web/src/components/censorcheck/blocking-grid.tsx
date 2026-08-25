import { useMemo, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ServerIcon, ShieldAlertIcon } from 'lucide-react'

import type { DataGridColumn } from '@/components/data-grid-types'
import { dataGridCellStack, dataGridCellWithIcon } from '@/components/data-grid-cells'
import { columnDefFromDataGrid, FrameDataGrid } from '@/components/reui-kit'
import {
  collectProbeColumns,
  collectServiceColumns,
  resultByService,
  type BlockingServiceRow,
} from './blocking-filters'
import { resolveServiceIcon, ServiceGlyph } from './service-icons'
import { StatusMatrixCell } from './status-matrix-cell'
import { runHosterLabel, type CensorcheckRunDto } from './types'

/** DNA data-grid-base-4: auto width + H-scroll + pin start. Preview: https://reui.io/preview/base/data-grid-base-4 */
export const BLOCKING_MATRIX_GRID = {
  tableWidth: 'auto' as const,
  horizontalScroll: true,
}

const MATRIX_CELL = 'w-16 min-w-16 px-1 text-center'

function vpsIdentityColumn(): DataGridColumn<CensorcheckRunDto> {
  return {
    key: 'vps',
    header: 'VPS / IP',
    headerTitle: 'VPS / IP',
    icon: ServerIcon,
    enableHiding: false,
    enablePinning: true,
    size: 240,
    minSize: 200,
    sortValue: (row) => row.vps?.dns || row.probePublicIp,
    cell: (row) => {
      const title = row.vps?.dns || row.probePublicIp
      const ip = row.probePublicIp
      const hoster = runHosterLabel(row)
      const secondary = hoster ? `${ip} · ${hoster}` : ip
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
      return dataGridCellStack(link, secondary)
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
          header: svc.label,
          headerTitle: svc.title,
          icon: resolveServiceIcon(svc.key),
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
      {...BLOCKING_MATRIX_GRID}
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
        cell: (row) =>
          dataGridCellWithIcon(
            <ServiceGlyph serviceKey={row.serviceKey} />,
            dataGridCellStack(row.serviceLabel, row.category),
          ),
      },
      ...probeCols.map(
        (probe): DataGridColumn<BlockingServiceRow> => ({
          key: `probe:${probe.key}`,
          header: probe.label,
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
      {...BLOCKING_MATRIX_GRID}
      emptyTitle="Нет сервисов"
      emptyAction={emptyAction}
    />
  )
}
