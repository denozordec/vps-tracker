import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@cfdm/ui/components/badge'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-table-card'
import { QueryState } from '@/components/query-state'
import { TableSkeleton } from '@/components/skeletons'
import { EmptyState } from '@/components/empty-state'
import { ServerCogIcon } from 'lucide-react'

import type { ActiveTariff } from '@/types/entities'
import { providerByIdMap, accountSelectLabel } from '@/lib/billmanager'
import { formatCurrency } from '@/lib/format'

export const Route = createFileRoute('/_auth/tariffs')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: TariffsPage,
})

function TariffsPage() {
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const providerById = snapshot ? providerByIdMap(snapshot.providers) : new Map()

  const columns: DataTableColumn<ActiveTariff>[] = [
    {
      key: 'name',
      header: 'Тариф',
      cell: (t) => <span className="font-medium">{t.name || `#${t.pricelistId ?? t.id}`}</span>,
    },
    {
      key: 'account',
      header: 'Аккаунт',
      cell: (t) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === t.providerAccountId)
        return acc ? accountSelectLabel(acc, providerById) : '—'
      },
    },
    {
      key: 'specs',
      header: 'Ресурсы',
      cell: (t) => (
        <span className="tabular-nums text-muted-foreground">
          {t.vcpu ?? '—'} vCPU / {t.ramGb ?? '—'} GB / {t.diskGb ?? '—'} GB
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Цена/мес',
      cell: (t) => <span className="tabular-nums">{formatCurrency(Number(t.monthlyRate ?? 0), t.currency ?? 'RUB')}</span>,
    },
    { key: 'disk', header: 'Диск', cell: (t) => <Badge variant="outline">{t.diskType ?? '—'}</Badge> },
  ]

  return (
    <PageShell>
      <PageHeader title="Активные тарифы" description="Тарифы, загруженные из BILLmanager vds.order" />
      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton />}
        empty={snapshot?.activeTariffs.length === 0}
        emptyTitle="Тарифы не загружены"
        emptyDescription="Выполните синхронизацию аккаунта BILLmanager, чтобы загрузить тарифы"
        emptyAction={<EmptyState icon={<ServerCogIcon className="size-8" />} title="Нет тарифов" />}
      >
        {(snap) => <DataGridCard columns={columnDefFromDataTable(columns)} data={snap.activeTariffs} rowId={(t) => t.id} />}
      </QueryState>
    </PageShell>
  )
}
