import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  PlusIcon,
  Trash2Icon,
  ArrowDownUpIcon,
  CalendarIcon,
  UserRoundIcon,
  ArrowLeftRightIcon,
  CoinsIcon,
  StickyNoteIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ScaleIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@cfdm/ui/components/button'
import { Badge } from '@cfdm/ui/components/badge'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-grid-types'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { CrudListPage } from '@/components/crud-list-page'
import { SectionCards } from '@/components/section-cards'
import { SectionCardsSkeleton, TableSkeleton } from '@/components/skeletons'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { BalanceEntrySheet, balanceEntryFormDefaults } from '@/components/domain/balance-entry-sheet'
import type { BalanceLedgerFormValues } from '@/lib/schemas'
import type { BalanceLedgerRow } from '@/types/entities'
import { formatCurrency, convertCurrency, normalizeRatesPayload, toIsoCurrency } from '@/lib/format'
import { providerByIdMap, accountSelectLabel } from '@/lib/billmanager'

export const Route = createFileRoute('/_auth/balance')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: BalancePage,
})

function BalancePage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const settings = snapshot?.settings?.[0]
  const { data: rawRates } = useQuery(ratesQueryOptions(settings?.ratesUrl))
  const ratesData = normalizeRatesPayload(rawRates) ?? rawRates ?? null
  const [open, setOpen] = useState(false)
  const [formDefaults, setFormDefaults] = useState<BalanceLedgerFormValues>(balanceEntryFormDefaults())

  const addMut = useMutation({
    mutationFn: (r: BalanceLedgerFormValues) => api.create('balanceLedger', r as unknown as BalanceLedgerRow),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Запись добавлена')
      setOpen(false)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api.remove<BalanceLedgerRow>('balanceLedger', id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Запись удалена')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const openCreate = () => {
    setFormDefaults(balanceEntryFormDefaults(snapshot?.providerAccounts[0]?.id ?? ''))
    setOpen(true)
  }

  const providerById = snapshot ? providerByIdMap(snapshot.providers) : new Map()

  const columns: DataTableColumn<BalanceLedgerRow>[] = [
    {
      key: 'date',
      header: 'Дата',
      icon: CalendarIcon,
      cell: (r) => <span className="tabular-nums">{r.date}</span>,
    },
    {
      key: 'account',
      header: 'Аккаунт',
      icon: UserRoundIcon,
      sortValue: (r) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === r.providerAccountId)
        return acc ? accountSelectLabel(acc, providerById) : ''
      },
      cell: (r) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === r.providerAccountId)
        if (!acc) return '—'
        const providerName = providerById.get(acc.providerId)?.name ?? '—'
        return dataGridCellStack(acc.name, providerName)
      },
    },
    {
      key: 'dir',
      header: 'Движение',
      icon: ArrowLeftRightIcon,
      cell: (r) => (
        <Badge variant={r.direction === 'credit' ? 'default' : 'destructive'}>
          <ArrowDownUpIcon data-icon="inline-start" />
          {r.direction === 'credit' ? 'Приход' : 'Списание'}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Сумма',
      icon: CoinsIcon,
      headerClassName: 'text-right',
      className: 'text-right',
      sortValue: (r) => Number(r.amount),
      cell: (r) => (
        <span className={`tabular-nums font-medium ${r.direction === 'credit' ? '' : 'text-destructive'}`}>
          {r.direction === 'credit' ? '+' : '−'}
          {formatCurrency(Number(r.amount), r.currency ?? 'RUB')}
        </span>
      ),
    },
    {
      key: 'note',
      header: 'Заметка',
      icon: StickyNoteIcon,
      cell: (r) => <span className="text-muted-foreground">{r.note || '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      className: 'w-16 text-right',
      cell: (r) => (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label="Удалить">
              <Trash2Icon />
            </Button>
          }
          title="Удалить запись?"
          confirmLabel="Удалить"
          destructive
          onConfirm={() => delMut.mutate(r.id)}
        />
      ),
    },
  ]

  const rows = [...(snapshot?.balanceLedger ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const baseCurrency = (snapshot?.settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
  const totalCredit = rows
    .filter((r) => r.direction === 'credit')
    .reduce(
      (acc, r) =>
        acc + convertCurrency(Number(r.amount), toIsoCurrency(r.currency), baseCurrency, ratesData),
      0,
    )
  const totalDebit = rows
    .filter((r) => r.direction === 'debit')
    .reduce(
      (acc, r) =>
        acc + convertCurrency(Number(r.amount), toIsoCurrency(r.currency), baseCurrency, ratesData),
      0,
    )

  return (
    <CrudListPage
      title="Баланс и списания"
      description="Журнал движений по аккаунтам"
      actions={
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Добавить запись
        </Button>
      }
      data={snapshot}
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={
        <div className="flex flex-col gap-4">
          <SectionCardsSkeleton count={3} />
          <TableSkeleton />
        </div>
      }
      empty={rows.length === 0}
      emptyTitle="Записей нет"
      emptyDescription="Добавьте движение по балансу аккаунта"
      emptyAction={
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Добавить запись
        </Button>
      }
      sheet={
        snapshot ? (
          <BalanceEntrySheet
            open={open}
            onOpenChange={setOpen}
            defaultValues={formDefaults}
            providerAccounts={snapshot.providerAccounts}
            providers={snapshot.providers}
            onSubmit={(values) => addMut.mutate(values)}
            submitting={addMut.isPending}
          />
        ) : null
      }
    >
      {() => (
          <div className="flex flex-col gap-4">
            <SectionCards
              items={[
                {
                  label: 'Всего приходов',
                  value: formatCurrency(totalCredit, baseCurrency),
                  icon: <ArrowDownIcon className="size-4" />,
                  hint: baseCurrency,
                },
                {
                  label: 'Всего списаний',
                  value: formatCurrency(totalDebit, baseCurrency),
                  icon: <ArrowUpIcon className="size-4" />,
                  hint: baseCurrency,
                },
                {
                  label: 'Чистый баланс',
                  value: formatCurrency(totalCredit - totalDebit, baseCurrency),
                  icon: <ScaleIcon className="size-4" />,
                  hint: `${rows.length} записей`,
                },
              ]}
            />
            <DataGridCard
              columns={columnDefFromDataTable(columns)}
              data={rows}
              rowId={(r) => r.id}
              pinLastColumn
              footerContent={
                <div className="flex justify-end gap-6 px-3 py-2 text-sm tabular-nums">
                  <span>
                    Приходы: <b className="text-foreground">{formatCurrency(totalCredit, baseCurrency)}</b>
                  </span>
                  <span>
                    Списания: <b className="text-foreground">{formatCurrency(totalDebit, baseCurrency)}</b>
                  </span>
                  <span>
                    Итого: <b className="text-foreground">{formatCurrency(totalCredit - totalDebit, baseCurrency)}</b>
                  </span>
                </div>
              }
            />
          </div>
        )}
    </CrudListPage>
  )
}
