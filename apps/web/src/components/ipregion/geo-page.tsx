import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CopyIcon,
  GlobeIcon,
  MapPinIcon,
  ServerIcon,
  ShieldAlertIcon,
} from 'lucide-react'

import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@cfdm/ui/components/button'
import { ToggleGroup, ToggleGroupItem } from '@cfdm/ui/components/toggle-group'
import { CountedLineTabs } from '@/components/counted-line-tabs'
import { KpiStatGrid, ResourcePage, columnDefFromDataGrid } from '@/components/reui-kit'
import { Filters, type Filter, type FilterFieldConfig } from '@/components/reui/filters'
import { QueryState } from '@/components/query-state'
import { TableSkeleton } from '@/components/skeletons'
import { copyText } from '@/lib/clipboard'
import { useSpaceId } from '@/lib/space'
import {
  ipregionCurrentQueryOptions,
  ipregionHistoryQueryOptions,
} from '@/queries/ipregion'
import { StatusBadge } from '@/components/status-badge'
import type { DataGridColumn } from '@/components/data-grid-types'
import { BlockingSnapshotScrubber } from '@/components/censorcheck/blocking-snapshot-scrubber'
import {
  collectSnapshotTicks,
  latestRunsAsOf,
  mergeCensorcheckRuns,
  resolveSnapshotIndex,
} from '@/components/censorcheck/blocking-snapshots'
import { GeoServiceGrid, GeoVpsGrid } from './geo-grid'
import { GeoRunSheet } from './geo-run-sheet'
import {
  filterIpregionRuns,
  isGeoMismatch,
  serviceMatrixRows,
  uniqueCountries,
} from './geo-filters'
import {
  IPREGION_STATUS_LABELS,
  LAUNCHER_CMD,
  formatCheckedAt,
  type IpregionRunDto,
} from './types'

type GroupMode = 'vps' | 'service'
type TabId = 'current' | 'history'

const FILTER_FIELDS: FilterFieldConfig[] = [
  { key: 'q', label: 'Поиск', type: 'text', defaultOperator: 'contains', placeholder: 'IP, DNS, хостер, ISO' },
  {
    key: 'status',
    label: 'Статус',
    type: 'multiselect',
    defaultOperator: 'is_any_of',
    options: [
      { value: 'ok', label: 'Страна' },
      { value: 'na', label: 'N/A' },
      { value: 'denied', label: 'Отказ' },
      { value: 'rate_limit', label: 'Лимит' },
      { value: 'server_error', label: 'Ошибка' },
    ],
  },
  { key: 'service', label: 'Сервис', type: 'text', defaultOperator: 'is_any_of' },
  { key: 'hoster', label: 'Хостер', type: 'text', defaultOperator: 'contains' },
  { key: 'country', label: 'Страна', type: 'text', defaultOperator: 'contains' },
  {
    key: 'matched',
    label: 'Привязка',
    type: 'select',
    defaultOperator: 'is',
    options: [
      { value: 'matched', label: 'Известный VPS' },
      { value: 'unmatched', label: 'Unknown VPS' },
    ],
  },
]

const historyColumns: DataGridColumn<IpregionRunDto>[] = [
  {
    key: 'ip',
    header: 'IP',
    sortValue: (row) => row.probePublicIp,
    cell: (row) => row.probePublicIp,
  },
  {
    key: 'vps',
    header: 'VPS',
    sortValue: (row) => row.vps?.dns ?? '',
    cell: (row) => row.vps?.dns || (row.matchedVpsId ? row.matchedVpsId : 'Unknown VPS'),
  },
  {
    key: 'status',
    header: 'Статус',
    cell: (row) => (
      <StatusBadge status={row.status} label={IPREGION_STATUS_LABELS[row.status] ?? row.status} />
    ),
  },
  {
    key: 'summary',
    header: 'OK / всего',
    sortValue: (row) => row.summary.ok,
    sortingFn: 'basic',
    cell: (row) => `${row.summary.ok} / ${row.summary.total}`,
  },
  {
    key: 'createdAt',
    header: 'Проверено',
    sortValue: (row) => row.createdAt,
    cell: (row) => formatCheckedAt(row.createdAt),
  },
]

