import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { PlusIcon, FolderKanbanIcon } from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-grid-types'
import { CrudListPage } from '@/components/crud-list-page'
import { RowActions } from '@/components/row-actions'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { ProjectEditSheet, projectFormDefaults } from '@/components/domain/project-edit-sheet'
import type { ProjectFormValues } from '@/lib/schemas'

interface ProjectRow {
  id: string
  name: string
  color?: string | null
  vpsCount: number
}

export const Route = createFileRoute('/_auth/projects')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: ProjectsPage,
})

function ProjectsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const [open, setOpen] = useState(false)
  const [formDefaults, setFormDefaults] = useState<ProjectFormValues>(projectFormDefaults())

  const saveMut = useMutation({
    mutationFn: (values: ProjectFormValues) => {
      const color = values.color?.trim() || null
      if (values.id) {
        return api.updateProject(values.id, { name: values.name.trim(), color })
      }
      return api.createProject(values.name.trim())
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

  const rows: ProjectRow[] = useMemo(
    () =>
      (snapshot?.serverProjects ?? []).map((p) => {
        const row = p as { id: string; name: string; color?: string | null }
        const vpsCount = (snapshot?.vps ?? []).filter((v) => v.project === row.name).length
        return { id: row.id, name: row.name, color: row.color, vpsCount }
      }),
    [snapshot],
  )

  const openCreate = () => {
    setFormDefaults(projectFormDefaults())
    setOpen(true)
  }

  const openEdit = (row: ProjectRow) => {
    setFormDefaults(projectFormDefaults({ id: row.id, name: row.name, color: row.color ?? '' }))
    setOpen(true)
  }

  const columns: DataTableColumn<ProjectRow>[] = [
    {
      key: 'name',
      header: 'Проект',
      icon: FolderKanbanIcon,
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.color ? (
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
          ) : null}
          <Button
            variant="link"
            className="h-auto p-0 font-medium"
            render={<Link to="/vps" search={{ project: row.name }} />}
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
      sortValue: (row) => row.vpsCount,
      cell: (row) => (
        <Badge variant="secondary">{row.vpsCount}</Badge>
      ),
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
            if (row.vpsCount > 0) {
              toast.error(`Нельзя удалить: к проекту привязано ${row.vpsCount} VPS`)
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
      description="Группировка VPS по проектам"
      actions={
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Добавить
        </Button>
      }
      data={snapshot}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      empty={rows.length === 0}
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
        <DataGridCard
          columns={columnDefFromDataTable(columns)}
          data={rows}
          rowId={(r) => r.id}
          pinLastColumn
        />
      )}
    </CrudListPage>
  )
}
