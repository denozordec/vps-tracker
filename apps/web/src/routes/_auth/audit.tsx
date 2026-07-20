import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { HistoryIcon } from 'lucide-react'

import { api } from '@/lib/api-client'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { QueryState } from '@/components/query-state'
import { ResourcePage, columnDefFromDataGrid } from '@/components/reui-kit'
import type { DataGridColumn } from '@/components/data-grid-types'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { TableSkeleton } from '@/components/skeletons'

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  vps: 'VPS',
  payment: 'Платёж',
  providerAccount: 'Аккаунт',
  provider: 'Хостер',
  settings: 'Настройки',
  balanceLedger: 'Баланс',
  serverProject: 'Проект',
}

function auditEntityLabel(entity: string): string {
  return AUDIT_ENTITY_LABELS[entity] ?? entity
}

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
      cell: (r) => <Badge variant="outline">{auditEntityLabel(r.entity)}</Badge>,
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
        skeleton={<TableSkeleton />}
        empty={!data?.length}
        emptyTitle="Записей нет"
        emptyDescription="Изменения VPS появятся здесь после CRUD-операций"
      >
        {(rows) => (
          <ResourcePage
            columns={columnDefFromDataGrid(columns)}
            data={rows as AuditRow[]}
            getRowId={(r) => r.id}
            pageSize={25}
          />
        )}
      </QueryState>
    </PageShell>
  )
}
