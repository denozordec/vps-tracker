import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PlusIcon, BuildingIcon, PlugIcon, CircleDollarSignIcon } from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { ResourcePage, columnDefFromDataGrid } from '@/components/reui-kit'
import type { DataGridColumn } from '@/components/data-grid-types'
import { dataGridCellWithIcon } from '@/components/data-grid-cells'
import { CrudListPage } from '@/components/crud-list-page'
import { RowActions } from '@/components/row-actions'
import { ProviderEditSheet, providerFormDefaults } from '@/components/domain/provider-edit-sheet'
import type { ProviderFormValues } from '@/lib/schemas'
import { faviconUrlFromWebsite } from '@/lib/format'
import type { Provider } from '@/types/entities'

export const Route = createFileRoute('/_auth/providers')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: ProvidersPage,
})

function ProvidersPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const [open, setOpen] = useState(false)
  const [formDefaults, setFormDefaults] = useState<ProviderFormValues>(providerFormDefaults())

  const saveMut = useMutation({
    mutationFn: (r: ProviderFormValues) =>
      r.id
        ? api.update<Provider>('providers', r.id, r as unknown as Provider)
        : api.create('providers', r as unknown as Provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Хостер сохранён')
      setOpen(false)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api.remove<Provider>('providers', id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Хостер удалён')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const openCreate = () => {
    setFormDefaults(providerFormDefaults())
    setOpen(true)
  }
  const openEdit = (p: Provider) => {
    setFormDefaults(
      providerFormDefaults({
        id: p.id,
        name: p.name,
        website: p.website ?? '',
        apiType: p.apiType,
        apiBaseUrl: p.apiBaseUrl ?? '',
        baseCurrency: p.baseCurrency ?? 'RUB',
        usdRate: String(p.usdRate ?? ''),
        eurRate: String(p.eurRate ?? ''),
        supportPhone: p.supportPhone ?? '',
        supportUrl: p.supportUrl ?? '',
        notes: p.notes ?? '',
      }),
    )
    setOpen(true)
  }

  const columns: DataGridColumn<Provider>[] = [
    {
      key: 'name',
      header: 'Хостер',
      icon: BuildingIcon,
      cell: (p) => {
        const icon = p.website ? (
          <img src={faviconUrlFromWebsite(p.website)} alt="" className="size-4 rounded-sm" />
        ) : (
          <BuildingIcon />
        )
        return dataGridCellWithIcon(icon, <span className="font-medium">{p.name}</span>)
      },
    },
    {
      key: 'api',
      header: 'API',
      icon: PlugIcon,
      cell: (p) => <Badge variant="outline">{p.apiType}</Badge>,
    },
    {
      key: 'cur',
      header: 'Валюта',
      icon: CircleDollarSignIcon,
      cell: (p) => <span className="tabular-nums">{p.baseCurrency ?? '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      className: 'w-24 text-right',
      cell: (p) => (
        <RowActions
          onEdit={() => openEdit(p)}
          onDelete={() => delMut.mutate(p.id)}
          deleteTitle="Удалить хостера?"
          deleteDescription={`«${p.name}» будет удалён. Аккаунты и VPS не затрагиваются, но потеряют привязку.`}
        />
      ),
    },
  ]

  return (
    <CrudListPage
      title="Хостеры"
      description="Провайдеры хостинга и параметры API"
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
      empty={snapshot?.providers.length === 0}
      emptyTitle="Хостеры не найдены"
      emptyDescription="Добавьте первого хостера для учёта VPS и синхронизации"
      emptyAction={
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Добавить хостера
        </Button>
      }
      sheet={
        <ProviderEditSheet
          open={open}
          onOpenChange={setOpen}
          defaultValues={formDefaults}
          onSubmit={(values) => saveMut.mutate(values)}
          submitting={saveMut.isPending}
        />
      }
    >
      {(snap) => (
        <ResourcePage
          columns={columnDefFromDataGrid(columns)}
          data={snap.providers}
          getRowId={(p) => p.id}
          pinLastColumn
        />
      )}
    </CrudListPage>
  )
}
