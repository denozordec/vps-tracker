import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PlusIcon, PencilIcon, Trash2Icon, BuildingIcon } from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-table-card'
import { QueryState } from '@/components/query-state'
import { TableSkeleton } from '@/components/skeletons'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormSheet } from '@/components/form-sheet'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { Textarea } from '@cfdm/ui/components/textarea'
import { SelectField } from '@/components/select-field'
import { faviconUrlFromWebsite } from '@/lib/format'
import type { Provider, ApiType } from '@/types/entities'

export const Route = createFileRoute('/_auth/providers')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: ProvidersPage,
})

interface FormState {
  id?: string
  name: string
  website: string
  apiType: ApiType
  apiBaseUrl: string
  baseCurrency: string
  usdRate: string
  eurRate: string
  supportPhone: string
  supportUrl: string
  notes: string
}

const EMPTY: FormState = {
  name: '', website: '', apiType: 'billmanager', apiBaseUrl: '', baseCurrency: 'RUB',
  usdRate: '', eurRate: '', supportPhone: '', supportUrl: '', notes: '',
}

function ProvidersPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)

  const saveMut = useMutation({
    mutationFn: (r: FormState) => (r.id ? api.update<Provider>('providers', r.id, r as unknown as Provider) : api.create('providers', r as unknown as Provider)),
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

  const openCreate = () => { setForm(EMPTY); setOpen(true) }
  const openEdit = (p: Provider) => {
    setForm({
      id: p.id, name: p.name, website: p.website ?? '', apiType: p.apiType, apiBaseUrl: p.apiBaseUrl ?? '',
      baseCurrency: p.baseCurrency ?? 'RUB', usdRate: String(p.usdRate ?? ''), eurRate: String(p.eurRate ?? ''),
      supportPhone: p.supportPhone ?? '', supportUrl: p.supportUrl ?? '', notes: p.notes ?? '',
    })
    setOpen(true)
  }

  const columns: DataTableColumn<Provider>[] = [
    {
      key: 'name',
      header: 'Хостер',
      cell: (p) => (
        <div className="flex items-center gap-2">
          {p.website ? (
            <img src={faviconUrlFromWebsite(p.website)} alt="" className="size-4 rounded-sm" />
          ) : (
            <BuildingIcon className="size-4 text-muted-foreground" />
          )}
          <span className="font-medium">{p.name}</span>
        </div>
      ),
    },
    { key: 'api', header: 'API', cell: (p) => <Badge variant="outline">{p.apiType}</Badge> },
    { key: 'cur', header: 'Валюта', cell: (p) => <span className="tabular-nums">{p.baseCurrency ?? '—'}</span> },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)} aria-label="Редактировать">
            <PencilIcon />
          </Button>
          <ConfirmDialog
            trigger={<Button variant="ghost" size="icon-sm" aria-label="Удалить"><Trash2Icon /></Button>}
            title="Удалить хостера?"
            description={`«${p.name}» будет удалён. Аккаунты и VPS не затрагиваются, но потеряют привязку.`}
            destructive
            confirmLabel="Удалить"
            onConfirm={() => delMut.mutate(p.id)}
          />
        </div>
      ),
    },
  ]

  return (
    <PageShell>
      <PageHeader
        title="Хостеры"
        description="Провайдеры хостинга и параметры API"
        actions={<Button onClick={openCreate}><PlusIcon data-icon="inline-start" />Добавить</Button>}
      />
      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton />}
        empty={snapshot?.providers.length === 0}
        emptyTitle="Хостеры не найдены"
        emptyAction={<Button onClick={openCreate}><PlusIcon data-icon="inline-start" />Добавить хостера</Button>}
      >
        {(snap) => <DataGridCard columns={columnDefFromDataTable(columns)} data={snap.providers} rowId={(p) => p.id} pinLastColumn />}
      </QueryState>

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        trigger={null}
        title={form.id ? 'Редактировать хостера' : 'Новый хостер'}
        onSubmit={() => saveMut.mutate(form)}
        submitting={saveMut.isPending}
      >
        <FormField label="Название" htmlFor="pr-name">
          <Input id="pr-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Сайт" htmlFor="pr-site">
          <Input id="pr-site" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </FormField>
        <FormField label="Тип API" htmlFor="pr-api">
          <SelectField
            triggerId="pr-api"
            value={form.apiType}
            onValueChange={(v) => setForm({ ...form, apiType: (v ?? 'none') as ApiType })}
            options={[
              { value: 'billmanager', label: 'BILLmanager' },
              { value: 'none', label: 'Нет' },
            ]}
          />
        </FormField>
        <FormField label="API URL" htmlFor="pr-apiurl" description="Один URL на хостера для BILLmanager">
          <Input id="pr-apiurl" value={form.apiBaseUrl} onChange={(e) => setForm({ ...form, apiBaseUrl: e.target.value })} />
        </FormField>
        <div className="grid grid-cols-3 gap-3">
          <FormField label="Валюта" htmlFor="pr-cur">
            <Input id="pr-cur" value={form.baseCurrency} onChange={(e) => setForm({ ...form, baseCurrency: e.target.value })} />
          </FormField>
          <FormField label="Курс USD" htmlFor="pr-usd">
            <Input id="pr-usd" value={form.usdRate} onChange={(e) => setForm({ ...form, usdRate: e.target.value })} />
          </FormField>
          <FormField label="Курс EUR" htmlFor="pr-eur">
            <Input id="pr-eur" value={form.eurRate} onChange={(e) => setForm({ ...form, eurRate: e.target.value })} />
          </FormField>
        </div>
        <FormField label="Заметки" htmlFor="pr-notes">
          <Textarea id="pr-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </FormField>
      </FormSheet>
    </PageShell>
  )
}
