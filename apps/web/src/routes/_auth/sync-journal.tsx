import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { HistoryIcon, UserRoundIcon, CheckCircle2Icon, XCircleIcon, LoaderIcon } from 'lucide-react'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-grid-types'
import { QueryState } from '@/components/query-state'
import { TableSkeleton } from '@/components/skeletons'
import { StatusBadge } from '@/components/status-badge'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { formatSyncSummaryLine } from '@/lib/inventory-health'
import { formatRelativeSyncTime } from '@/lib/sync-format'

import type { SyncLogRow } from '@/types/entities'

export const Route = createFileRoute('/_auth/sync-journal')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: SyncJournalPage,
})

function statusIcon(status: SyncLogRow['status']) {
  if (status === 'ok') return <CheckCircle2Icon className="size-4 text-primary" />
  if (status === 'error') return <XCircleIcon className="size-4 text-destructive" />
  return <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
}

function SyncJournalPage() {
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())

  const columns: DataTableColumn<SyncLogRow>[] = [
    {
      key: 'started',
      header: 'Запуск',
      icon: HistoryIcon,
      sortValue: (r) => r.startedAt ?? '',
      cell: (r) => dataGridCellStack(
        r.startedAt ? new Date(r.startedAt).toLocaleString('ru-RU') : '—',
        r.finishedAt ? `завершён ${formatRelativeSyncTime(r.finishedAt)}` : undefined,
      ),
    },
    {
      key: 'account',
      header: 'Аккаунт',
      icon: UserRoundIcon,
      cell: (r) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === r.accountId)
        return acc?.name ?? r.accountId
      },
    },
    {
      key: 'status',
      header: 'Статус',
      cell: (r) => (
        <div className="flex items-center gap-2">
          {statusIcon(r.status)}
          <StatusBadge status={r.status} label={r.status === 'ok' ? 'OK' : r.status === 'error' ? 'Ошибка' : 'Выполняется'} />
        </div>
      ),
    },
    {
      key: 'summary',
      header: 'Итог',
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.error || formatSyncSummaryLine(r.summary as never) || '—'}
        </span>
      ),
    },
  ]

  return (
    <PageShell>
      <PageHeader
        title="Журнал синка"
        description="История синхронизаций BILLmanager по аккаунтам"
        actions={
          <Link to="/accounts" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Управление аккаунтами
          </Link>
        }
      />
      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton />}
        empty={!snapshot?.syncLog?.length}
        emptyTitle="Записей синка нет"
        emptyDescription="Запустите синхронизацию на странице аккаунтов"
      >
        {(snap) => (
          <DataGridCard
            columns={columnDefFromDataTable(columns)}
            data={snap.syncLog ?? []}
            rowId={(r) => r.id}
            dense
          />
        )}
      </QueryState>
    </PageShell>
  )
}
