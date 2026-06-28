import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { PlusIcon, CalendarIcon, UserRoundIcon, TagIcon, CoinsIcon, StickyNoteIcon } from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@cfdm/ui/components/button'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-grid-types'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { CrudListPage } from '@/components/crud-list-page'
import { RowActions } from '@/components/row-actions'
import { PaymentEditSheet, paymentFormDefaults } from '@/components/domain/payment-edit-sheet'
import type { PaymentFormValues } from '@/lib/schemas'
import type { Payment } from '@/types/entities'
import { paymentTypeLabel, formatCurrency } from '@/lib/format'
import { providerByIdMap, accountSelectLabel } from '@/lib/billmanager'

export const Route = createFileRoute('/_auth/payments')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: PaymentsPage,
})

function PaymentsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const [open, setOpen] = useState(false)
  const [formDefaults, setFormDefaults] = useState<PaymentFormValues>(
    paymentFormDefaults(null, snapshot?.providerAccounts[0]?.id ?? ''),
  )

  const saveMut = useMutation({
    mutationFn: (r: PaymentFormValues) =>
      r.id
        ? api.update<Payment>('payments', r.id, r as unknown as Partial<Payment>)
        : api.create('payments', r as unknown as Payment),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Платёж сохранён')
      setOpen(false)
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })
  const delMut = useMutation({
    mutationFn: (id: string) => api.remove<Payment>('payments', id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['snapshot'] })
      toast.success('Платёж удалён')
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Ошибка'),
  })

  const openCreate = () => {
    setFormDefaults(paymentFormDefaults(null, snapshot?.providerAccounts[0]?.id ?? ''))
    setOpen(true)
  }
  const openEdit = (p: Payment) => {
    setFormDefaults(
      paymentFormDefaults({
        id: p.id,
        type: p.type,
        date: p.date,
        amount: p.amount,
        currency: p.currency,
        providerAccountId: p.providerAccountId,
        note: p.note ?? '',
      }),
    )
    setOpen(true)
  }

  const providerById = snapshot ? providerByIdMap(snapshot.providers) : new Map()

  const columns: DataTableColumn<Payment>[] = [
    {
      key: 'date',
      header: 'Дата',
      icon: CalendarIcon,
      cell: (p) => <span className="tabular-nums">{p.date}</span>,
    },
    {
      key: 'account',
      header: 'Аккаунт',
      icon: UserRoundIcon,
      sortValue: (p) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === p.providerAccountId)
        return acc ? accountSelectLabel(acc, providerById) : ''
      },
      cell: (p) => {
        const acc = snapshot?.providerAccounts.find((a) => a.id === p.providerAccountId)
        if (!acc) return '—'
        const providerName = providerById.get(acc.providerId)?.name ?? '—'
        return dataGridCellStack(acc.name, providerName)
      },
    },
    {
      key: 'type',
      header: 'Тип',
      icon: TagIcon,
      cell: (p) => <span>{paymentTypeLabel(p.type)}</span>,
    },
    {
      key: 'amount',
      header: 'Сумма',
      icon: CoinsIcon,
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (p) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(p.amount, p.currency)}
        </span>
      ),
    },
    {
      key: 'note',
      header: 'Заметка',
      icon: StickyNoteIcon,
      cell: (p) => <span className="text-muted-foreground">{p.note || '—'}</span>,
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
          deleteTitle="Удалить платёж?"
        />
      ),
    },
  ]

  const sorted = [...(snapshot?.payments ?? [])].sort((a, b) => b.date.localeCompare(a.date))
  const totalByCurrency = sorted.reduce<Record<string, number>>((acc, p) => {
    const cur = p.currency ?? 'RUB'
    acc[cur] = (acc[cur] ?? 0) + Number(p.amount || 0)
    return acc
  }, {})

  return (
    <CrudListPage
      title="Платежи"
      description="Пополнения балансов и прямые платежи за VPS"
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
      empty={snapshot?.payments.length === 0}
      emptyTitle="Платежей нет"
      emptyDescription="Добавьте первый платёж или дождитесь синхронизации"
      emptyAction={
        <Button onClick={openCreate}>
          <PlusIcon data-icon="inline-start" />
          Добавить платёж
        </Button>
      }
      sheet={
        snapshot ? (
          <PaymentEditSheet
            open={open}
            onOpenChange={setOpen}
            defaultValues={formDefaults}
            providerAccounts={snapshot.providerAccounts}
            providers={snapshot.providers}
            onSubmit={(values) => saveMut.mutate(values)}
            submitting={saveMut.isPending}
          />
        ) : null
      }
    >
      {() => (
        <DataGridCard
          columns={columnDefFromDataTable(columns)}
          data={sorted}
          rowId={(p) => p.id}
          pinLastColumn
          virtualization={sorted.length > 200}
          height={560}
          footerContent={
            <div className="flex flex-wrap justify-end gap-6 px-3 py-2 text-sm tabular-nums">
              {Object.entries(totalByCurrency).map(([cur, sum]) => (
                <span key={cur}>
                  Итого {cur}: <b className="text-foreground">{formatCurrency(sum, cur)}</b>
                </span>
              ))}
            </div>
          }
        />
      )}
    </CrudListPage>
  )
}
