import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  ArrowLeftIcon,
  BarChart3Icon,
  CpuIcon,
  PencilIcon,
  ServerIcon,
  TrendingUpIcon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { QueryState } from '@/components/query-state'
import { KpiStatGrid } from '@/components/reui-kit'
import { EmptyState } from '@/components/empty-state'
import { ResourcePage, columnDefFromDataGrid } from '@/components/reui-kit'
import type { DataGridColumn } from '@/components/data-grid-types'
import { StatusBadge } from '@/components/status-badge'
import { ProjectEditSheet, projectFormDefaults } from '@/components/domain/project-edit-sheet'
import type { ProjectFormValues } from '@/lib/schemas'
import { Button } from '@cfdm/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@cfdm/ui/components/card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { KpiStatGridSkeleton, TableSkeleton } from '@/components/skeletons'
import {
  formatCurrency,
  normalizeRatesPayload,
  vpsTariffRateAmount,
} from '@/lib/format'
import { getPaidUntilDate } from '@/lib/paid-until'
import {
  findProject,
  latestPaymentDate,
  paymentsForVpsIds,
  projectVpsList,
  sumVpsMonthlyBurn,
  sumVpsResources,
} from '@/lib/project-analytics'
import type { Vps } from '@/types/entities'

export const Route = createFileRoute('/_auth/projects/$projectId')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: ProjectDetailPage,
})

function formatDisplayDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('ru-RU')
}

function ProjectDetailPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const settings = snapshot?.settings?.[0]
  const { data: rawRates } = useQuery(ratesQueryOptions(settings?.ratesUrl))
  const ratesData = normalizeRatesPayload(rawRates) ?? rawRates ?? null
  const [editOpen, setEditOpen] = useState(false)

  const project = snapshot ? findProject(snapshot, projectId) : undefined
  const projectVps = useMemo(
    () => (snapshot ? projectVpsList(snapshot, projectId) : []),
    [snapshot, projectId],
  )
  const activeVps = useMemo(
    () => projectVps.filter((v) => v.status === 'active'),
    [projectVps],
  )

  const analyticsCtx = useMemo(
    () => ({
      providers: snapshot?.providers ?? [],
      settings: snapshot?.settings ?? [],
      ratesData,
    }),
    [snapshot, ratesData],
  )

  const resources = useMemo(() => sumVpsResources(activeVps), [activeVps])
  const monthlyBurn = useMemo(
    () => sumVpsMonthlyBurn(activeVps, analyticsCtx),
    [activeVps, analyticsCtx],
  )

  const lastPaymentDate = useMemo(() => {
    if (!snapshot) return null
    const ids = new Set(projectVps.map((v) => v.id))
    return latestPaymentDate(paymentsForVpsIds(snapshot.payments, ids))
  }, [snapshot, projectVps])

  const baseCurrency = (settings?.baseCurrency ?? 'RUB').toUpperCase()

  const saveMut = useMutation({
    mutationFn: (values: ProjectFormValues) => {
      const color = values.color?.trim() || null
      const notes = values.notes?.trim() || null
      return api.updateProject(values.id!, {
        name: values.name.trim(),
        color,
        notes,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Проект сохранён')
      setEditOpen(false)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const delMut = useMutation({
    mutationFn: () => api.deleteProject(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Проект удалён')
      void navigate({ to: '/projects' })
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const columns: DataGridColumn<Vps>[] = [
    {
      key: 'ip',
      header: 'IP',
      cell: (v) => (
        <Button
          variant="link"
          className="h-auto p-0 font-medium"
          render={<Link to="/vps/$vpsId" params={{ vpsId: v.id }} />}
        >
          {v.ip || v.id}
        </Button>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      cell: (v) => <StatusBadge status={v.status} />,
    },
    {
      key: 'rate',
      header: 'Тариф',
      headerClassName: 'text-right',
      className: 'text-right tabular-nums',
      sortValue: (v) => vpsTariffRateAmount(v) ?? 0,
      cell: (v) => formatCurrency(vpsTariffRateAmount(v) ?? 0, v.currency),
    },
    {
      key: 'paidUntil',
      header: 'Оплачено до',
      cell: (v) => {
        if (!snapshot) return '—'
        const paid = getPaidUntilDate(v, {
          vps: snapshot.vps,
          providerAccounts: snapshot.providerAccounts,
          payments: snapshot.payments,
          balanceLedger: snapshot.balanceLedger,
        })
        return paid ? formatDisplayDate(paid) : '—'
      },
    },
  ]

  return (
    <PageShell>
      <PageHeader
        title={project?.name ?? 'Проект'}
        description={
          project?.notes?.trim()
            ? project.notes.length > 120
              ? `${project.notes.slice(0, 120)}…`
              : project.notes
            : 'Карточка проекта'
        }
        actions={
          project ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" render={<Link to="/projects" />}>
                <ArrowLeftIcon data-icon="inline-start" />
                К списку
              </Button>
              <Button
                variant="outline"
                render={
                  <Link to="/reports" search={{ project: project.name }} />
                }
              >
                <BarChart3Icon data-icon="inline-start" />
                Отчёт
              </Button>
              <Button
                variant="outline"
                render={
                  <Link to="/vps" search={{ project: project.name }} />
                }
              >
                <ServerIcon data-icon="inline-start" />
                VPS
              </Button>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <PencilIcon data-icon="inline-start" />
                Изменить
              </Button>
              {projectVps.length > 0 ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    toast.error(`Нельзя удалить: к проекту привязано ${projectVps.length} VPS`)
                  }
                >
                  <Trash2Icon data-icon="inline-start" />
                  Удалить
                </Button>
              ) : (
                <ConfirmDialog
                  title="Удалить проект?"
                  description={`«${project.name}» будет удалён без возможности восстановления.`}
                  confirmLabel="Удалить"
                  destructive
                  onConfirm={() => delMut.mutate()}
                  trigger={
                    <Button variant="outline" disabled={delMut.isPending}>
                      <Trash2Icon data-icon="inline-start" />
                      Удалить
                    </Button>
                  }
                />
              )}
            </div>
          ) : null
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
            <KpiStatGridSkeleton count={3} />
            <TableSkeleton />
          </div>
        }
      >
        {() =>
          !project ? (
            <EmptyState
              title="Проект не найден"
              description="Возможно, он был удалён"
              action={
                <Button variant="outline" render={<Link to="/projects" />}>
                  К списку проектов
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              <KpiStatGrid
                items={[
                  {
                    label: 'Активных VPS',
                    value: activeVps.length,
                    icon: <ServerIcon className="size-4" />,
                    hint: `из ${projectVps.length}`,
                  },
                  {
                    label: 'Расход/мес',
                    value: formatCurrency(monthlyBurn, baseCurrency),
                    icon: <TrendingUpIcon className="size-4" />,
                    hint: `в ${baseCurrency}`,
                  },
                  {
                    label: 'vCPU / RAM / Disk',
                    value: `${resources.vcpu} / ${resources.ramGb} / ${resources.diskGb}`,
                    icon: <CpuIcon className="size-4" />,
                    hint: 'активные VPS',
                  },
                  {
                    label: 'Последний платёж',
                    value: lastPaymentDate ? formatDisplayDate(lastPaymentDate) : '—',
                    icon: <TrendingUpIcon className="size-4" />,
                  },
                ]}
              />
              {project.notes?.trim() ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Заметки</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{project.notes}</p>
                  </CardContent>
                </Card>
              ) : null}
              <ResourcePage
                title="VPS проекта"
                description={`${projectVps.length} серверов`}
                columns={columnDefFromDataGrid(columns)}
                data={projectVps}
                getRowId={(v) => v.id}
                emptyTitle="VPS не назначены"
                emptyDescription="Назначьте проект при редактировании VPS"
              />
              <ProjectEditSheet
                open={editOpen}
                onOpenChange={setEditOpen}
                defaultValues={projectFormDefaults({
                  id: project.id,
                  name: project.name,
                  color: project.color ?? '',
                  notes: project.notes ?? '',
                })}
                onSubmit={(values) => saveMut.mutate(values)}
                submitting={saveMut.isPending}
              />
            </div>
          )
        }
      </QueryState>
    </PageShell>
  )
}
