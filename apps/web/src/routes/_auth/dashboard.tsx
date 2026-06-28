import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ServerIcon,
  AlertTriangleIcon,
  WalletIcon,
  TrendingUpIcon,
  HashIcon,
  ExternalLinkIcon,
  GlobeIcon,
  FolderKanbanIcon,
  CoinsIcon,
  ClockIcon,
  RefreshCwIcon,
  BarChart3Icon,
  DownloadIcon,
} from 'lucide-react'

import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { dashboardStatsQueryOptions } from '@/queries/dashboard'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { SectionCards } from '@/components/section-cards'
import { QueryState } from '@/components/query-state'
import { DataGridCard, columnDefFromDataGrid } from '@/components/data-grid-card'
import type { DataGridColumn } from '@/components/data-grid-types'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { SectionCardsSkeleton, TableSkeleton } from '@/components/skeletons'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { Alert, AlertDescription, AlertTitle } from '@cfdm/ui/components/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@cfdm/ui/components/tabs'
import { StatusBadge } from '@/components/status-badge'
import { cn } from '@cfdm/ui/lib/utils'

import { computeInventoryHealth } from '@/lib/inventory-health'
import { buildAtRiskAccounts, type AtRiskAccount } from '@/lib/account-health'
import { formatInBaseCurrency, normalizeRatesPayload, vpsStatusLabel } from '@/lib/format'
import { exportActiveVpsCsv } from '@/lib/export-csv'
import { MonthlyTrendChart, MonthlyExpenseChart } from '@/components/domain/charts'

import type { Vps } from '@/types/entities'

const DASHBOARD_TAB_TRIGGER_CLASS =
  'flex-none rounded-none border-0 border-b-2 border-transparent px-3 pb-2.5 pt-2 shadow-none after:hidden data-active:border-foreground data-active:bg-transparent data-active:shadow-none dark:data-active:border-foreground dark:data-active:bg-transparent'

export const Route = createFileRoute('/_auth/dashboard')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(snapshotQueryOptions()),
      queryClient.ensureQueryData(dashboardStatsQueryOptions()),
    ]),
  component: DashboardPage,
})

type InventoryIssue = { key: string; title: string; count: number; to: string; hint?: string }

