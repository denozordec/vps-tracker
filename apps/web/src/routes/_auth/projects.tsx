import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PlusIcon, FolderKanbanIcon } from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { ApiError } from '@/lib/api-client'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-grid-types'
import { QueryState } from '@/components/query-state'
import { TableSkeleton } from '@/components/skeletons'
import { Button } from '@cfdm/ui/components/button'
import { FormSheet } from '@/components/form-sheet'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'

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
  const [name, setName] = useState('')

  const createMut = useMutation({
    mutationFn: (projectName: string) =>
      fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName }),
      }).then(async (res) => {
        if (!res.ok) throw new ApiError(await res.text(), res.status)
        return res.json()
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Проект создан')
      setOpen(false)
      setName('')
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
    <PageShell>
      <PageHeader
        title="Проекты"
        description="Группировка VPS по проектам"
        actions={
          <Button onClick={() => setOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Добавить
          </Button>
        }
      />
      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton />}
        empty={rows.length === 0}
        emptyTitle="Проектов нет"
        emptyDescription="Создайте проект или назначьте его при редактировании VPS"
        emptyAction={
          <Button onClick={() => setOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Создать проект
          </Button>
        }
      >
        {() => (
          <DataGridCard
            columns={columnDefFromDataTable(columns)}
            data={rows}
            rowId={(r) => r.id}
            dense
          />
        )}
      </QueryState>

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        trigger={null}
        title="Новый проект"
        description="Имя будет доступно в автодополнении на форме VPS"
        onSubmit={() => createMut.mutate(name.trim())}
        submitting={createMut.isPending}
        submitDisabled={!name.trim()}
      >
        <FormField label="Название" htmlFor="project-name">
          <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
      </FormSheet>
    </PageShell>
  )
}
