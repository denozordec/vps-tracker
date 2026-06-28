import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  PlusIcon,
  RefreshCwIcon,
  UserRoundIcon,
  KeyRoundIcon,
  PlugIcon,
  ReceiptIcon,
  WalletIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-grid-types'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { CrudListPage } from '@/components/crud-list-page'
import { RowActions } from '@/components/row-actions'
import {
  ProviderAccountEditSheet,
  providerAccountFormDefaults,
} from '@/components/domain/account-edit-sheet'
import type { ProviderAccountFormValues } from '@/lib/schemas'
import { accountBalanceApi, accountBalanceCurrency } from '@/lib/account'
import type { ProviderAccount } from '@/types/entities'
import { providerByIdMap, accountBillmanagerUiReady, billmanagerSyncableAccounts } from '@/lib/billmanager'
import { billingModeLabel, formatCurrency } from '@/lib/format'

export const Route = createFileRoute('/_auth/accounts')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: AccountsPage,
})

function AccountsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const [open, setOpen] = useState(false)
  const [formDefaults, setFormDefaults] = useState<ProviderAccountFormValues>(
    providerAccountFormDefaults(null, snapshot?.providers[0]?.id ?? ''),
  )

  const saveMut = useMutation({
    mutationFn: (r: ProviderAccountFormValues) => {
      const { apiCredentials, balanceAlertBelow, ...rest } = r
      const alertRaw = balanceAlertBelow === '' || balanceAlertBelow == null ? '' : String(balanceAlertBelow)
      const alertNum = alertRaw ? Number(alertRaw) : null
      const base = {
        ...rest,
        balanceAlertBelow: Number.isFinite(alertNum) ? alertNum : null,
      }
      const payload = apiCredentials ? { ...base, apiCredentials } : base
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
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      const synced = (data as { synced?: { vpsCount?: number; paymentsCount?: number; tariffsCount?: number } })
        ?.synced
      const parts: string[] = []
      if (synced?.vpsCount != null) parts.push(`VPS ${synced.vpsCount}`)
      if (synced?.paymentsCount) parts.push(`платежи ${synced.paymentsCount}`)
      if (synced?.tariffsCount) parts.push(`тарифы ${synced.tariffsCount}`)
      toast.success(parts.length ? `Синк: ${parts.join(', ')}` : 'Синк завершён')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка синка'),
  })
  const syncAllMut = useMutation({
    mutationFn: async () => {
      if (!snapshot) return
      const accounts = billmanagerSyncableAccounts(snapshot.providerAccounts, snapshot.providers)
      for (const a of accounts) {
        await api.syncAccount(a.id)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Синхронизация всех аккаунтов завершена')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка синка'),
  })

  const openCreate = () => {
    setFormDefaults(providerAccountFormDefaults(null, snapshot?.providers[0]?.id ?? ''))
    setOpen(true)
  }
  const openEdit = (a: ProviderAccount) => {
    const ext = a as ProviderAccount & { balanceAlertBelow?: number | null }
    setFormDefaults(
      providerAccountFormDefaults({
        id: a.id,
        providerId: a.providerId,
        name: a.name,
        login: a.login ?? '',
        apiCredentials: '',
        billingMode: a.billingMode ?? 'monthly',
        balanceAlertBelow: ext.balanceAlertBelow != null ? ext.balanceAlertBelow : '',
        notes: a.notes ?? '',
      }),
    )
    setOpen(true)
  }

  const providerById = snapshot ? providerByIdMap(snapshot.providers) : new Map()
  const syncableCount = snapshot
    ? billmanagerSyncableAccounts(snapshot.providerAccounts, snapshot.providers).length
    : 0

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
      cell: (a) => (
        <Badge variant={a.apiCredentialsSet ? 'default' : 'outline'}>
          {a.apiCredentialsSet ? 'установлены' : 'нет'}
        </Badge>
      ),
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
      sortValue: (a) => accountBalanceApi(a) ?? 0,
      cell: (a) => {
        const provider = providerById.get(a.providerId)
        if (!accountBillmanagerUiReady(a, provider)) return <span className="text-muted-foreground">—</span>
        const cur = accountBalanceCurrency(a)
        const ext = a as ProviderAccount & { enoughmoneyto?: string }
        return dataGridCellStack(
          formatCurrency(accountBalanceApi(a) ?? 0, cur),
          ext.enoughmoneyto ? `до ${ext.enoughmoneyto}` : undefined,
        )
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
          <RowActions
            onEdit={() => openEdit(a)}
            onDelete={() => delMut.mutate(a.id)}
            deleteTitle="Удалить аккаунт?"
            deleteDescription={`«${a.name}» будет удалён.`}
            extra={
              canSync ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Синхронизировать"
                  disabled={syncMut.isPending && syncMut.variables === a.id}
                  onClick={() => syncMut.mutate(a.id)}
                >
                  <RefreshCwIcon />
                </Button>
              ) : null
            }
          />
        )
      },
    },
  ]

  return (
    <CrudListPage
      title="Аккаунты хостеров"
      description="Аккаунты провайдеров с API-доступом"
      actions={
        <div className="flex flex-wrap gap-2">
          {syncableCount > 0 ? (
            <Button variant="outline" disabled={syncAllMut.isPending} onClick={() => syncAllMut.mutate()}>
              <RefreshCwIcon data-icon="inline-start" />
              Синхронизировать все
            </Button>
          ) : null}
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
      empty={snapshot?.providerAccounts.length === 0}
      emptyTitle="Аккаунты не найдены"
      emptyDescription="Добавьте аккаунт хостера для синхронизации VPS и платежей"
      emptyAction={
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Добавить аккаунт
        </Button>
      }
      sheet={
        snapshot ? (
          <ProviderAccountEditSheet
            open={open}
            onOpenChange={setOpen}
            defaultValues={formDefaults}
            providers={snapshot.providers}
            onSubmit={(values) => saveMut.mutate(values)}
            submitting={saveMut.isPending}
          />
        ) : null
      }
    >
      {(snap) => (
        <DataGridCard
          columns={columnDefFromDataTable(columns)}
          data={snap.providerAccounts}
          rowId={(a) => a.id}
          pinLastColumn
        />
      )}
    </CrudListPage>
  )
}