function DashboardPage() {
  const navigate = useNavigate()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const { data: stats } = useQuery(dashboardStatsQueryOptions())
  const settings = snapshot?.settings?.[0]
  const { data: rawRates } = useQuery(ratesQueryOptions(settings?.ratesUrl))
  const ratesData = normalizeRatesPayload(rawRates) ?? rawRates ?? null

  return (
    <PageShell>
      <PageHeader
        title="Дашборд"
        description="Сводка по VPS, балансам и здоровью инвентаря"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link to="/reports" />}>
              <BarChart3Icon data-icon="inline-start" />
              Отчёты
            </Button>
            <Button variant="outline" render={<Link to="/accounts" />}>
              <RefreshCwIcon data-icon="inline-start" />
              Синхронизация
            </Button>
          </div>
        }
      />

      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={
          <div className="flex flex-col gap-4">
            <SectionCardsSkeleton count={6} />
            <TableSkeleton />
          </div>
        }
      >
        {(snap) => {
          const activeVps = snap.vps.filter((v) => v.status === 'active')
          const issues = computeInventoryHealth({ ...snap, syncLog: snap.syncLog ?? [] })
          const atRisk = buildAtRiskAccounts(snap.providerAccounts, snap.providers, snap.syncLog ?? [])
          const baseCur = snap.settings[0]?.baseCurrency ?? 'RUB'

          const issueColumns: DataGridColumn<InventoryIssue>[] = [
            {
              key: 'title',
              header: 'Проблема',
              icon: AlertTriangleIcon,
              cell: (row) => (
                <div className="flex items-center gap-2">
                  <AlertTriangleIcon className="size-4 text-destructive" />
                  {dataGridCellStack(row.title, row.hint)}
                </div>
              ),
            },
            {
              key: 'count',
              header: 'Кол-во',
              icon: HashIcon,
              headerClassName: 'text-right',
              className: 'text-right',
              cell: (row) => <span className="tabular-nums font-medium">{row.count}</span>,
            },
            {
              key: 'action',
              header: 'Действие',
              icon: ExternalLinkIcon,
              sortable: false,
              cell: (row) => (
                <Button variant="ghost" size="sm" onClick={() => navigate({ to: row.to })}>
                  Открыть
                </Button>
              ),
            },
          ]

          const vpsColumns: DataGridColumn<Vps>[] = [
            {
              key: 'ip',
              header: 'IP / DNS',
              icon: GlobeIcon,
              sortValue: (v) => v.ip || v.dns || '',
              cell: (v) => dataGridCellStack(v.ip || v.dns || '—', v.dns && v.ip ? v.dns : undefined),
            },
            {
              key: 'project',
              header: 'Проект',
              icon: FolderKanbanIcon,
              cell: (v) => <span className="text-muted-foreground">{v.project || '—'}</span>,
            },
            {
              key: 'status',
              header: 'Статус',
              cell: (v) => <StatusBadge status={v.status} label={vpsStatusLabel(v.status)} />,
            },
            {
              key: 'rate',
              header: 'Ставка/мес',
              icon: CoinsIcon,
              headerClassName: 'text-right',
              className: 'text-right',
              sortValue: (v) =>
                v.tariffType === 'daily' ? Number(v.dailyRate || 0) * 30 : Number(v.monthlyRate || 0),
              cell: (v) => (
                <span className="tabular-nums font-medium">
                  {formatInBaseCurrency(
                    v.tariffType === 'daily' ? Number(v.dailyRate || 0) * 30 : Number(v.monthlyRate || 0),
                    v.currency,
                    snap.settings,
                    ratesData,
                  )}
                </span>
              ),
            },
          ]

          const riskColumns: DataGridColumn<AtRiskAccount>[] = [
            {
              key: 'name',
              header: 'Аккаунт',
              cell: (row) => <span className="font-medium">{row.name}</span>,
            },
            {
              key: 'reason',
              header: 'Причина',
              cell: (row) => (
                <StatusBadge
                  status={row.severity === 'destructive' ? 'error' : 'stale'}
                  label={row.reason}
                />
              ),
            },
            {
              key: 'action',
              header: '',
              sortable: false,
              cell: () => (
                <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/accounts' })}>
                  Открыть
                </Button>
              ),
            },
          ]

          return (
            <div className="flex flex-col gap-4 md:gap-6">
              <SectionCards
                items={[
                  {
                    label: 'Активные VPS',
                    value: stats?.activeVpsCount ?? activeVps.length,
                    icon: <ServerIcon className="size-4" />,
                    hint: `всего ${stats?.totalVpsCount ?? snap.vps.length}`,
                    onClick: () => navigate({ to: '/vps' }),
                  },
                  {
                    label: 'Расход/мес',
                    value: formatInBaseCurrency(
                      stats?.monthlyBurnEstimate ?? 0,
                      baseCur,
                      snap.settings,
                      ratesData,
                    ),
                    icon: <TrendingUpIcon className="size-4" />,
                    onClick: () => navigate({ to: '/reports' }),
                  },
                  {
                    label: 'Баланс API',
                    value: formatInBaseCurrency(
                      stats?.totalBalanceApi ?? 0,
                      baseCur,
                      snap.settings,
                      ratesData,
                    ),
                    icon: <WalletIcon className="size-4" />,
                    onClick: () => navigate({ to: '/accounts' }),
                  },
                  {
                    label: 'Runway (мин.)',
                    value: stats?.minRunwayDays != null ? `${stats.minRunwayDays} дн` : '—',
                    icon: <ClockIcon className="size-4" />,
                    variant: stats?.minRunwayDays != null && stats.minRunwayDays < 14 ? 'warning' : 'default',
                    badge:
                      stats?.minRunwayDays != null && stats.minRunwayDays < 14 ? (
                        <Badge variant="outline" className="text-xs">
                          &lt; 14 дн
                        </Badge>
                      ) : undefined,
                    onClick: () => navigate({ to: '/accounts' }),
                  },
                  {
                    label: 'Истекает 7 дн',
                    value: stats?.expiringWithin7Days ?? 0,
                    icon: <AlertTriangleIcon className="size-4" />,
                    variant: (stats?.expiringWithin7Days ?? 0) > 0 ? 'warning' : 'default',
                    badge:
                      (stats?.expiringWithin7Days ?? 0) > 0 ? (
                        <Badge variant="outline" className="text-xs">
                          внимание
                        </Badge>
                      ) : undefined,
                    onClick: () => navigate({ to: '/vps', search: { health: 'expiring-soon' } }),
                  },
                  {
                    label: 'Проблемы',
                    value: issues.length,
                    icon: <HashIcon className="size-4" />,
                    variant: issues.length > 0 ? 'destructive' : 'default',
                  },
                ]}
              />

              {issues.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTriangleIcon />
                  <AlertTitle>Требует внимания</AlertTitle>
                  <AlertDescription>
                    Обнаружено {issues.length} категорий проблем в инвентаре. Проверьте вкладку «Проблемы».
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <MonthlyTrendChart
                  payments={snap.payments}
                  settings={snap.settings}
                  ratesData={ratesData}
                  className="h-full"
                />
                <MonthlyExpenseChart
                  vps={snap.vps}
                  providers={snap.providers}
                  providerAccounts={snap.providerAccounts}
                  settings={snap.settings}
                  ratesData={ratesData}
                  className="h-full"
                />
              </div>

              <Tabs defaultValue="issues" className="flex w-full flex-col gap-4">
                <TabsList variant="line" className="mb-0 h-auto w-fit gap-1 border-b border-border p-0">
                  <TabsTrigger value="issues" className={cn(DASHBOARD_TAB_TRIGGER_CLASS, 'gap-2')}>
                    Проблемы
                    {issues.length > 0 ? (
                      <Badge variant="secondary">{issues.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="recent" className={DASHBOARD_TAB_TRIGGER_CLASS}>
                    Последние VPS
                  </TabsTrigger>
                  <TabsTrigger value="risk" className={cn(DASHBOARD_TAB_TRIGGER_CLASS, 'gap-2')}>
                    Аккаунты
                    {atRisk.length > 0 ? (
                      <Badge variant="outline">{atRisk.length}</Badge>
                    ) : null}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="issues" className="mt-0">
                  <DataGridCard
                    title="Здоровье инвентаря"
                    description="Ставка, оплата, синк, баланс аккаунтов"
                    columns={columnDefFromDataGrid(issueColumns)}
                    data={issues}
                    rowId={(i) => i.key}
                    emptyTitle="Проблем не найдено"
                    emptyDescription="Критичных проблем в инвентаре не обнаружено"
                    pagination={false}
                  />
                </TabsContent>
                <TabsContent value="recent" className="mt-0">
                  <DataGridCard
                    title="Последние VPS"
                    description="Активные серверы"
                    actions={
                      <Button variant="outline" size="sm" render={<Link to="/vps" />}>
                        Все VPS
                      </Button>
                    }
                    columns={columnDefFromDataGrid(vpsColumns)}
                    data={activeVps.slice(0, 8)}
                    rowId={(v) => v.id}
                    pagination={false}
                    onRowClick={(v) => navigate({ to: '/vps', search: { edit: v.id } })}
                  />
                </TabsContent>
                <TabsContent value="risk" className="mt-0">
                  <DataGridCard
                    title="Аккаунты под риском"
                    description="Низкий баланс или устаревший синк BILLmanager"
                    columns={columnDefFromDataGrid(riskColumns)}
                    data={atRisk}
                    rowId={(r) => r.id}
                    emptyTitle="Рисков нет"
                    emptyDescription="Балансы и синхронизация в норме"
                    pagination={false}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" render={<Link to="/resources" />}>
                  Ресурсы
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportActiveVpsCsv(activeVps)}
                >
                  <DownloadIcon data-icon="inline-start" />
                  Экспорт CSV
                </Button>
              </div>
            </div>
          )
        }}
      </QueryState>
    </PageShell>
  )
}
