import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PlusIcon, FolderKanbanIcon } from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-grid-types'
import { CrudListPage } from '@/components/crud-list-page'
import { Button } from '@cfdm/ui/components/button'
import { ProjectEditSheet } from '@/components/domain/project-edit-sheet'
import type { ProjectFormValues } from '@/lib/schemas'

interface ProjectRow {
  id: string
  name: string
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

  const createMut = useMutation({
    mutationFn: (values: ProjectFormValues) => api.createProject(values.name.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Проект создан')
      setOpen(false)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const rows: ProjectRow[] = (snapshot?.serverProjects ?? []).map((p) => {
    const row = p as { id: string; name: string }
    const vpsCount = (snapshot?.vps ?? []).filter((v) => v.project === row.name).length
    return { id: row.id, name: row.name, vpsCount }
  })

  const columns: DataTableColumn<ProjectRow>[] = [
    {
      key: 'name',
      header: 'Проект',
      icon: FolderKanbanIcon,
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'vps',
      header: 'VPS',
      headerClassName: 'text-right',
      className: 'text-right tabular-nums',
      sortValue: (row) => row.vpsCount,
      cell: (row) => row.vpsCount,
    },
  ]

  return (
    <CrudListPage
      title="Проекты"
      description="Группировка VPS по проектам"
      actions={
        <Button onClick={() => setOpen(true)}>
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
        <Button onClick={() => setOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Создать проект
        </Button>
      }
      sheet={
        <ProjectEditSheet
          open={open}
          onOpenChange={setOpen}
          onSubmit={(values) => createMut.mutate(values)}
          submitting={createMut.isPending}
        />
      }
    >
      {() => (
        <DataGridCard
          columns={columnDefFromDataTable(columns)}
          data={rows}
          rowId={(r) => r.id}
        />
      )}
    </CrudListPage>
  )
}