export function GeoPage() {
  const { spaceId } = useSpaceId()
  const [tab, setTab] = useState<TabId>('current')
  const [group, setGroup] = useState<GroupMode>('vps')
  const [filters, setFilters] = useState<Filter[]>([])
  const [selected, setSelected] = useState<IpregionRunDto | null>(null)
  const [snapshotIndex, setSnapshotIndex] = useState<number | null>(null)

  const currentQuery = useQuery(ipregionCurrentQueryOptions(spaceId))
  const historyQuery = useQuery(ipregionHistoryQueryOptions({ limit: 200 }, spaceId))

  const allRuns = useMemo(
    () => mergeCensorcheckRuns(currentQuery.data?.items ?? [], historyQuery.data?.items ?? []),
    [currentQuery.data?.items, historyQuery.data?.items],
  )
  const ticks = useMemo(() => collectSnapshotTicks(allRuns), [allRuns])
  const resolvedIndex = resolveSnapshotIndex(ticks.length, snapshotIndex)
  const snapshotRuns = useMemo(() => {
    const asOf = ticks[resolvedIndex]?.asOf
    if (!asOf) return currentQuery.data?.items ?? []
    return latestRunsAsOf(allRuns, asOf)
  }, [allRuns, currentQuery.data?.items, resolvedIndex, ticks])
  const filtered = useMemo(
    () => filterIpregionRuns(snapshotRuns, filters),
    [snapshotRuns, filters],
  )
  const serviceGroups = useMemo(() => serviceMatrixRows(filtered), [filtered])

  const matched = filtered.filter((row) => row.matchedVpsId).length
  const countries = uniqueCountries(filtered).length
  const mismatches = filtered.filter(isGeoMismatch).length

  const copyLauncher = (
    <Button
      type="button"
      variant="outline"
      onClick={() => void copyText(LAUNCHER_CMD, 'Команда скопирована')}
    >
      <CopyIcon data-icon="inline-start" />
      Скопировать команду
    </Button>
  )

  return (
    <PageShell>
      <PageHeader
        title="GeoIP"
        description="Страны по GeoIP-сервисам с VPS через ipregion."
        actions={copyLauncher}
      />
      <KpiStatGrid
        items={[
          {
            id: 'probes',
            label: 'Пробы',
            value: filtered.length,
            icon: <GlobeIcon />,
          },
          {
            id: 'matched',
            label: 'Известные VPS',
            value: matched,
            icon: <ServerIcon />,
          },
          {
            id: 'countries',
            label: 'Уникальные страны',
            value: countries,
            icon: <MapPinIcon />,
          },
          {
            id: 'mismatch',
            label: 'Расхождения GeoIP',
            value: mismatches,
            icon: <ShieldAlertIcon />,
            variant: mismatches > 0 ? 'warning' : 'default',
          },
        ]}
        isLoading={currentQuery.isLoading}
      />

      <CountedLineTabs
        tabs={[
          { id: 'current', label: 'Текущие', count: currentQuery.data?.items.length },
          { id: 'history', label: 'История', count: historyQuery.data?.items.length },
        ]}
        value={tab}
        onValueChange={(value) => setTab(value as TabId)}
      />

      {tab === 'current' ? (
        <div className="flex min-w-0 w-full flex-col gap-3">
          <BlockingSnapshotScrubber
            ticks={ticks}
            index={resolvedIndex}
            onIndexChange={setSnapshotIndex}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Filters
              filters={filters}
              fields={FILTER_FIELDS}
              onChange={setFilters}
              trigger={
                <Button type="button" variant="outline">
                  Фильтры
                </Button>
              }
            />
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              value={[group]}
              onValueChange={(next) => {
                const selectedMode = next[0]
                if (selectedMode === 'vps' || selectedMode === 'service') setGroup(selectedMode)
              }}
              aria-label="Группировка"
            >
              <ToggleGroupItem value="vps">По VPS</ToggleGroupItem>
              <ToggleGroupItem value="service">По сервису</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <QueryState
            data={filtered}
            isLoading={currentQuery.isLoading}
            isError={currentQuery.isError}
            error={currentQuery.error}
            onRetry={() => void currentQuery.refetch()}
            empty={filtered.length === 0}
            emptyTitle="Пока нет проверок"
            emptyDescription={`На VPS выполните: ${LAUNCHER_CMD}`}
            emptyAction={copyLauncher}
            skeleton={<TableSkeleton />}
          >
            {(rows) =>
              group === 'vps' ? (
                <GeoVpsGrid
                  runs={rows}
                  onRowClick={setSelected}
                  emptyAction={copyLauncher}
                />
              ) : (
                <GeoServiceGrid
                  groups={serviceGroups}
                  runs={rows}
                  onProbeClick={setSelected}
                  emptyAction={copyLauncher}
                />
              )
            }
          </QueryState>
        </div>
      ) : (
        <ResourcePage
          title="История проверок"
          description="Все сохранённые прогоны ipregion."
          hideHeader
          columns={columnDefFromDataGrid(historyColumns)}
          data={historyQuery.data?.items ?? []}
          getRowId={(row) => row.id}
          isLoading={historyQuery.isLoading}
          isError={historyQuery.isError}
          error={historyQuery.error instanceof Error ? historyQuery.error : null}
          onRetry={() => void historyQuery.refetch()}
          onRowClick={setSelected}
          emptyState={{
            title: 'История пуста',
            description: `На VPS выполните: ${LAUNCHER_CMD}`,
            action: copyLauncher,
          }}
        />
      )}

      <GeoRunSheet
        run={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </PageShell>
  )
}
