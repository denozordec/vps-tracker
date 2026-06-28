import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  PlusIcon,
  CalendarIcon,
  UserRoundIcon,
  TagIcon,
  CoinsIcon,
  StickyNoteIcon,
  CreditCardIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { snapshotQueryOptions, ratesQueryOptions } from '@/queries/snapshot'
import { api, ApiError } from '@/lib/api-client'
import { Button } from '@cfdm/ui/components/button'
import { DataGridCard, columnDefFromDataTable } from '@/components/data-grid-card'
import type { DataTableColumn } from '@/components/data-grid-types'
import { dataGridCellStack } from '@/components/data-grid-cells'
import { CrudListPage } from '@/components/crud-list-page'
import { SectionCards } from '@/components/section-cards'
import { SectionCardsSkeleton, TableSkeleton } from '@/components/skeletons'
import { RowActions } from '@/components/row-actions'
import { PaymentEditSheet, paymentFormDefaults } from '@/components/domain/payment-edit-sheet'
import type { PaymentFormValues } from '@/lib/schemas'
import type { Payment } from '@/types/entities'
import { paymentTypeLabel, formatCurrency, convertCurrency, normalizeRatesPayload, toIsoCurrency } from '@/lib/format'
import { providerByIdMap, accountSelectLabel } from '@/lib/billmanager'

export const Route = createFileRoute('/_auth/payments')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(snapshotQueryOptions()),
  component: PaymentsPage,
})

function PaymentsPage() {
  const queryClient = useQueryClient()
  const { data: snapshot, isLoading, isError, error, refetch } = useQuery(snapshotQueryOptions())
  const settings = snapshot?.settings?.[0]
  const { data: rawRates } = useQuery(ratesQueryOptions(settings?.ratesUrl))
  const ratesData = normalizeRatesPayload(rawRates) ?? rawRates ?? null
  const [open, setOpen] = useState(false)
  const [formDefaults, setFormDefaults] = useState<PaymentFormValues>(
    paymentFormDefaults(null, snapshot?.providerAccounts[0]?.id ?? ''),
  )

  const saveMut = useMutation({
    mutationFn: (r: PaymentFormValues) => {
      const payload = {
        ...r,
        vpsId: r.vpsId?.trim() || undefined,
      }
      return r.id
        ? api.update<Payment>('payments', r.id, payload as unknown as Partial<Payment>)
        : api.create('payments', payload as unknown as Payment)
    },
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
        vpsId: (p as Payment & { vpsId?: string }).vpsId ?? '',
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
      skeleton={
        <div className="flex flex-col gap-4">
          <SectionCardsSkeleton count={3} />
          <TableSkeleton />
        </div>
      }
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
            vpsRows={snapshot.vps}
            onSubmit={(values) => saveMut.mutate(values)}
            submitting={saveMut.isPending}
          />
        ) : null
      }
    >
      {(snap) => {
        const baseCurrency = (snap.settings[0]?.baseCurrency ?? 'RUB').toUpperCase()
        const totalSum = snap.payments.reduce(
          (acc, p) =>
            acc + convertCurrency(Number(p.amount), toIsoCurrency(p.currency), baseCurrency, ratesData),
          0,
        )
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 30)
        const cutoffStr = cutoff.toISOString().slice(0, 10)
        const recent = snap.payments.filter((p) => p.date >= cutoffStr)
        const recentSum = recent.reduce(
          (acc, p) =>
            acc + convertCurrency(Number(p.amount), toIsoCurrency(p.currency), baseCurrency, ratesData),
          0,
        )

        return (
          <div className="flex flex-col gap-4">
            <SectionCards
              items={[
                {
                  label: 'Всего платежей',
                  value: snap.payments.length,
                  icon: <CreditCardIcon className="size-4" />,
                },
                {
                  label: 'Общая сумма',
                  value: formatCurrency(totalSum, baseCurrency),
                  icon: <CoinsIcon className="size-4" />,
                  hint: baseCurrency,
                },
                {
                  label: 'За 30 дней',
                  value: recent.length,
                  icon: <CalendarIcon className="size-4" />,
                  hint: formatCurrency(recentSum, baseCurrency),
                },
              ]}
            />
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
          </div>
        )
      }}
    </CrudListPage>
  )
}
