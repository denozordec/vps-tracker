import { createFileRoute, useNavigate } from '@tanstack/react-router'
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
  CircleDotIcon,
  CoinsIcon,
} from 'lucide-react'

import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { SectionCards } from '@/components/section-cards'
import { QueryState } from '@/components/query-state'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-table-card'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { SectionCardsSkeleton } from '@/components/skeletons'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'

import { computeInventoryHealth } from '@/lib/inventory-health'
import { formatInBaseCurrency, normalizeRatesPayload, vpsStatusLabel } from '@/lib/format'

import type { Vps } from '@/types/entities'

export const Route = createFileRoute('/_auth/dashboard')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: DashboardPage,
})

type InventoryIssue = { key: string; title: string; count: number; to: string; hint?: string }

function DashboardPage() {
  const navigate = useNavigate()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const settings = snapshot?.settings?.[0]
  const { data: rawRates } = useQuery(ratesQueryOptions(settings?.ratesUrl))
  const ratesData = normalizeRatesPayload(rawRates) ?? rawRates ?? null

  return (
    <PageShell>
      <PageHeader title="Дашборд" description="Сводка по VPS, балансам и здоровью инвентаря" />

      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<SectionCardsSkeleton />}
      >
        {(snap) => {
          const activeVps = snap.vps.filter((v) => v.status === 'active')
          const monthlyTotal = activeVps.reduce((acc, v) => {
            const monthly = Number(v.monthlyRate || 0)
            const daily = Number(v.dailyRate || 0)
            const burn = v.tariffType === 'daily' ? daily * 30 : monthly
            return acc + (Number.isFinite(burn) ? burn : 0)
          }, 0)
          const issues = computeInventoryHealth(snap)
          const totalBalance = snap.providerAccounts.reduce(
            (acc, a) => acc + (Number(a.balance_api ?? 0) || 0),
            0,
          )

          const issueColumns: DataTableColumn<InventoryIssue>[] = [
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
                <Button variant="outline" size="sm" onClick={() => navigate({ to: row.to })}>
                  Открыть
                </Button>
              ),
            },
          ]

          const vpsColumns: DataTableColumn<Vps>[] = [
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
              icon: CircleDotIcon,
              cell: (v) => (
                <Badge variant={v.status === 'active' ? 'default' : 'secondary'}>
                  {vpsStatusLabel(v.status)}
                </Badge>
              ),
            },
            {
              key: 'rate',
              header: 'Ставка/мес',
              icon: CoinsIcon,
              headerClassName: 'text-right',
              className: 'text-right',
              sortValue: (v) =>
                v.tariffType === 'daily'
                  ? Number(v.dailyRate || 0) * 30
                  : Number(v.monthlyRate || 0),
              cell: (v) => (
                <span className="tabular-nums font-medium">
                  {formatInBaseCurrency(
                    v.tariffType === 'daily'
                      ? Number(v.dailyRate || 0) * 30
                      : Number(v.monthlyRate || 0),
                    v.currency,
                    snap.settings,
                    ratesData,
                  )}
                </span>
              ),
            },
          ]

          return (
            <>
              <SectionCards
                items={[
                  {
                    label: 'Активные VPS',
                    value: activeVps.length,
                    icon: <ServerIcon className="size-4" />,
                    hint: `всего ${snap.vps.length}`,
                  },
                  {
                    label: 'Хостеры',
                    value: snap.providers.length,
                    icon: <WalletIcon className="size-4" />,
                    hint: `${snap.providerAccounts.length} аккаунтов`,
                  },
                  {
                    label: 'Расход/мес (оценка)',
                    value: formatInBaseCurrency(monthlyTotal, snap.vps[0]?.currency ?? 'USD', snap.settings, ratesData),
                    icon: <TrendingUpIcon className="size-4" />,
                  },
                  {
                    label: 'Баланс аккаунтов (API)',
                    value: formatInBaseCurrency(totalBalance, snap.settings[0]?.baseCurrency ?? 'RUB', snap.settings, ratesData),
                    icon: <WalletIcon className="size-4" />,
                  },
                ]}
              />

              <DataGridCard
                title="Здоровье инвентаря"
                description="Подсказки: нет проекта, нет ставки, просрочка, устаревший синк, расхождения баланса"
                actions={
                  issues.length > 0 ? (
                    <Badge variant="destructive">{issues.length}</Badge>
                  ) : (
                    <Badge variant="secondary">всё ок</Badge>
                  )
                }
                columns={columnDefFromDataTable(issueColumns)}
                data={issues}
                rowId={(i) => i.key}
                emptyTitle="Проблем не найдено"
                emptyDescription="Все активные VPS имеют проект, ставку и актуальный синк"
              />

              <DataGridCard
                title="Последние VPS"
                description="Активные серверы"
                columns={columnDefFromDataTable(vpsColumns)}
                data={activeVps.slice(0, 8)}
                rowId={(v) => v.id}
                pagination={false}
              />
            </>
          )
        }}
      </QueryState>
    </PageShell>
  )
}
