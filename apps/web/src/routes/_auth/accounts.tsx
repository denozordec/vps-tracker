import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  PlusIcon,
  RefreshCwIcon,
  UserRoundIcon,
  KeyRoundIcon,
  PlugIcon,
  ReceiptIcon,
  WalletIcon,
  ActivityIcon,
  ClockIcon,
  ServerIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { buildApiCredentials } from '@cfdm/shared/utils/api-credentials'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { DataGridCard, columnDefFromDataGrid } from '@/components/data-grid-card'
import type { DataGridColumn } from '@/components/data-grid-types'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { CrudListPage } from '@/components/crud-list-page'
import { RowActions } from '@/components/row-actions'
import { HealthModeBanner } from '@/components/health-mode-banner'
import { SectionCards } from '@/components/section-cards'
import {
  ProviderAccountEditSheet,
  providerAccountFormDefaults,
} from '@/components/domain/account-edit-sheet'
import type { ProviderAccountFormValues } from '@/lib/schemas'
import { accountBalanceApi, accountBalanceCurrency } from '@/lib/account'
import type { ProviderAccount } from '@/types/entities'
import { providerByIdMap, accountBillmanagerUiReady, billmanagerSyncableAccounts } from '@/lib/billmanager'
import { billingModeLabel, formatCurrency, formatRelativeTime } from '@/lib/format'
import {
  getBalanceMismatchAccountIds,
  getStaleSyncAccountIds,
  lastOkSyncFinishedAt,
} from '@/lib/inventory-health'
import {
  ACCOUNT_HEALTH_LABELS,
  buildAtRiskAccounts,
  countAccountsWithIssues,
  countLowBalanceAccounts,
  getAccountHealthFlags,
  type AccountHealthFlag,
} from '@/lib/account-health'
import {
  applyAccountFilters,
  buildDefaultAccountFilters,
  hasActiveAccountFilters,
  matchesAccountFilterPreset,
  type AccountFiltersState,
} from '@/components/account-filters'
import { AccountFiltersToolbar } from '@/components/account-filters-toolbar'

const accountsSearchSchema = z.object({
  health: z.string().optional(),
})

const HEALTH_BADGE_VARIANT: Record<AccountHealthFlag, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  'stale-sync': 'secondary',
  'low-balance': 'destructive',
  'balance-mismatch': 'outline',
  'no-creds': 'outline',
}

export const Route = createFileRoute('/_auth/accounts')({
  validateSearch: (search) => accountsSearchSchema.parse(search),
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: AccountsPage,
})

function buildSavePayload(r: ProviderAccountFormValues) {
  const { apiLogin, apiPassword, balanceAlertBelow, ...rest } = r
  const alertRaw = balanceAlertBelow === '' || balanceAlertBelow == null ? '' : String(balanceAlertBelow)
  const alertNum = alertRaw ? Number(alertRaw) : null
  const base = {
    ...rest,
    balanceAlertBelow: Number.isFinite(alertNum) ? alertNum : null,
  }
  const creds = buildApiCredentials(apiLogin ?? '', apiPassword ?? '')
  return creds ? { ...base, apiCredentials: creds } : base
}

