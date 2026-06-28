import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { HistoryIcon } from 'lucide-react'

import { api } from '@/lib/api-client'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { QueryState } from '@/components/query-state'
import { DataGridCard, columnDefFromDataGrid } from '@/components/data-grid-card'
import type { DataGridColumn } from '@/components/data-grid-types'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'

interface AuditRow {
  id: string
  entity: string
  entityId: string
  action: string
  diff: Record<string, unknown> | null
  createdAt: string
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
}

export const Route = createFileRoute('/_auth/audit')({
  component: AuditPage,
})

function AuditPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audit'],
    queryFn: () => api.fetchAuditLog(200),
  })

  const columns: DataGridColumn<AuditRow>[] = [
    {
      key: 'createdAt',
      header: 'Время',
      icon: HistoryIcon,
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <span className="tabular-nums text-muted-foreground">
          {new Date(r.createdAt).toLocaleString('ru-RU')}
        </span>
      ),
    },
    {
      key: 'entity',
      header: 'Сущность',
      cell: (r) => <Badge variant="outline">{r.entity}</Badge>,
    },
    {
      key: 'action',
      header: 'Действие',
      cell: (r) => ACTION_LABELS[r.action] ?? r.action,
    },
    {
      key: 'entityId',
      header: 'ID',
      cell: (r) =>
        r.entity === 'vps' ? (
          <Button variant="link" className="h-auto p-0" render={<Link to="/vps/$vpsId" params={{ vpsId: r.entityId }} />}>
            {r.entityId}
          </Button>
        ) : (
          <span className="font-mono text-xs">{r.entityId}</span>
        ),
    },
    {
      key: 'diff',
      header: 'Изменения',
      sortable: false,
      cell: (r) => (
        <span className="max-w-md truncate text-xs text-muted-foreground">
          {r.diff ? JSON.stringify(r.diff) : '—'}
        </span>
      ),
    },
  ]

  return (
    <PageShell>
      <PageHeader title="Журнал изменений" description="История ручных правок через API" />
      <QueryState
        data={data}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        empty={!data?.length}
        emptyTitle="Записей нет"
        emptyDescription="Изменения VPS появятся здесь после CRUD-операций"
      >
        {(rows) => (
          <DataGridCard
            columns={columnDefFromDataGrid(columns)}
            data={rows as AuditRow[]}
            rowId={(r) => r.id}
            pageSize={25}
          />
        )}
      </QueryState>
    </PageShell>
  )
}
