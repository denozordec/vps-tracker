import { useMemo, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { GlobeIcon, ServerIcon } from 'lucide-react'

import type { DataGridColumn } from '@/components/data-grid-types'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { columnDefFromDataGrid, FrameDataGrid } from '@/components/reui-kit'
import {
  collectProbeColumns,
  collectServiceColumns,
  resultByService,
  type GeoServiceRow,
} from './geo-filters'
import { CountryMatrixCell } from './country-matrix-cell'
import { runHosterLabel, type IpregionRunDto } from './types'

/** DNA data-grid-base-4: auto width + H-scroll + pin start. Preview: https://reui.io/preview/base/data-grid-base-4 */
export const GEO_MATRIX_GRID = {
  tableWidth: 'auto' as const,
  horizontalScroll: true,
}

const MATRIX_CELL = 'w-16 min-w-16 px-1 text-center'

function vpsIdentityColumn(): DataGridColumn<IpregionRunDto> {
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

export function GeoVpsGrid({
  runs,
  onRowClick,
  emptyAction,
}: {
  runs: IpregionRunDto[]
  onRowClick: (run: IpregionRunDto) => void
  emptyAction?: ReactNode
}) {
  const serviceCols = useMemo(() => collectServiceColumns(runs), [runs])
  const columns = useMemo((): DataGridColumn<IpregionRunDto>[] => {
    return [
      vpsIdentityColumn(),
      ...serviceCols.map(
        (svc): DataGridColumn<IpregionRunDto> => ({
          key: `svc:${svc.key}`,
          header: svc.label,
          headerTitle: svc.title,
          className: MATRIX_CELL,
          headerClassName: MATRIX_CELL,
          size: 72,
          minSize: 64,
          sortable: true,
          sortValue: (row) => resultByService(row, svc.key)?.countryIpv4 ?? resultByService(row, svc.key)?.status ?? '',
          cell: (row) => {
            const item = resultByService(row, svc.key)
            return (
              <CountryMatrixCell
                status={item?.status}
                countryIpv4={item?.countryIpv4}
                countryIpv6={item?.countryIpv6}
                serviceLabel={svc.title}
                vpsLabel={row.vps?.dns || row.probePublicIp}
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
      {...GEO_MATRIX_GRID}
      emptyTitle="Нет проверок"
      emptyDescription="Запустите launcher на VPS, чтобы увидеть страны GeoIP."
      emptyAction={emptyAction}
      onRowClick={onRowClick}
    />
  )
}

export function GeoServiceGrid({
  groups,
  runs,
  onProbeClick,
  emptyAction,
}: {
  groups: GeoServiceRow[]
  runs: IpregionRunDto[]
  onProbeClick: (run: IpregionRunDto) => void
  emptyAction?: ReactNode
}) {
  const probeCols = useMemo(() => collectProbeColumns(runs), [runs])
  const runById = useMemo(() => new Map(runs.map((row) => [row.id, row])), [runs])

  const columns = useMemo((): DataGridColumn<GeoServiceRow>[] => {
    return [
      {
        key: 'service',
        header: 'Сервис',
        headerTitle: 'Сервис',
        icon: GlobeIcon,
        enableHiding: false,
        enablePinning: true,
        size: 180,
        minSize: 140,
        sortValue: (row) => row.serviceKey,
        cell: (row) => dataGridCellStack(row.serviceLabel, row.group),
      },
      ...probeCols.map(
        (probe): DataGridColumn<GeoServiceRow> => ({
          key: `probe:${probe.key}`,
          header: probe.label,
          headerTitle: probe.title,
          className: MATRIX_CELL,
          headerClassName: MATRIX_CELL,
          size: 72,
          minSize: 64,
          sortable: true,
          sortValue: (row) =>
            row.probes.find((item) => item.runId === probe.key)?.countryIpv4 ??
            row.probes.find((item) => item.runId === probe.key)?.status ??
            '',
          cell: (row) => {
            const item = row.probes.find((probeRow) => probeRow.runId === probe.key)
            const run = runById.get(probe.key)
            return (
              <CountryMatrixCell
                status={item?.status}
                countryIpv4={item?.countryIpv4}
                countryIpv6={item?.countryIpv6}
                serviceLabel={row.serviceKey}
                vpsLabel={probe.title}
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
      {...GEO_MATRIX_GRID}
      emptyTitle="Нет сервисов"
      emptyAction={emptyAction}
    />
  )
}
