import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PlusIcon, PencilIcon, Trash2Icon, RefreshCwIcon, UserRoundIcon, KeyRoundIcon, PlugIcon, ReceiptIcon, WalletIcon } from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { PageShell } from '@/components/page-shell'
import { PageHeader } from '@/components/page-header'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-table-card'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { QueryState } from '@/components/query-state'
import { TableSkeleton } from '@/components/skeletons'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { FormSheet } from '@/components/form-sheet'
import { FormField } from '@/components/form-field'
import { Input } from '@cfdm/ui/components/input'
import { Textarea } from '@cfdm/ui/components/textarea'
import { SelectField } from '@/components/select-field'
import { LoadingButton } from '@/components/loading-button'

import type { ProviderAccount, BillingMode } from '@/types/entities'
import { providerByIdMap, accountBillmanagerUiReady } from '@/lib/billmanager'
import { billingModeLabel, formatCurrency } from '@/lib/format'

export const Route = createFileRoute('/_auth/accounts')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: AccountsPage,
})

interface FormState {
  id?: string
  providerId: string
  name: string
  login: string
  apiCredentials: string
  billingMode: BillingMode
  notes: string
}

const EMPTY: FormState = { providerId: '', name: '', login: '', apiCredentials: '', billingMode: 'monthly', notes: '' }

function AccountsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)

  const saveMut = useMutation({
    mutationFn: (r: FormState) => {
      const { apiCredentials, ...rest } = r
      const payload = apiCredentials ? { ...rest, apiCredentials } : rest
      return r.id
        ? api.update<ProviderAccount>('providerAccounts', r.id, payload as unknown as Partial<ProviderAccount>)
        : api.create('providerAccounts', payload as unknown as ProviderAccount)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Аккаунт сохранён')
      setOpen(false)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api.remove<ProviderAccount>('providerAccounts', id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Аккаунт удалён')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })
  const syncMut = useMutation({
    mutationFn: (id: string) => api.syncAccount(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Синк запущен')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка синка'),
  })

  const openCreate = () => { setForm({ ...EMPTY, providerId: snapshot?.providers[0]?.id ?? '' }); setOpen(true) }
  const openEdit = (a: ProviderAccount) => {
    setForm({
      id: a.id, providerId: a.providerId, name: a.name, login: a.login ?? '',
      apiCredentials: '', billingMode: a.billingMode ?? 'monthly', notes: a.notes ?? '',
    })
    setOpen(true)
  }

  const providerById = snapshot ? providerByIdMap(snapshot.providers) : new Map()

  const columns: DataTableColumn<ProviderAccount>[] = [
    {
      key: 'name',
      header: 'Аккаунт',
      icon: UserRoundIcon,
      cell: (a) => dataGridCellStack(a.name, providerById.get(a.providerId)?.name ?? '—'),
    },
    {
      key: 'login',
      header: 'Логин',
      icon: KeyRoundIcon,
      cell: (a) => <span className="text-muted-foreground">{a.login || '—'}</span>,
    },
    {
      key: 'creds',
      header: 'API-доступ',
      icon: PlugIcon,
      cell: (a) => <Badge variant={a.apiCredentialsSet ? 'default' : 'outline'}>{a.apiCredentialsSet ? 'установлены' : 'нет'}</Badge>,
    },
    {
      key: 'mode',
      header: 'Биллинг',
      icon: ReceiptIcon,
      cell: (a) => <span>{billingModeLabel(a.billingMode ?? 'monthly')}</span>,
    },
    {
      key: 'balance',
      header: 'Баланс (API)',
      icon: WalletIcon,
      headerClassName: 'text-right',
      className: 'text-right',
      sortValue: (a) => Number(a.balance_api ?? 0),
      cell: (a) => {
        const provider = providerById.get(a.providerId)
        if (!accountBillmanagerUiReady(a, provider)) return <span className="text-muted-foreground">—</span>
        const cur = a.balance_currency || a.currency || provider?.baseCurrency || 'USD'
        return <span className="tabular-nums font-medium">{formatCurrency(Number(a.balance_api ?? 0), cur)}</span>
      },
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      className: 'w-32 text-right',
      cell: (a) => {
        const provider = providerById.get(a.providerId)
        const canSync = accountBillmanagerUiReady(a, provider)
        return (
          <div className="flex justify-end gap-1">
            <LoadingButton
              variant="outline"
              size="sm"
              loading={syncMut.isPending && syncMut.variables === a.id}
              disabled={!canSync}
              onClick={() => syncMut.mutate(a.id)}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Синк
            </LoadingButton>
            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)} aria-label="Редактировать">
              <PencilIcon />
            </Button>
            <ConfirmDialog
              trigger={<Button variant="ghost" size="icon-sm" aria-label="Удалить"><Trash2Icon /></Button>}
              title="Удалить аккаунт?"
              description={`«${a.name}» будет удалён.`}
              destructive
              confirmLabel="Удалить"
              onConfirm={() => delMut.mutate(a.id)}
            />
          </div>
        )
      },
    },
  ]

  return (
    <PageShell>
      <PageHeader
        title="Аккаунты хостеров"
        description="Аккаунты провайдеров с API-доступом"
        actions={<Button onClick={openCreate}><PlusIcon data-icon="inline-start" />Добавить</Button>}
      />
      <QueryState
        data={snapshot}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton />}
        empty={snapshot?.providerAccounts.length === 0}
        emptyTitle="Аккаунты не найдены"
        emptyAction={<Button onClick={openCreate}><PlusIcon data-icon="inline-start" />Добавить аккаунт</Button>}
      >
        {(snap) => <DataGridCard columns={columnDefFromDataTable(columns)} data={snap.providerAccounts} rowId={(a) => a.id} pinLastColumn />}
      </QueryState>

      <FormSheet
        open={open}
        onOpenChange={setOpen}
        trigger={null}
        title={form.id ? 'Редактировать аккаунт' : 'Новый аккаунт'}
        description="API-креды хранятся на сервере и используются для синка с BILLmanager"
        onSubmit={() => saveMut.mutate(form)}
        submitting={saveMut.isPending}
      >
        <FormField label="Хостер" htmlFor="acc-provider">
          <SelectField
            triggerId="acc-provider"
            placeholder="Выберите хостера"
            value={form.providerId}
            onValueChange={(v) => setForm({ ...form, providerId: v ?? '' })}
            options={(snapshot?.providers ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
        </FormField>
        <FormField label="Название" htmlFor="acc-name">
          <Input id="acc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Логин" htmlFor="acc-login">
          <Input id="acc-login" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
        </FormField>
        <FormField
          label={form.id ? 'Новый API-пароль (необязательно)' : 'API-пароль (логин:пароль)'}
          htmlFor="acc-creds"
          description="Оставьте пустым при редактировании, чтобы сохранить существующий"
        >
          <Input id="acc-creds" type="password" value={form.apiCredentials} onChange={(e) => setForm({ ...form, apiCredentials: e.target.value })} />
        </FormField>
        <FormField label="Режим биллинга" htmlFor="acc-mode">
          <SelectField
            triggerId="acc-mode"
            value={form.billingMode}
            onValueChange={(v) => setForm({ ...form, billingMode: (v ?? 'monthly') as BillingMode })}
            options={[
              { value: 'monthly', label: billingModeLabel('monthly') },
              { value: 'daily', label: billingModeLabel('daily') },
            ]}
          />
        </FormField>
        <FormField label="Заметки" htmlFor="acc-notes">
          <Textarea id="acc-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </FormField>
      </FormSheet>
    </PageShell>
  )
}
