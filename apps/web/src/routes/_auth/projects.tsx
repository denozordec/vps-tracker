import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  PlusIcon,
  FolderKanbanIcon,
  ServerIcon,
  TrendingUpIcon,
  BarChart3Icon,
} from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { ResourcePage, columnDefFromDataGrid } from '@/components/reui-kit'
import type { DataGridColumn } from '@/components/data-grid-types'
import { CrudListPage } from '@/components/crud-list-page'
import { RowActions } from '@/components/row-actions'
import { KpiStatGrid } from '@/components/reui-kit'
import { ProjectFiltersToolbar } from '@/components/project-filters-toolbar'
import {
  applyProjectFilters,
  buildDefaultProjectFilters,
  hasActiveProjectFilters,
  type ProjectFiltersState,
} from '@/components/project-filters'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { EmptyState } from '@/components/empty-state'
import { ProjectColorDot } from '@/components/project-color-dot'
import { ProjectEditSheet, projectFormDefaults } from '@/components/domain/project-edit-sheet'
import type { ProjectFormValues } from '@/lib/schemas'
import { formatCurrency, normalizeRatesPayload } from '@/lib/format'
import {
  buildProjectRows,
  projectsOverview,
  type ProjectRow,
} from '@/lib/project-analytics'

export const Route = createFileRoute('/_auth/projects')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: ProjectsPage,
})

function ProjectsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const settings = snapshot?.settings?.[0]
  const { data: rawRates } = useQuery(ratesQueryOptions(settings?.ratesUrl))
  const ratesData = normalizeRatesPayload(rawRates) ?? rawRates ?? null
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<ProjectFiltersState>(buildDefaultProjectFilters())
  const [formDefaults, setFormDefaults] = useState<ProjectFormValues>(projectFormDefaults())

  const analyticsCtx = useMemo(
    () => ({
      providers: snapshot?.providers ?? [],
      settings: snapshot?.settings ?? [],
      ratesData,
    }),
    [snapshot, ratesData],
  )

  const saveMut = useMutation({
    mutationFn: (values: ProjectFormValues) => {
      const color = values.color?.trim() || null
      const notes = values.notes?.trim() || null
      if (values.id) {
        return api.updateProject(values.id, {
          name: values.name.trim(),
          color,
          notes,
        })
      }
      return api.createProject({
        name: values.name.trim(),
        color,
        notes,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Проект сохранён')
      setOpen(false)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Проект удалён')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const allRows = useMemo(
    () => (snapshot ? buildProjectRows(snapshot, analyticsCtx) : []),
    [snapshot, analyticsCtx],
  )

  const rows = useMemo(() => applyProjectFilters(allRows, filters), [allRows, filters])

  const overview = useMemo(
    () => (snapshot ? projectsOverview(snapshot, analyticsCtx) : null),
    [snapshot, analyticsCtx],
  )

  const baseCurrency = (settings?.baseCurrency ?? 'RUB').toUpperCase()

  const openCreate = () => {
    setFormDefaults(projectFormDefaults())
    setOpen(true)
  }

  const openEdit = (row: ProjectRow) => {
    setFormDefaults(
      projectFormDefaults({
        id: row.id,
        name: row.name,
        color: row.color ?? '',
        notes: row.notes ?? '',
      }),
    )
    setOpen(true)
  }

  const columns: DataGridColumn<ProjectRow>[] = [
    {
      key: 'name',
      header: 'Проект',
      icon: FolderKanbanIcon,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <ProjectColorDot color={row.color} />
          <Button
            variant="link"
            className="h-auto p-0 font-medium"
            render={<Link to="/projects/$projectId" params={{ projectId: row.id }} />}
          >
            {row.name}
          </Button>
        </div>
      ),
    },
    {
      key: 'vps',
      header: 'VPS',
      headerClassName: 'text-right',
      className: 'text-right tabular-nums',
      sortValue: (row) => row.vpsTotal,
      cell: (row) => (
        <Badge variant="secondary">
          {row.vpsActive}/{row.vpsTotal}
        </Badge>
      ),
    },
    {
      key: 'burn',
      header: 'Расход/мес',
      headerClassName: 'text-right',
      className: 'text-right tabular-nums',
      sortValue: (row) => row.monthlyBurn,
      cell: (row) => formatCurrency(row.monthlyBurn, baseCurrency),
    },
    {
      key: 'resources',
      header: 'Ресурсы',
      className: 'text-muted-foreground text-sm tabular-nums',
      sortValue: (row) => row.vcpu,
      cell: (row) => `${row.vcpu} vCPU · ${row.ramGb} GB · ${row.diskGb} GB`,
    },
    {
      key: 'notes',
      header: 'Заметки',
      className: 'max-w-48 truncate text-muted-foreground',
      cell: (row) => row.notes?.trim() || '—',
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      className: 'w-24 text-right',
      cell: (row) => (
        <RowActions
          onEdit={() => openEdit(row)}
          onDelete={() => {
            if (row.vpsTotal > 0) {
              toast.error(`Нельзя удалить: к проекту привязано ${row.vpsTotal} VPS`)
              return
            }
            delMut.mutate(row.id)
          }}
          deleteTitle="Удалить проект?"
          deleteDescription={`«${row.name}» будет удалён.`}
        />
      ),
    },
  ]

  return (
    <CrudListPage
      title="Проекты"
      description="Группировка VPS, расходы и ресурсы по проектам"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" render={<Link to="/reports" />}>
            <BarChart3Icon data-icon="inline-start" />
            Отчёты
          </Button>
          <Button onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Добавить
          </Button>
        </div>
      }
      data={snapshot}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      empty={allRows.length === 0}
      emptyTitle="Проектов нет"
      emptyDescription="Создайте проект или назначьте его при редактировании VPS"
      emptyAction={
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Создать проект
        </Button>
      }
      sheet={
        <ProjectEditSheet
          open={open}
          onOpenChange={setOpen}
          defaultValues={formDefaults}
          onSubmit={(values) => saveMut.mutate(values)}
          submitting={saveMut.isPending}
        />
      }
    >
      {() => (
        <div className="flex flex-col gap-4">
          {overview ? (
            <KpiStatGrid
              items={[
                {
                  label: 'Проектов',
                  value: overview.projectCount,
                  icon: <FolderKanbanIcon className="size-4" />,
                },
                {
                  label: 'VPS в проектах',
                  value: overview.vpsInProjects,
                  icon: <ServerIcon className="size-4" />,
                  hint:
                    overview.vpsUnassigned > 0
                      ? `${overview.vpsUnassigned} без проекта`
                      : undefined,
                },
                {
                  label: 'Расход/мес',
                  value: formatCurrency(overview.monthlyBurnInProjects, baseCurrency),
                  icon: <TrendingUpIcon className="size-4" />,
                  hint: `в ${baseCurrency}`,
                },
                {
                  label: 'Активных VPS',
                  value: overview.activeInProjects,
                  icon: <ServerIcon className="size-4" />,
                  hint: 'в проектах',
                },
              ]}
            />
          ) : null}
          <ProjectFiltersToolbar
            filters={filters}
            onChange={setFilters}
            shownCount={rows.length}
            totalCount={allRows.length}
          />
          {rows.length === 0 && hasActiveProjectFilters(filters) ? (
            <EmptyState
              title="Ничего не найдено"
              description="Измените фильтры или сбросьте их"
              action={
                <Button variant="outline" onClick={() => setFilters(buildDefaultProjectFilters())}>
                  Сбросить фильтры
                </Button>
              }
            />
          ) : (
            <ResourcePage
              columns={columnDefFromDataGrid(columns)}
              data={rows}
              getRowId={(r) => r.id}
              pinLastColumn
            />
          )}
        </div>
      )}
    </CrudListPage>
  )
}