function AccountsPage() {
  const { health } = Route.useSearch()
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<AccountFiltersState>(buildDefaultAccountFilters())
  const [formDefaults, setFormDefaults] = useState<ProviderAccountFormValues>(
    providerAccountFormDefaults(null, snapshot?.providers[0]?.id ?? ''),
  )

  const saveMut = useMutation({
    mutationFn: (r: ProviderAccountFormValues) => {
      const payload = buildSavePayload(r)
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
        apiLogin: a.apiLogin ?? a.login ?? '',
        apiPassword: '',
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

  const healthCtx = useMemo(
    () => ({
      providers: snapshot?.providers ?? [],
      syncLog: snapshot?.syncLog ?? [],
      balanceLedger: snapshot?.balanceLedger ?? [],
    }),
    [snapshot],
  )

  const vpsCountByAccount = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of snapshot?.vps ?? []) {
      if (!v.providerAccountId) continue
      map.set(v.providerAccountId, (map.get(v.providerAccountId) ?? 0) + 1)
    }
    return map
  }, [snapshot?.vps])

  const filteredAccounts = useMemo(() => {
    const accounts = snapshot?.providerAccounts ?? []
    let result = accounts
    if (health && snapshot) {
      if (health === 'stale-sync') {
        const ids = new Set(
          getStaleSyncAccountIds(snapshot.providerAccounts, snapshot.providers, snapshot.syncLog ?? []),
        )
        result = accounts.filter((a) => ids.has(a.id))
      } else if (health === 'balance-mismatch') {
        const ids = new Set(getBalanceMismatchAccountIds(snapshot.providerAccounts, snapshot.balanceLedger))
        result = accounts.filter((a) => ids.has(a.id))
      }
    }
    return applyAccountFilters(result, filters, snapshot?.providers ?? [], healthCtx)
  }, [snapshot, health, filters, healthCtx])

  const summaryCards = useMemo(() => {
    if (!snapshot) return []
    const accounts = snapshot.providerAccounts
    const atRisk = buildAtRiskAccounts(accounts, snapshot.providers, snapshot.syncLog ?? [])
    const lowBalanceCount = countLowBalanceAccounts(accounts, healthCtx)
    const defaultFilters = buildDefaultAccountFilters()
    return [
      {
        label: 'Всего аккаунтов',
        value: accounts.length,
        icon: <UserRoundIcon className="size-4" />,
        active: !health && !hasActiveAccountFilters(filters),
        onClick: () => setFilters(defaultFilters),
      },
      {
        label: 'Готовы к синку',
        value: syncableCount,
        icon: <RefreshCwIcon className="size-4" />,
        active: matchesAccountFilterPreset(filters, { syncableOnly: true }),
        onClick: () => setFilters({ ...defaultFilters, syncableOnly: true }),
      },
      {
        label: 'С проблемами',
        value: countAccountsWithIssues(accounts, healthCtx),
        icon: <ActivityIcon className="size-4" />,
        variant: atRisk.length ? ('warning' as const) : ('default' as const),
        active: matchesAccountFilterPreset(filters, { issuesOnly: true }),
        onClick: () => setFilters({ ...defaultFilters, issuesOnly: true }),
      },
      {
        label: 'Низкий баланс',
        value: lowBalanceCount,
        icon: <WalletIcon className="size-4" />,
        variant: lowBalanceCount ? ('destructive' as const) : ('default' as const),
        active: matchesAccountFilterPreset(filters, { lowBalanceOnly: true }),
        onClick: () => setFilters({ ...defaultFilters, lowBalanceOnly: true }),
      },
    ]
  }, [snapshot, syncableCount, healthCtx, filters, health])

  const columns: DataGridColumn<ProviderAccount>[] = [
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
      cell: (a) => (
        <span className="text-muted-foreground">{a.apiLogin ?? a.login ?? '—'}</span>
      ),
    },
    {
      key: 'health',
      header: 'Статус',
      icon: ActivityIcon,
      sortable: false,
      cell: (a) => {
        const flags = getAccountHealthFlags(a, healthCtx)
        if (!flags.length) {
          return <Badge variant="outline">OK</Badge>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {flags.map((flag) => (
              <Badge key={flag} variant={HEALTH_BADGE_VARIANT[flag]}>
                {ACCOUNT_HEALTH_LABELS[flag]}
              </Badge>
            ))}
          </div>
        )
      },
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
      key: 'vps',
      header: 'VPS',
      icon: ServerIcon,
      headerClassName: 'text-right',
      className: 'text-right tabular-nums',
      sortValue: (a) => vpsCountByAccount.get(a.id) ?? 0,
      cell: (a) => {
        const count = vpsCountByAccount.get(a.id) ?? 0
        return count ? <Badge variant="secondary">{count}</Badge> : <span className="text-muted-foreground">0</span>
      },
    },
    {
      key: 'sync',
      header: 'Последний синк',
      icon: ClockIcon,
      sortValue: (a) => lastOkSyncFinishedAt(a.id, snapshot?.syncLog ?? []) ?? 0,
      cell: (a) => {
        const t = lastOkSyncFinishedAt(a.id, snapshot?.syncLog ?? [])
        return <span className="text-muted-foreground">{formatRelativeTime(t)}</span>
      },
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
            onBalanceRefreshed={() => void queryClient.invalidateQueries({ queryKey: ['snapshot'] })}
          />
        ) : null
      }
    >
      {() => (
        <div className="flex flex-col gap-4">
          {snapshot ? <SectionCards items={summaryCards} /> : null}
          {snapshot ? (
            <AccountFiltersToolbar
              filters={filters}
              onChange={setFilters}
              providers={snapshot.providers}
              shownCount={filteredAccounts.length}
              totalCount={snapshot.providerAccounts.length}
            />
          ) : null}
          {health ? <HealthModeBanner health={health} exitTo="/accounts" /> : null}
          <DataGridCard
            columns={columnDefFromDataGrid(columns)}
            data={filteredAccounts}
            rowId={(a) => a.id}
            pinLastColumn
            emptyTitle={health || hasActiveAccountFilters(filters) ? 'Нет аккаунтов с этими фильтрами' : 'Нет записей'}
            emptyDescription={
              health || hasActiveAccountFilters(filters)
                ? 'Измените фильтры или сбросьте их'
                : undefined
            }
            emptyAction={
              health || hasActiveAccountFilters(filters) ? (
                <Button variant="outline" onClick={() => setFilters(buildDefaultAccountFilters())}>
                  Сбросить фильтры
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
    </CrudListPage>
  )
}
