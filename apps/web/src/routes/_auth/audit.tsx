import { useMemo } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { HistoryIcon, UserRoundIcon } from 'lucide-react'
import { z } from 'zod'

import { api } from '@/lib/api-client'
import { snapshotQueryOptions } from '@/queries/snapshot'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { QueryState } from '@/components/query-state'
import { ResourcePage, columnDefFromDataGrid } from '@/components/reui-kit'
import type { DataGridColumn } from '@/components/data-grid-types'
import { AuditTimeline, type AuditRow } from '@/components/domain/audit-timeline'
import { AuditViewToggle, type AuditViewMode } from '@/components/domain/audit-view-toggle'
import {
  ACTION_LABELS,
  auditActionBadgeVariant,
  auditActionLabel,
  auditEntityLabel,
  auditEntityTitle,
  diffPreview,
  type AuditEntityLookup,
} from '@/components/domain/audit-labels'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@/components/reui/badge'
import { Tabs, TabsList, TabsTrigger } from '@cfdm/ui/components/tabs'
import { TableSkeleton } from '@/components/skeletons'

const auditSearchSchema = z.object({
  view: z.enum(['timeline', 'table']).optional(),
  action: z.enum(['all', 'create', 'update', 'delete']).optional(),
})

type AuditActionFilter = 'all' | 'create' | 'update' | 'delete'

const ACTION_FILTERS: { value: AuditActionFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'create', label: ACTION_LABELS.create },
  { value: 'update', label: ACTION_LABELS.update },
  { value: 'delete', label: ACTION_LABELS.delete },
]

export const Route = createFileRoute('/_auth/audit')({
  validateSearch: (search) => auditSearchSchema.parse(search),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: AuditPage,
})

function AuditPage() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const view: AuditViewMode = search.view === 'table' ? 'table' : 'timeline'
  const actionFilter: AuditActionFilter = search.action ?? 'all'

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audit'],
    queryFn: () => api.fetchAuditLog(200) as Promise<AuditRow[]>,
  })
  const { data: snapshot } = useQuery(snapshotQueryOptions())

  const entityLookup = useMemo<AuditEntityLookup>(() => {
    const vps = new Map(
      (snapshot?.vps ?? []).map((v) => [v.id, { dns: v.dns, ip: v.ip }] as const),
    )
    const provider = new Map(
      (snapshot?.providers ?? []).map((p) => [p.id, { name: p.name }] as const),
    )
    const providerAccount = new Map(
      (snapshot?.providerAccounts ?? []).map((a) => [a.id, { name: a.name }] as const),
    )
    const serverProject = new Map(
      (snapshot?.serverProjects ?? []).map((p) => [p.id, { name: p.name }] as const),
    )
    return { vps, provider, providerAccount, serverProject }
  }, [snapshot])

  const filtered = useMemo(() => {
    const rows = data ?? []
    if (actionFilter === 'all') return rows
    return rows.filter((r) => r.action === actionFilter)
  }, [actionFilter, data])

  const actionCounts = useMemo(() => {
    const rows = data ?? []
    const counts: Record<AuditActionFilter, number> = {
      all: rows.length,
      create: 0,
      update: 0,
      delete: 0,
    }
    for (const r of rows) {
      if (r.action === 'create' || r.action === 'update' || r.action === 'delete') {
        counts[r.action] += 1
      }
    }
    return counts
  }, [data])

  const setView = (next: AuditViewMode) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        view: next === 'timeline' ? undefined : next,
      }),
    })
  }

  const setActionFilter = (next: string) => {
    if (next !== 'all' && next !== 'create' && next !== 'update' && next !== 'delete') return
    void navigate({
      search: (prev) => ({
        ...prev,
        action: next === 'all' ? undefined : next,
      }),
    })
  }

  const columns: DataGridColumn<AuditRow>[] = [
    {
      key: 'createdAt',
      header: 'Время',
      icon: HistoryIcon,
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <span className="text-muted-foreground tabular-nums">
          {new Date(r.createdAt).toLocaleString('ru-RU')}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Действие',
      cell: (r) => (
        <Badge variant={auditActionBadgeVariant(r.action)} size="sm">
          {auditActionLabel(r.action)}
        </Badge>
      ),
    },
    {
      key: 'entity',
      header: 'Сущность',
      cell: (r) => <Badge variant="outline">{auditEntityLabel(r.entity)}</Badge>,
    },
    {
      key: 'entityId',
      header: 'Объект',
      sortValue: (r) => auditEntityTitle(r.entity, r.entityId, r.diff, entityLookup),
      cell: (r) => {
        const title = auditEntityTitle(r.entity, r.entityId, r.diff, entityLookup)
        if (r.entity === 'vps') {
          return (
            <Button
              variant="link"
              className="h-auto max-w-full truncate p-0 text-sm font-medium"
              title={r.entityId}
              render={<Link to="/vps/$vpsId" params={{ vpsId: r.entityId }} />}
            >
              {title}
            </Button>
          )
        }
        return (
          <span className="truncate text-sm font-medium" title={r.entityId}>
            {title}
          </span>
        )
      },
    },
    {
      key: 'actor',
      header: 'Актор',
      icon: UserRoundIcon,
      sortValue: (r) => r.actorUserId ?? '',
      cell: (r) => (
        <span className="text-muted-foreground text-sm">{r.actorUserId?.trim() || 'система'}</span>
      ),
    },
    {
      key: 'diff',
      header: 'Изменения',
      sortable: false,
      cell: (r) => (
        <span className="text-muted-foreground max-w-md truncate text-xs" title={diffPreview(r.diff, 8)}>
          {diffPreview(r.diff)}
        </span>
      ),
    },
  ]

  return (
    <PageShell>
      <PageHeader
        title="Журнал изменений"
        description="История ручных правок через API"
        actions={<AuditViewToggle view={view} onViewChange={setView} />}
      />

      <Tabs value={actionFilter} onValueChange={setActionFilter}>
        <TabsList variant="line" aria-label="Фильтр по действию" className="gap-5">
          {ACTION_FILTERS.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className="text-muted-foreground hover:text-foreground h-auto gap-2 px-0 pb-3"
            >
              <span>{option.label}</span>
              <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px] tabular-nums">
                {actionCounts[option.value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <QueryState
        data={data}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton />}
        empty={!data?.length}
        emptyTitle="Записей нет"
        emptyDescription="Изменения появятся здесь после CRUD-операций"
      >
        {() => {
          if (filtered.length === 0) {
            return (
              <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center text-sm">
                <p>Нет записей для фильтра «{ACTION_LABELS[actionFilter] ?? actionFilter}»</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setActionFilter('all')}>
                  Сбросить фильтр
                </Button>
              </div>
            )
          }

          if (view === 'table') {
            return (
              <ResourcePage
                columns={columnDefFromDataGrid(columns)}
                data={filtered}
                getRowId={(r) => r.id}
                pageSize={25}
                dense
              />
            )
          }

          return <AuditTimeline rows={filtered} entityLookup={entityLookup} />
        }}
      </QueryState>
    </PageShell>
  )
}
