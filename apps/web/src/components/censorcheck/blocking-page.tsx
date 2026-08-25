import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BanIcon,
  CalendarClockIcon,
  CopyIcon,
  GlobeIcon,
  RouterIcon,
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
  censorcheckCurrentQueryOptions,
  censorcheckHistoryQueryOptions,
} from '@/queries/censorcheck'
import { StatusBadge } from '@/components/status-badge'
import type { DataGridColumn } from '@/components/data-grid-types'
import { BlockingServiceGrid, BlockingVpsGrid } from './blocking-grid'
import { BlockingSnapshotScrubber } from './blocking-snapshot-scrubber'
import {
  collectSnapshotTicks,
  latestRunsAsOf,
  mergeCensorcheckRuns,
  resolveSnapshotIndex,
} from './blocking-snapshots'
import { CheckRunSheet } from './check-run-sheet'
import { filterCensorcheckRuns, serviceMatrixRows } from './blocking-filters'
import {
  CENSORCHECK_STATUS_LABELS,
  LAUNCHER_CMD,
  LAUNCHER_CMD_DAILY,
  LAUNCHER_CMD_ROS,
  LAUNCHER_CMD_ROS_DAILY,
  formatCheckedAt,
  type CensorcheckRunDto,
} from './types'

type GroupMode = 'vps' | 'service'
type TabId = 'current' | 'history'

const FILTER_FIELDS: FilterFieldConfig[] = [
  { key: 'q', label: 'Поиск', type: 'text', defaultOperator: 'contains', placeholder: 'IP, DNS, хостер, сервис' },
  {
    key: 'status',
    label: 'Статус',
    type: 'multiselect',
    defaultOperator: 'is_any_of',
    options: [
      { value: 'available', label: 'Доступен' },
      { value: 'blocked', label: 'Заблокирован' },
      { value: 'denied', label: 'Отказ' },
      { value: 'timeout', label: 'Таймаут' },
      { value: 'redirected', label: 'Редирект' },
      { value: 'error', label: 'Ошибка' },
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

const historyColumns: DataGridColumn<CensorcheckRunDto>[] = [
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
      <StatusBadge status={row.status} label={CENSORCHECK_STATUS_LABELS[row.status] ?? row.status} />
    ),
  },
  {
    key: 'summary',
    header: 'Блок / всего',
    sortValue: (row) => row.summary.blocked,
    sortingFn: 'basic',
    cell: (row) => `${row.summary.blocked} / ${row.summary.total}`,
  },
  {
    key: 'createdAt',
    header: 'Проверено',
    sortValue: (row) => row.createdAt,
    cell: (row) => formatCheckedAt(row.createdAt),
  },
]

export function BlockingPage() {
  const { spaceId } = useSpaceId()
  const [tab, setTab] = useState<TabId>('current')
  const [group, setGroup] = useState<GroupMode>('vps')
  const [filters, setFilters] = useState<Filter[]>([])
  const [selected, setSelected] = useState<CensorcheckRunDto | null>(null)
  const [snapshotIndex, setSnapshotIndex] = useState<number | null>(null)

  const currentQuery = useQuery(censorcheckCurrentQueryOptions(spaceId))
  const historyQuery = useQuery(censorcheckHistoryQueryOptions({ limit: 200 }, spaceId))

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
    () => filterCensorcheckRuns(snapshotRuns, filters),
    [snapshotRuns, filters],
  )
  const serviceGroups = useMemo(() => serviceMatrixRows(filtered), [filtered])

  const matched = filtered.filter((row) => row.matchedVpsId).length
  const blocked = filtered.reduce((sum, row) => sum + row.summary.blocked, 0)

  const copyLauncher = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => void copyText(LAUNCHER_CMD, 'Команда скопирована')}
      >
        <CopyIcon data-icon="inline-start" />
        Скопировать команду
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => void copyText(LAUNCHER_CMD_DAILY, 'Команда для ежедневного запуска скопирована')}
      >
        <CalendarClockIcon data-icon="inline-start" />
        Раз в день
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => void copyText(LAUNCHER_CMD_ROS, 'Команда MikroTik скопирована')}
      >
        <RouterIcon data-icon="inline-start" />
        MikroTik
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => void copyText(LAUNCHER_CMD_ROS_DAILY, 'Команда MikroTik для ежедневного запуска скопирована')}
      >
        <RouterIcon data-icon="inline-start" />
        MikroTik · день
      </Button>
    </>
  )

  return (
    <PageShell>
      <PageHeader
        title="Статус блокировок"
        description="Проверки DPI и геоблокировок с VPS или MikroTik 7.22+."
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
            id: 'unmatched',
            label: 'Unknown VPS',
            value: filtered.length - matched,
            icon: <ShieldAlertIcon />,
          },
          {
            id: 'blocked',
            label: 'Блокировки',
            value: blocked,
            icon: <BanIcon />,
            variant: blocked > 0 ? 'destructive' : 'default',
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
            emptyDescription={`На VPS: ${LAUNCHER_CMD}. На MikroTik 7.22+: ${LAUNCHER_CMD_ROS}`}
            emptyAction={copyLauncher}
            skeleton={<TableSkeleton />}
          >
            {(rows) =>
              group === 'vps' ? (
                <BlockingVpsGrid
                  runs={rows}
                  onRowClick={setSelected}
                  emptyAction={copyLauncher}
                />
              ) : (
                <BlockingServiceGrid
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
          description="Все сохранённые прогоны censorcheck."
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
            description: `На VPS: ${LAUNCHER_CMD}. На MikroTik 7.22+: ${LAUNCHER_CMD_ROS}`,
            action: copyLauncher,
          }}
        />
      )}

      <CheckRunSheet
        run={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </PageShell>
  )
}
