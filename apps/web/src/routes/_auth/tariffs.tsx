import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@cfdm/ui/components/badge'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-grid-types'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { QueryState } from '@/components/query-state'
import { TableSkeleton } from '@/components/skeletons'
import { Button } from '@cfdm/ui/components/button'
import { ServerIcon, UserRoundIcon, CpuIcon, CoinsIcon, HardDriveIcon, RefreshCwIcon } from 'lucide-react'

import type { ActiveTariff } from '@/types/entities'
import { providerByIdMap, accountSelectLabel, billmanagerSyncableAccounts } from '@/lib/billmanager'
import { formatCurrency } from '@/lib/format'

export const Route = createFileRoute('/_auth/tariffs')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: TariffsPage,
})

function TariffsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const providerById = snapshot ? providerByIdMap(snapshot.providers) : new Map()
  const syncableCount = snapshot
    ? billmanagerSyncableAccounts(snapshot.providerAccounts, snapshot.providers).length
    : 0

  const syncTariffsMut = useMutation({
    mutationFn: async () => {
      if (!snapshot) return { tariffsCount: 0 }
      const accounts = billmanagerSyncableAccounts(snapshot.providerAccounts, snapshot.providers)
      let tariffsCount = 0
      for (const a of accounts) {
        const res = (await api.syncAccount(a.id)) as {
          synced?: { tariffsCount?: number }
        }
        tariffsCount += res?.synced?.tariffsCount ?? 0
      }
      return { tariffsCount, accounts: accounts.length }
    },
    onSuccess: ({ tariffsCount, accounts }) => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      if (accounts === 0) {
        toast.error('Нет аккаунтов BILLmanager с настроенным API')
        return
      }
      toast.success(`Загружено тарифов: ${tariffsCount}`)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка загрузки тарифов'),
  })

  const columns: DataTableColumn<ActiveTariff>[] = [
    {
      key: 'name',
      header: 'Тариф',
      icon: ServerIcon,
      cell: (t) => <span className="font-medium">{t.name || `#${t.pricelistId ?? t.id}`}</span>,
    },
    {
      key: 'account',
      header: 'Аккаунт',
      icon: UserRoundIcon,
      sortValue: (t) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === t.providerAccountId)
        return acc ? accountSelectLabel(acc, providerById) : ''
      },
      cell: (t) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === t.providerAccountId)
        if (!acc) return '—'
        const providerName = providerById.get(acc.providerId)?.name ?? '—'
        return dataGridCellStack(acc.name, providerName)
      },
    },
    {
      key: 'specs',
      header: 'Ресурсы',
      icon: CpuIcon,
      sortValue: (t) => t.vcpu ?? 0,
      cell: (t) => (
        <span className="tabular-nums text-muted-foreground">
          {t.vcpu ?? '—'} vCPU / {t.ramGb ?? '—'} GB / {t.diskGb ?? '—'} GB
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Цена/мес',
      icon: CoinsIcon,
      headerClassName: 'text-right',
      className: 'text-right',
      sortValue: (t) => Number(t.monthlyRate ?? 0),
      cell: (t) => <span className="tabular-nums font-medium">{formatCurrency(Number(t.monthlyRate ?? 0), t.currency ?? 'RUB')}</span>,
    },
    {
      key: 'disk',
      header: 'Диск',
      icon: HardDriveIcon,
      cell: (t) => <Badge variant="outline">{t.diskType ?? '—'}</Badge>,
    },
  ]

  return (
    <PageShell>
      <PageHeader
        title="Активные тарифы"
        description="Тарифы, загруженные из BILLmanager vds.order"
        actions={
          syncableCount > 0 ? (
            <Button variant="outline" disabled={syncTariffsMut.isPending} onClick={() => syncTariffsMut.mutate()}>
              <RefreshCwIcon data-icon="inline-start" />
              Загрузить тарифы
            </Button>
          ) : undefined
        }
      />
      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton />}
        empty={snapshot?.activeTariffs.length === 0}
        emptyTitle="Тарифы не загружены"
        emptyDescription="Синхронизация аккаунта BILLmanager загружает тарифы вместе с VPS и платежами"
        emptyAction={
          <div className="flex flex-wrap justify-center gap-2">
            {syncableCount > 0 ? (
              <Button disabled={syncTariffsMut.isPending} onClick={() => syncTariffsMut.mutate()}>
                <RefreshCwIcon data-icon="inline-start" />
                Загрузить тарифы
              </Button>
            ) : null}
            <Button variant="outline" render={<Link to="/accounts" />}>
              Перейти к аккаунтам
            </Button>
          </div>
        }
      >
        {(snap) => <DataGridCard columns={columnDefFromDataTable(columns)} data={snap.activeTariffs} rowId={(t) => t.id} />}
      </QueryState>
    </PageShell>
  )
}
